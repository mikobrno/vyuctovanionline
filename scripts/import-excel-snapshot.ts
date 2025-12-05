import * as fs from 'fs'
import * as path from 'path'
import { read, utils } from 'xlsx'
import { prisma } from '../lib/prisma'

// Parsuje peněžní hodnotu z Excelu
function parseMoney(value: unknown): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  
  let str = String(value).replace(/[^\d,.\-]/g, '')
  str = str.replace(',', '.')
  
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// Normalizuje název jednotky pro porovnání - vrací jen číslo
function normalizeUnitName(name: string): string {
  // Odstraň předponu "Byt č." v různých formátech
  let normalized = name
    .replace(/byt[-\s]*č\.?\s*/gi, '')
    .replace(/jednotka[-\s]*č\.?\s*/gi, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, '')
    .trim()
  
  return normalized.toLowerCase()
}

// Extrahuje číslo jednotky (např. "151301" z "Byt č.  151301" nebo "Byt-č.-151301")
function extractUnitNumber(name: string): string {
  // Najdi sekvenci číslic (případně s P/N suffix)
  const match = name.match(/(\d{4,})\s*(-?\s*[PN])?/i)
  if (match) {
    const num = match[1]
    const suffix = match[2] ? match[2].replace(/[-\s]/g, '').toUpperCase() : ''
    return num + (suffix ? ` ${suffix}` : '')
  }
  
  // Fallback - jen číslice
  const digits = name.replace(/\D/g, '')
  return digits
}

// Normalizuje název služby pro porovnání
function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Kontroluje zda název služby je nevalidní
function isInvalidServiceName(name: string): boolean {
  if (!name || !name.trim()) return true
  const serviceName = name.trim()
  
  return (
    /^[0-9\s]+\s*Kč/i.test(serviceName) ||
    /^#/.test(serviceName) ||
    /^\d+\/\d+$/.test(serviceName) ||
    /^Celkem/i.test(serviceName) ||
    /^K úhradě/i.test(serviceName) ||
    /^[\d\s]+$/.test(serviceName) ||
    /^Měsíce/i.test(serviceName) ||
    /^Datum/i.test(serviceName) ||
    /^Nedoplatek uhraďte/i.test(serviceName) ||
    /^Přeplatek/i.test(serviceName) ||
    serviceName.includes('www.') ||
    serviceName.includes('@') ||
    serviceName.includes('mobil:')
  )
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
  buildingUnits?: string
  unitPrice?: string
  unitUnits?: string
  methodology?: string
  sharePercent?: string
}

interface UnitData {
  unitName: string
  ownerName?: string
  variableSymbol?: string
  email?: string
  address?: string
  bankAccount?: string
  totalResult: number
  totalCost: number
  totalAdvance: number
  repairFund: number
  services: Map<string, ServiceData>
  monthlyAdvances: number[]
  monthlyPayments: number[]
}

