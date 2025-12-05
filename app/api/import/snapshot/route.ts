import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Parsuje peněžní hodnotu z Excelu
 * - Odstraní vše kromě číslic, čárky, tečky a mínusu
 * - Nahradí čárku tečkou (český formát)
 * - Vrátí 0 pokud není validní číslo
 */
function parseMoney(value: unknown): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  
  let str = String(value).replace(/[^\d,.\-]/g, '')
  str = str.replace(',', '.')
  
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

/**
 * Normalizuje název jednotky pro porovnání
 */
function normalizeUnitName(name: string): string {
  return name
    .toLowerCase()
    .replace(/byt[-\s]*č\.?\s*/gi, '')
    .replace(/jednotka[-\s]*č\.?\s*/gi, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * Normalizuje název služby pro porovnání
 */
function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Kontroluje zda název služby je nevalidní (falešná služba)
 * Vrací true pokud by služba měla být přeskočena
 */
function isInvalidServiceName(name: string): boolean {
  if (!name || !name.trim()) return true
  const serviceName = name.trim()
  
  return (
    /^[0-9\s]+\s*Kč/i.test(serviceName) ||      // "8 542 Kč" nebo "9 137 Kč"
    /^[0-9\s]+\s*kc/i.test(serviceName) ||      // "8 542 kc" (ascii fallback)
    /^#/.test(serviceName) ||                   // "#N/A", "#NAME?"
    /^\d+\/\d+$/.test(serviceName) ||           // "1/2024"
    /^Celkem/i.test(serviceName) ||             // "Celkem náklady..."
    /^K úhradě/i.test(serviceName) ||           // "K úhradě za rok"
    /^[\d\s]+$/.test(serviceName) ||            // jen čísla a mezery
    /^Měsíce/i.test(serviceName) ||             // "Měsíce" (hlavička ADVANCE_MONTHLY)
    /^[0-9\s,]+([.,]\d+)?$/.test(serviceName)   // jen čísla, mezery, čárky: "8 542" nebo "123.45"
  )
}

/**
 * Extrahuje číslo domu z názvu bytu 
 * Vzory: "Byt-č.-20801" -> "2080", "Byt-č.-31801" -> "318"
 * Číslo bytu je typicky poslední 2 číslice, ale může být i 1 číslice
 */
function extractBuildingNumber(unitName: string): string | null {
  // Najít sekvenci číslic na konci
  const allDigits = unitName.match(/(\d+)$/)
  if (!allDigits) return null
  
  const digits = allDigits[1]
  
  // Pokud má 5+ číslic, číslo popisné je první 4 a zbytek je byt
  if (digits.length >= 5) {
    return digits.substring(0, 4)
  }
  // Pokud má 4 číslice, číslo popisné je první 3
  if (digits.length >= 4) {
    return digits.substring(0, 3)
  }
  // Méně - vrátit celé
  return digits
}

interface MeterReading {
  serial: string
  start: number
  end: number
  consumption: number
}

interface ServiceData {
  name: string
  buildingTotalCost: number
  unitCost: number
  unitAdvance: number
  unitBalance: number
  buildingConsumption?: number
  unitConsumption?: number
  unitPricePerUnit?: number
  distributionBase?: string
  calculationType: string
  monthlyAdvances: number[]
  meterReadings: MeterReading[]
  // Nová pole pro věrný tisk z Excelu (V33+)
  buildingUnits?: string   // Jednotek (dům) - string pro zachování formátu
  unitPrice?: string       // Kč/jedn - string pro zachování formátu
  unitUnits?: string       // Jednotek (byt) - string pro zachování formátu
  methodology?: string     // Metodika/jednotka (počet osob, vlastnický podíl, atd.)
  sharePercent?: string    // Podíl (100)
}

interface UnitData {
  unitName: string
  ownerName?: string
  variableSymbol?: string
  email?: string
  address?: string
  bankAccount?: string  // číslo účtu pro přeplatek
  totalResult: number
  totalCost: number
  totalAdvance: number
  repairFund: number
  services: Map<string, ServiceData>
  monthlyAdvances: number[]
  monthlyPayments: number[]
}

/**
 * Zpracuje Excel soubor s listem EXPORT_FULL
 * Tento endpoint importuje kompletní "snapshot" vyúčtování z Excelu
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const buildingIdParam = formData.get('buildingId') as string | null
    const yearParam = formData.get('year') as string | null

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Soubor nebyl nalezen' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, error: 'Soubor je prázdný' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Soubor je příliš velký (limit 10 MB)' }, { status: 413 })
    }

    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ success: false, error: 'Podporované jsou pouze soubory XLS nebo XLSX' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer, { type: 'buffer' })

    // Najít list EXPORT_FULL
    const exportSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().replace(/[\s_-]/g, '').includes('exportfull') ||
      name.toLowerCase() === 'export_full' ||
      name.toLowerCase() === 'export full'
    )

    if (!exportSheetName) {
      return NextResponse.json({ 
        success: false, 
        error: 'List EXPORT_FULL nebyl nalezen v souboru.',
        availableSheets: workbook.SheetNames 
      }, { status: 400 })
    }

    const sheet = workbook.Sheets[exportSheetName]
    const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    if (rawData.length < 2) {
      return NextResponse.json({ success: false, error: 'List EXPORT_FULL je prázdný' }, { status: 400 })
    }

    // Parsovat hlavičku
    const headers = (rawData[0] as unknown[]).map(h => String(h || '').trim())
    
    // Najít indexy sloupců
    const getColIndex = (name: string) => headers.findIndex(h => 
      h.toLowerCase().includes(name.toLowerCase())
    )
    
    const colUnitName = Math.max(0, getColIndex('UnitName'), getColIndex('Jednotka'))
    const colDataType = Math.max(1, getColIndex('DataType'), getColIndex('Typ'))
    const colKey = Math.max(2, getColIndex('Key'), getColIndex('Služba'), getColIndex('Klíč'))
    const colVal1 = Math.max(3, getColIndex('Val1'))

    console.log(`[Snapshot] Sloupce: UnitName=${colUnitName}, DataType=${colDataType}, Key=${colKey}, Val1=${colVal1}`)

    // === FÁZE 1: Načíst všechna data z Excelu (ještě nemáme budovu) ===
    const unitDataMap = new Map<string, UnitData>()
    let currentUnitName = ''
    let firstAddress = ''
    let buildingNumberFromUnits = ''

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[]
      if (!row || row.length === 0) continue

      const unitName = String(row[colUnitName] || '').trim() || currentUnitName
      const dataType = String(row[colDataType] || '').toUpperCase().trim()
      const key = String(row[colKey] || '').trim()

      const values: unknown[] = []
      for (let v = 0; v < 14; v++) {
        const idx = colVal1 + v
        values.push(idx < row.length ? row[idx] : null)
      }

      if (!unitName || !dataType) continue
      currentUnitName = unitName

      // Extrahovat číslo domu z prvního bytu
      if (!buildingNumberFromUnits && unitName) {
        buildingNumberFromUnits = extractBuildingNumber(unitName) || ''
      }

      let unitData = unitDataMap.get(unitName)
      if (!unitData) {
        unitData = {
          unitName,
          totalResult: 0,
          totalCost: 0,
          totalAdvance: 0,
          repairFund: 0,
          services: new Map(),
          monthlyAdvances: new Array(12).fill(0),
          monthlyPayments: new Array(12).fill(0)
        }
        unitDataMap.set(unitName, unitData)
      }

      switch (dataType) {
        case 'INFO': {
          // NOVÝ FORMÁT: Val1: Jméno vlastníka, Val2: VS, Val3: Email, Val4: Výsledek, Val5: Bankovní účet
          unitData.ownerName = values[0] ? String(values[0]) : undefined
          unitData.variableSymbol = values[1] ? String(values[1]) : undefined
          unitData.email = values[2] ? String(values[2]) : undefined
          unitData.totalResult = parseMoney(values[3])
          unitData.bankAccount = values[4] ? String(values[4]) : undefined
          
          // Tyto hodnoty nejsou v novém formátu - dopočítáme z COST řádků později
          // unitData.totalCost = parseMoney(values[4])
          // unitData.totalAdvance = parseMoney(values[5])
          // unitData.repairFund = parseMoney(values[6])
          
          console.log(`[Snapshot] INFO: ${unitName} - Vlastník: ${unitData.ownerName?.substring(0, 40)}`)
          break
        }

        case 'COST': {
          const serviceName = key || ''
          
          // Přeskočit falešné služby - zálohy jednotek, popisky, chyby
          if (isInvalidServiceName(serviceName)) {
            break // Přeskočit
          }
          
          // V33 FORMÁT SLOUPCŮ (z Office Script):
          // Val1 = nakladDum (Náklad dům)
          // Val2 = nakladUziv (Náklad byt)  
          // Val3 = zaloha (Záloha)
          // Val4 = preplatek (Přeplatek/nedoplatek)
          // Val5 = jednotka (typ - "počet osob", "vlastnický podíl" atd.)
          // Val6 = jednotekDum (Jednotek dům)
          // Val7 = kcJedn (Kč/jedn)
          // Val8 = jednotekUziv (Jednotek uživatel)
          // Val9 = podil (Podíl - 100)
          
          const buildingTotalCost = parseMoney(values[0])  // Val1 = Náklad dům
          let unitCost = parseMoney(values[1])             // Val2 = Náklad byt
          const unitAdvance = parseMoney(values[2])        // Val3 = Záloha
          const unitBalance = parseMoney(values[3])        // Val4 = Přeplatek/nedoplatek
          const methodology = values[4] ? String(values[4]).trim() : ''  // Val5 = Jednotka (metodika)
          const buildingUnitsVal = parseMoney(values[5])   // Val6 = Jednotek dům
          const pricePerUnit = parseMoney(values[6])       // Val7 = Kč/jedn
          const unitUnitsVal = parseMoney(values[7])       // Val8 = Jednotek uživatel
          const sharePercent = values[8] ? String(values[8]).trim() : '100'  // Val9 = Podíl
          
          // Workaround pro služby kde je chyba v nákladu
          if (unitCost === 0 && unitAdvance > 0 && unitBalance !== 0) {
            unitCost = unitAdvance - unitBalance
            console.log(`[Snapshot] Oprava nákladu pro ${serviceName}: ${unitAdvance} - ${unitBalance} = ${unitCost}`)
          }
          
          // Přeskočit služby s nulovým nákladem i zálohou (kromě Fond oprav)
          if (unitCost === 0 && unitAdvance === 0 && !serviceName.toLowerCase().includes('fond')) {
            break
          }
          
          // Helper pro zachování hodnoty jako string (pro věrný tisk)
          const keepStr = (val: unknown): string | undefined => {
            if (!val) return undefined
            const str = String(val).trim()
            if (!str || str === '0' || str === '0,00' || str.startsWith('#') || str === '-') return undefined
            return str
          }
          
          const serviceData: ServiceData = {
            name: serviceName,
            buildingTotalCost: buildingTotalCost,
            unitCost: unitCost,
            unitAdvance: unitAdvance,
            unitBalance: unitBalance,
            buildingConsumption: buildingUnitsVal,           // Jednotek dům (číslo)
            unitConsumption: unitUnitsVal,                   // Jednotek uživatel (číslo)
            unitPricePerUnit: pricePerUnit,                  // Kč/jedn (číslo)
            distributionBase: methodology,                   // Metodika (počet osob, vlastnický podíl, atd.)
            calculationType: 'COST',
            monthlyAdvances: new Array(12).fill(0),
            meterReadings: [],
            // Nová pole pro věrný tisk (zachováváme jako string)
            buildingUnits: keepStr(values[5]),   // Val6 = Jednotek dům (string)
            unitPrice: keepStr(values[6]),       // Val7 = Kč/jedn (string)
            unitUnits: keepStr(values[7]),       // Val8 = Jednotek byt (string)
            methodology: methodology,            // Val5 = Metodika/jednotka
            sharePercent: sharePercent           // Val9 = Podíl
          }
          unitData.services.set(normalizeServiceName(serviceName), serviceData)
          break
        }

        case 'METER': {
          const serviceName = key || ''
          
          // Přeskočit falešné služby - stejná logika jako v COST
          if (isInvalidServiceName(serviceName)) {
            break // Přeskočit
          }
          
          const normalizedService = normalizeServiceName(serviceName)

          const meterReading: MeterReading = {
            serial: values[0] ? String(values[0]) : '',
            start: parseMoney(values[1]),
            end: parseMoney(values[2]),
            consumption: parseMoney(values[3])
          }

          let serviceData = unitData.services.get(normalizedService)
          if (!serviceData) {
            serviceData = {
              name: serviceName,
              buildingTotalCost: 0,
              unitCost: 0,
              unitAdvance: 0,
              unitBalance: 0,
              calculationType: 'METER',
              monthlyAdvances: new Array(12).fill(0),
              meterReadings: []
            }
            unitData.services.set(normalizedService, serviceData)
          }

          serviceData.meterReadings.push(meterReading)
          serviceData.calculationType = 'METER'
          break
        }

        case 'ADVANCE_MONTHLY':
        case 'ADVANCE_MONTHLY_SOURCE': {
          const monthlyAdvances: number[] = []
          for (let m = 0; m < 12; m++) {
            monthlyAdvances.push(parseMoney(values[m]))
          }
          console.log(`[Snapshot] ADVANCE_MONTHLY pro ${unitName}: ${monthlyAdvances.join(', ')}`)

          if (key) {
            const normalizedService = normalizeServiceName(key)
            const serviceData = unitData.services.get(normalizedService)
            if (serviceData) {
              serviceData.monthlyAdvances = monthlyAdvances
            }
          } else {
            unitData.monthlyAdvances = monthlyAdvances
          }
          break
        }

        case 'PAYMENT_MONTHLY':
        case 'PAYMENT_MONTHLY_SOURCE': {
          for (let m = 0; m < 12; m++) {
            unitData.monthlyPayments[m] = parseMoney(values[m])
          }
          console.log(`[Snapshot] PAYMENT_MONTHLY pro ${unitName}: ${unitData.monthlyPayments.join(', ')}`)
          break
        }

        case 'FUND': {
          const serviceName = key || 'Fond oprav'
          unitData.repairFund = parseMoney(values[0])

          const serviceData: ServiceData = {
            name: serviceName,
            buildingTotalCost: parseMoney(values[1]),
            unitCost: parseMoney(values[0]),
            unitAdvance: parseMoney(values[2]),
            unitBalance: parseMoney(values[3]),
            calculationType: 'FUND',
            monthlyAdvances: new Array(12).fill(0),
            meterReadings: []
          }
          unitData.services.set(normalizeServiceName(serviceName), serviceData)
          break
        }
      }
    }

    console.log(`[Snapshot] Načteno ${unitDataMap.size} jednotek z Excelu`)
    console.log(`[Snapshot] Číslo domu z bytů: ${buildingNumberFromUnits}`)
    console.log(`[Snapshot] První adresa: ${firstAddress}`)

    // === FÁZE 2: Najít nebo vytvořit budovu ===
    let building = null
    let buildingCreated = false

    // 1. Pokud je zadáno buildingId, použijeme ho
    if (buildingIdParam) {
      building = await prisma.building.findFirst({
        where: {
          OR: [
            { id: buildingIdParam },
            { name: { contains: buildingIdParam, mode: 'insensitive' } }
          ]
        }
      })
    }

    // 2. Zkusit najít budovu podle čísla popisného z bytů
    if (!building && buildingNumberFromUnits) {
      building = await prisma.building.findFirst({
        where: {
          OR: [
            { name: { contains: buildingNumberFromUnits, mode: 'insensitive' } },
            { address: { contains: buildingNumberFromUnits, mode: 'insensitive' } }
          ]
        }
      })
      if (building) {
        console.log(`[Snapshot] Budova nalezena podle č.p. ${buildingNumberFromUnits}: ${building.name}`)
      }
    }

    // 3. Zkusit najít budovu podle adresy z INFO
    if (!building && firstAddress) {
      const addressParts = firstAddress.split(',')[0].trim()
      const streetMatch = addressParts.match(/^([^\d]+)\s*(\d+)/)
      
      if (streetMatch) {
        const street = streetMatch[1].trim()
        building = await prisma.building.findFirst({
          where: {
            OR: [
              { name: { contains: street, mode: 'insensitive' } },
              { address: { contains: street, mode: 'insensitive' } }
            ]
          }
        })
        if (building) {
          console.log(`[Snapshot] Budova nalezena podle ulice "${street}": ${building.name}`)
        }
      }
    }

    // 4. Pokud budova stále neexistuje, vytvoříme ji
    if (!building) {
      const buildingName = firstAddress 
        ? firstAddress.split(',')[0].trim()
        : `Budova ${buildingNumberFromUnits || 'Nová'}`
      
      // Extrahovat město a PSČ z adresy
      let city = 'Brno'
      let zipCode = '60000'
      if (firstAddress) {
        const pscMatch = firstAddress.match(/(\d{3}\s?\d{2})/)
        if (pscMatch) zipCode = pscMatch[1].replace(/\s/g, '')
        
        const cityMatch = firstAddress.match(/\d{3}\s?\d{2}\s+([^,]+)/)
        if (cityMatch) city = cityMatch[1].trim()
      }
      
      building = await prisma.building.create({
        data: {
          name: buildingName,
          address: firstAddress || buildingName,
          city,
          zip: zipCode
        }
      })
      buildingCreated = true
      console.log(`[Snapshot] Vytvořena nová budova: ${building.name}`)
    }

    // === FÁZE 3: Určit rok vyúčtování ===
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() - 1

    console.log(`[Snapshot] Budova: ${building.name} (${building.id}), Rok: ${year}`)

    // === FÁZE 4: Najít nebo vytvořit billing period ===
    let billingPeriod = await prisma.billingPeriod.findFirst({
      where: { buildingId: building.id, year }
    })

    if (!billingPeriod) {
      billingPeriod = await prisma.billingPeriod.create({
        data: { buildingId: building.id, year }
      })
      console.log(`[Snapshot] Vytvořeno nové období: ${year}`)
    } else {
      console.log(`[Snapshot] Používám existující období: ${year} - PŘEPISUJI DATA`)
    }

    // === FÁZE 5: Smazat staré výsledky pro tento rok ===
    console.log('[Snapshot] Mažu staré výsledky vyúčtování...')
    await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
    await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })

    // === FÁZE 6: Vytvořit/aktualizovat jednotky ===
    const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
    const unitMap = new Map<string, typeof units[0]>()
    units.forEach(u => {
      unitMap.set(u.unitNumber, u)
      unitMap.set(u.unitNumber.toLowerCase(), u)
      unitMap.set(normalizeUnitName(u.unitNumber), u)
    })

    // Vytvořit chybějící jednotky
    for (const [unitName] of unitDataMap) {
      const normalizedName = normalizeUnitName(unitName)
      const transformedName = unitName.replace(/-/g, ' ').replace(/č\./i, 'č. ')
      
      // Zkontrolovat všechny možné varianty
      const existingUnit = unitMap.get(unitName) 
        || unitMap.get(normalizedName) 
        || unitMap.get(transformedName)
        || unitMap.get(transformedName.toLowerCase())
      
      if (!existingUnit) {
        try {
          const newUnit = await prisma.unit.create({
            data: {
              buildingId: building.id,
              unitNumber: transformedName,
              totalArea: 0,
              shareNumerator: 1,
              shareDenominator: 100
            }
          })
          unitMap.set(unitName, newUnit)
          unitMap.set(normalizedName, newUnit)
          unitMap.set(transformedName, newUnit)
          console.log(`[Snapshot] Vytvořena jednotka: ${newUnit.unitNumber}`)
        } catch (e) {
          // Jednotka už existuje - načteme ji
          const existingUnit = await prisma.unit.findFirst({
            where: { 
              buildingId: building.id,
              unitNumber: { contains: normalizedName.replace(/\//g, ''), mode: 'insensitive' }
            }
          })
          if (existingUnit) {
            unitMap.set(unitName, existingUnit)
            unitMap.set(normalizedName, existingUnit)
            console.log(`[Snapshot] Jednotka již existuje: ${existingUnit.unitNumber}`)
          } else {
            console.error(`[Snapshot] Chyba při vytváření jednotky ${unitName}:`, e)
          }
        }
      } else {
        // Zajistit že všechny varianty ukazují na stejnou jednotku
        unitMap.set(unitName, existingUnit)
        unitMap.set(normalizedName, existingUnit)
      }
    }

    // === FÁZE 7: Načíst/vytvořit služby ===
    const services = await prisma.service.findMany({ where: { buildingId: building.id } })
    const serviceMap = new Map<string, typeof services[0]>()
    services.forEach(s => serviceMap.set(normalizeServiceName(s.name), s))

    const allServiceNames = new Set<string>()
    for (const [, unitData] of unitDataMap) {
      for (const [, serviceData] of unitData.services) {
        allServiceNames.add(serviceData.name)
      }
    }

    for (const serviceName of allServiceNames) {
      if (!serviceName) continue
      const normalizedName = normalizeServiceName(serviceName)
      if (!serviceMap.has(normalizedName)) {
        const newService = await prisma.service.create({
          data: {
            buildingId: building.id,
            name: serviceName,
            code: normalizedName.replace(/\s+/g, '_').toUpperCase().substring(0, 20),
            methodology: 'OWNERSHIP_SHARE'
          }
        })
        serviceMap.set(normalizedName, newService)
        console.log(`[Snapshot] Vytvořena služba: ${serviceName}`)
      }
    }

    // === FÁZE 8: Uložit výsledky vyúčtování ===
    let createdResults = 0
    let createdServiceCosts = 0
    let updatedUnits = 0
    const errors: string[] = []
    const warnings: string[] = []

    for (const [unitName, unitData] of unitDataMap) {
      // Najít jednotku v DB
      const normalizedName = normalizeUnitName(unitName)
      const unit = unitMap.get(unitName) || unitMap.get(normalizedName)

      if (!unit) {
        warnings.push(`Jednotka nenalezena v DB: ${unitName}`)
        continue
      }

      // Aktualizovat jednotku (VS)
      try {
        if (unitData.variableSymbol) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: {
              variableSymbol: unitData.variableSymbol
            }
          })
          updatedUnits++
        }
      } catch (e) {
        errors.push(`Chyba při aktualizaci jednotky ${unitName}: ${e}`)
      }

      // Vytvořit BillingResult
      // Pokud totalCost je 0 nebo nevalidní, spočítáme ze služeb
      let calculatedTotalCost = unitData.totalCost
      if (!calculatedTotalCost || calculatedTotalCost === 0) {
        calculatedTotalCost = 0
        for (const [, serviceData] of unitData.services) {
          calculatedTotalCost += serviceData.unitCost || 0
        }
      }
      
      // Pokud totalAdvance je 0 nebo nevalidní, spočítáme ze služeb
      let calculatedTotalAdvance = unitData.totalAdvance
      if (!calculatedTotalAdvance || calculatedTotalAdvance === 0) {
        calculatedTotalAdvance = 0
        for (const [, serviceData] of unitData.services) {
          calculatedTotalAdvance += serviceData.unitAdvance || 0
        }
      }
      
      // Pokud result je 0, spočítáme jako zálohy - náklady
      let calculatedResult = unitData.totalResult
      if (calculatedResult === 0 && (calculatedTotalAdvance > 0 || calculatedTotalCost > 0)) {
        calculatedResult = calculatedTotalAdvance - calculatedTotalCost
      }
      
      try {
        // Vytvořit nebo najít vlastníka
        let ownerId: string | null = null
        if (unitData.ownerName) {
          // Parsovat jméno vlastníka (může obsahovat tituly)
          const ownerName = unitData.ownerName.trim()
          const nameParts = ownerName.split(' ')
          let firstName = ''
          let lastName = ''
          if (nameParts.length >= 2) {
            lastName = nameParts[nameParts.length - 1]
            firstName = nameParts.slice(0, nameParts.length - 1).join(' ')
          } else {
            firstName = ownerName
            lastName = ''
          }
          
          // Najít nebo vytvořit vlastníka podle emailu nebo jména
          const existingOwner = unitData.email 
            ? await prisma.owner.findFirst({ where: { email: unitData.email } })
            : await prisma.owner.findFirst({ where: { firstName, lastName } })
          
          if (existingOwner) {
            ownerId = existingOwner.id
            // Aktualizovat bankovní účet pokud je nový
            if (unitData.bankAccount && !existingOwner.bankAccount) {
              await prisma.owner.update({
                where: { id: existingOwner.id },
                data: { bankAccount: unitData.bankAccount }
              })
            }
          } else {
            const newOwner = await prisma.owner.create({
              data: {
                firstName,
                lastName,
                email: unitData.email || null,
                bankAccount: unitData.bankAccount || null,
              }
            })
            ownerId = newOwner.id
            console.log(`[Snapshot] Vytvořen vlastník: ${firstName} ${lastName}`)
          }
          
          // Vytvořit Ownership propojení pokud neexistuje
          if (ownerId) {
            const existingOwnership = await prisma.ownership.findFirst({
              where: { unitId: unit.id, ownerId }
            })
            if (!existingOwnership) {
              await prisma.ownership.create({
                data: {
                  unitId: unit.id,
                  ownerId,
                  validFrom: new Date(`${year}-01-01`),
                  sharePercent: 100,
                }
              })
            }
          }
        }
        
        const billingResult = await prisma.billingResult.create({
          data: {
            billingPeriodId: billingPeriod.id,
            unitId: unit.id,
            totalCost: calculatedTotalCost,
            totalAdvancePrescribed: calculatedTotalAdvance,
            totalAdvancePaid: calculatedTotalAdvance,
            repairFund: unitData.repairFund,
            result: calculatedResult,
            monthlyPrescriptions: unitData.monthlyAdvances.some(a => a > 0) ? unitData.monthlyAdvances : undefined,
            monthlyPayments: unitData.monthlyPayments.some(p => p > 0) ? unitData.monthlyPayments : undefined,
            summaryJson: JSON.stringify({
              owner: unitData.ownerName,
              email: unitData.email,
              vs: unitData.variableSymbol,
              bankAccount: unitData.bankAccount
            })
          }
        })
        createdResults++

        // Vytvořit BillingServiceCost pro každou službu
        for (const [normalizedName, serviceData] of unitData.services) {
          // Najít službu v DB
          let service = serviceMap.get(normalizedName)
          
          if (!service) {
            // Zkusit fuzzy matching
            for (const [sName, sData] of serviceMap) {
              if (sName.includes(normalizedName) || normalizedName.includes(sName)) {
                service = sData
                break
              }
            }
          }

          if (!service) {
            warnings.push(`Služba nenalezena: ${serviceData.name} (jednotka: ${unitName})`)
            continue
          }

          await prisma.billingServiceCost.create({
            data: {
              billingPeriodId: billingPeriod.id,
              billingResultId: billingResult.id,
              serviceId: service.id,
              unitId: unit.id,
              buildingTotalCost: serviceData.buildingTotalCost,
              buildingConsumption: serviceData.buildingConsumption,
              unitConsumption: serviceData.unitConsumption,
              unitCost: serviceData.unitCost,
              unitAdvance: serviceData.unitAdvance,
              unitBalance: serviceData.unitBalance,
              unitPricePerUnit: serviceData.unitPricePerUnit,
              distributionBase: serviceData.distributionBase,
              calculationType: serviceData.calculationType,
              // Nová pole V19 pro věrný tisk
              buildingUnits: serviceData.buildingUnits || null,
              unitPrice: serviceData.unitPrice || null,
              unitUnits: serviceData.unitUnits || null,
              monthlyAdvances: serviceData.monthlyAdvances.some(a => a > 0)
                ? JSON.stringify(serviceData.monthlyAdvances)
                : null,
              meterReadings: serviceData.meterReadings.length > 0
                ? JSON.stringify(serviceData.meterReadings)
                : null
            }
          })
          createdServiceCosts++
        }
      } catch (e) {
        errors.push(`Chyba při vytváření výsledku pro ${unitName}: ${e}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Import snapshot dokončen',
      building: { 
        id: building.id, 
        name: building.name,
        created: buildingCreated
      },
      year,
      summary: {
        unitsInExcel: unitDataMap.size,
        unitsUpdated: updatedUnits,
        billingResultsCreated: createdResults,
        serviceCostsCreated: createdServiceCosts
      },
      warnings: warnings.slice(0, 20),
      errors: errors.slice(0, 20)
    })

  } catch (error) {
    console.error('[Snapshot import]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Import se nezdařil'
      },
      { status: 500 }
    )
  }
}