async function main() {
  const filePath = process.argv[2] || 'JSON/vyuctovani2024 (7).xlsx'
  const year = parseInt(process.argv[3] || '2024', 10)
  
  console.log(`📁 Importuji soubor: ${filePath}`)
  console.log(`📅 Rok: ${year}`)
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Soubor nenalezen:', filePath)
    process.exit(1)
  }
  
  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  
  // Najít list EXPORT_FULL
  const exportSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('export_full') ||
    name.toLowerCase() === 'export full'
  )
  
  if (!exportSheetName) {
    console.error('❌ List EXPORT_FULL nenalezen')
    console.log('Dostupné listy:', workbook.SheetNames)
    process.exit(1)
  }
  
  console.log(`📊 Nalezen list: ${exportSheetName}`)
  
  const sheet = workbook.Sheets[exportSheetName]
  const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  
  if (rawData.length < 2) {
    console.error('❌ List je prázdný')
    process.exit(1)
  }
  
  // Parsovat hlavičku
  const headers = (rawData[0] as unknown[]).map(h => String(h || '').trim())
  console.log('📋 Hlavička:', headers.slice(0, 10).join(', '))
  
  // Najít indexy sloupců
  const colUnitName = 0  // UnitName
  const colDataType = 1  // DataType
  const colKey = 2       // Key
  const colVal1 = 3      // Val1
  
  // Načíst data z Excelu
  const unitDataMap = new Map<string, UnitData>()
  let currentUnitName = ''
  
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
        unitData.ownerName = values[0] ? String(values[0]) : undefined
        unitData.variableSymbol = values[1] ? String(values[1]) : undefined
        unitData.email = values[2] ? String(values[2]) : undefined
        unitData.totalResult = parseMoney(values[3])
        unitData.bankAccount = values[4] ? String(values[4]) : undefined
        console.log(`  👤 INFO: ${unitName} - ${unitData.ownerName?.substring(0, 30)}`)
        break
      }
      
      case 'COST': {
        const serviceName = key || ''
        
        if (isInvalidServiceName(serviceName)) break
        
        // V33 FORMÁT (upraveno dle požadavku):
        // Val1 = Podíl, Val2 = Jednotek (dům), Val3 = Náklad (uživ), Val4 = Záloha
        // Val5 = Přeplatek, Val6 = Náklad (dům), Val7 = Jednotek (dům), Val8 = Kč/jedn / Jednotek (uživ), Val9 = Metodika / Podíl
        
        // Podíl bereme primárně z Val9 (pokud je číslo), jinak z Val1
        const parsedShare = parseMoney(values[8])
        const sharePercent = parsedShare !== 0 ? String(parsedShare) : (values[0] ? String(values[0]).trim() : '100')
        // Náklad dům a jednotky dle Val6/Val7
        const buildingTotalCost = parseMoney(values[5])
        const buildingUnitsVal = parseMoney(values[6])
        // Náklad jednotky a záloha
        let unitCost = parseMoney(values[2])
        const unitAdvance = parseMoney(values[3])
        let unitBalance = parseMoney(values[4])
        // Cena za jednotku / počet jednotek uživatele
        const pricePerUnit = parseMoney(values[7])
        const unitUnitsVal = parseMoney(values[1])
        // Metodika / Jednotka textově z Val9
        const methodology = values[8] ? String(values[8]).trim() : ''
        
        // Oprava nákladu pokud je 0 ale máme zálohu a balance
        if (unitCost === 0 && unitAdvance > 0 && unitBalance !== 0) {
          unitCost = unitAdvance - unitBalance
        }
        
        // Dopočítat balance pokud chybí
        if (unitBalance === 0 && (unitAdvance !== 0 || unitCost !== 0)) {
             unitBalance = unitAdvance - unitCost
        }
        
        // Přeskočit prázdné služby
        if (unitCost === 0 && unitAdvance === 0 && !serviceName.toLowerCase().includes('fond')) {
          break
        }
        
        const keepStr = (val: unknown): string | undefined => {
          if (!val) return undefined
          const str = String(val).trim()
          if (!str || str === '0' || str === '0,00' || str.startsWith('#') || str === '-') return undefined
          return str
        }
        
        const serviceData: ServiceData = {
          name: serviceName,
          buildingTotalCost,
          unitCost,
          unitAdvance,
          unitBalance,
          buildingConsumption: buildingUnitsVal,
          unitConsumption: unitUnitsVal,
          unitPricePerUnit: pricePerUnit,
          distributionBase: methodology,
          calculationType: 'COST',
          monthlyAdvances: new Array(12).fill(0),
          meterReadings: [],
          buildingUnits: keepStr(values[6]), // Val7
          unitPrice: keepStr(values[7]),     // Val8
          unitUnits: keepStr(values[1]),     // Val2 (jednotek uživatele)
          methodology,
          sharePercent
        }
        unitData.services.set(normalizeServiceName(serviceName), serviceData)
        break
      }
      
      case 'METER': {
        const serviceName = key || ''
        if (isInvalidServiceName(serviceName)) break
        
        const meterReading: MeterReading = {
          serial: values[0] ? String(values[0]) : '',
          start: parseMoney(values[1]),
          end: parseMoney(values[2]),
          consumption: parseMoney(values[3])
        }
        
        const normalizedService = normalizeServiceName(serviceName)
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
        break
      }
      
      case 'ADVANCE_MONTHLY': {
        const monthlyAdvances: number[] = []
        for (let m = 0; m < 12; m++) {
          monthlyAdvances.push(parseMoney(values[m]))
        }
        unitData.monthlyAdvances = monthlyAdvances
        break
      }
      
      case 'PAYMENT_MONTHLY': {
        for (let m = 0; m < 12; m++) {
          unitData.monthlyPayments[m] = parseMoney(values[m])
        }
        break
      }
      
      case 'FIXED_PAYMENT': {
        if (key.toLowerCase().includes('fond')) {
          unitData.repairFund = parseMoney(values[0])
        }
        break
      }
    }
  }
  
  console.log(`\n📊 Načteno ${unitDataMap.size} jednotek`)
  
  // Extrahovat číslo budovy z první jednotky
  const firstUnitName = Array.from(unitDataMap.keys())[0] || ''
  const buildingMatch = firstUnitName.match(/(\d{3,4})/)
  const buildingNumber = buildingMatch ? buildingMatch[1] : ''
  
  console.log(`🏠 Číslo budovy: ${buildingNumber}`)
  
  // Najít budovu v DB
  let building = await prisma.building.findFirst({
    where: {
      OR: [
        { name: { contains: buildingNumber, mode: 'insensitive' } },
        { address: { contains: buildingNumber, mode: 'insensitive' } }
      ]
    }
  })
  
  if (!building) {
    console.log(`⚠️ Budova nenalezena, vytvářím novou...`)
    building = await prisma.building.create({
      data: {
        name: `Budova ${buildingNumber}`,
        address: `Ulice ${buildingNumber}`,
        city: 'Brno',
        zip: '60000'
      }
    })
  }
  
  console.log(`✅ Budova: ${building.name} (${building.id})`)
  
  // Najít nebo vytvořit billing period
  let billingPeriod = await prisma.billingPeriod.findFirst({
    where: { buildingId: building.id, year }
  })
  
  if (!billingPeriod) {
    billingPeriod = await prisma.billingPeriod.create({
      data: { buildingId: building.id, year }
    })
    console.log(`📅 Vytvořeno nové období: ${year}`)
  } else {
    console.log(`📅 Používám existující období: ${year}`)
    
    // Smazat staré výsledky
    await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
    await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
    console.log(`🗑️ Smazány staré výsledky`)
  }
  
  // Načíst existující jednotky
  const units = await prisma.unit.findMany({ where: { buildingId: building.id } })
  const unitMap = new Map<string, typeof units[0]>()
  units.forEach(u => {
    unitMap.set(u.unitNumber, u)
    unitMap.set(normalizeUnitName(u.unitNumber), u)
    // Přidat i podle extrahovaného čísla
    const extracted = extractUnitNumber(u.unitNumber)
    if (extracted) {
      unitMap.set(extracted, u)
    }
  })
  
  // Načíst/vytvořit služby
  const services = await prisma.service.findMany({ where: { buildingId: building.id } })
  const serviceMap = new Map<string, typeof services[0]>()
  services.forEach(s => serviceMap.set(normalizeServiceName(s.name), s))
  
  // Vytvořit chybějící služby
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
      console.log(`  ➕ Vytvořena služba: ${serviceName}`)
    }
  }
  
  // Uložit výsledky
  let createdResults = 0
  let createdServiceCosts = 0
  
  for (const [unitName, unitData] of unitDataMap) {
    // Najít jednotku - zkusit více variant
    const normalizedName = normalizeUnitName(unitName)
    const extractedNumber = extractUnitNumber(unitName)
    let unit = unitMap.get(unitName) || unitMap.get(normalizedName) || unitMap.get(extractedNumber)
    
    if (!unit) {
      // Vytvořit jednotku s formátem "Byt č.  XXXXX"
      const transformedName = unitName
        .replace(/-/g, ' ')
        .replace(/č\./i, 'č. ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Zkus najít ještě jednou po transformaci
      unit = unitMap.get(transformedName)
      
      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            buildingId: building.id,
            unitNumber: transformedName,
            totalArea: 0,
            shareNumerator: 1,
            shareDenominator: 100,
            variableSymbol: unitData.variableSymbol || null
          }
        })
        unitMap.set(unitName, unit)
        unitMap.set(transformedName, unit)
        unitMap.set(extractedNumber, unit)
        console.log(`  ➕ Vytvořena jednotka: ${transformedName}`)
      }
    } else if (unitData.variableSymbol) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { variableSymbol: unitData.variableSymbol }
      })
    }
    
    // Spočítat celkové náklady a zálohy
    let totalCost = 0
    let totalAdvance = 0
    for (const [, sd] of unitData.services) {
      totalCost += sd.unitCost || 0
      totalAdvance += sd.unitAdvance || 0
    }
    
    const result = unitData.totalResult !== 0 ? unitData.totalResult : (totalAdvance - totalCost)
    
    // Vytvořit vlastníka pokud existuje
    let ownerId: string | null = null
    if (unitData.ownerName) {
      const nameParts = unitData.ownerName.trim().split(' ')
      let firstName = ''
      let lastName = ''
      if (nameParts.length >= 2) {
        lastName = nameParts[nameParts.length - 1]
        firstName = nameParts.slice(0, nameParts.length - 1).join(' ')
      } else {
        firstName = unitData.ownerName
      }
      
      const existingOwner = unitData.email 
        ? await prisma.owner.findFirst({ where: { email: unitData.email } })
        : await prisma.owner.findFirst({ where: { firstName, lastName } })
      
      if (existingOwner) {
        ownerId = existingOwner.id
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
      }
      
      // Vytvořit Ownership
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
    
    // Vytvořit BillingResult
    const billingResult = await prisma.billingResult.create({
      data: {
        billingPeriodId: billingPeriod.id,
        unitId: unit.id,
        totalCost,
        totalAdvancePrescribed: totalAdvance,
        totalAdvancePaid: totalAdvance,
        repairFund: unitData.repairFund,
        result,
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
    
    // Vytvořit BillingServiceCost
    for (const [normalizedServiceName, serviceData] of unitData.services) {
      let service = serviceMap.get(normalizedServiceName)
      
      if (!service) {
        for (const [sName, sData] of serviceMap) {
          if (sName.includes(normalizedServiceName) || normalizedServiceName.includes(sName)) {
            service = sData
            break
          }
        }
      }
      
      if (!service) continue
      
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
  }
  
  console.log(`\n✅ HOTOVO!`)
  console.log(`   📊 Vytvořeno ${createdResults} výsledků vyúčtování`)
  console.log(`   📋 Vytvořeno ${createdServiceCosts} nákladů služeb`)
  console.log(`   🏠 Budova: ${building.name}`)
  console.log(`   📅 Rok: ${year}`)
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ Chyba:', e)
  process.exit(1)
})
