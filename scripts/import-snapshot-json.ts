/**
 * import-snapshot-json.ts
 * 
 * Importuje EXPORT_FULL z Excelu (XLSX) nebo CSV do databáze.
 * Excel/CSV -> JSON v paměti -> Prisma DB
 * 
 * Použití:
 *   npx tsx scripts/import-snapshot-json.ts [cesta-k-souboru] [rok]
 *   npx tsx scripts/import-snapshot-json.ts "public/import/vyuctovani2024.xlsx" 2024
 */

import { parse } from 'csv-parse/sync'
import { read, utils } from 'xlsx'
import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// 1. POMOCNÁ FUNKCE parseCzNumber
// ============================================================================

/**
 * Parsuje české formáty čísel z Excelu
 * Vstup: "5 420,00 Kč", "#NAME?", " ", null, undefined, nebo číslo
 * Výstup: číslo (Float) nebo 0
 */
function parseCzNumber(val: unknown): number {
  // Null, undefined, prázdné
  if (val === null || val === undefined || val === '') return 0
  
  // Už je číslo
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  
  const str = String(val).trim()
  
  // Excel chyby: #NAME?, #N/A, #REF!, #VALUE!, #DIV/0!
  if (str.startsWith('#')) return 0
  
  // Prázdné nebo pomlčka
  if (str === '' || str === '-' || str === '—') return 0
  
  // Vyčistit:
  // - Odstranit "Kč" a jednotky
  // - Odstranit mezery (včetně nedělitelných \u00A0)
  // - Nahradit čárku tečkou
  let cleaned = str
    .replace(/\s*Kč\s*/gi, '')
    .replace(/\s*m[²³]?\s*/gi, '')
    .replace(/\s*kWh\s*/gi, '')
    .replace(/\s*GJ\s*/gi, '')
    .replace(/[\s\u00A0]/g, '')  // mezery + nedělitelné mezery
    .replace(',', '.')
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Zachová hodnotu jako string pro věrný tisk v PDF.
 * Vrátí undefined pokud je hodnota prázdná nebo chybová.
 */
function preserveAsString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const str = String(value).trim()
  if (!str || str.startsWith('#') || str === 'N/A' || str === 'null' || str === 'undefined' || str === '-') {
    return undefined
  }
  return str
}

// ============================================================================
// 2. STRUKTURA JSON V PAMĚTI
// ============================================================================

interface UnitInfo {
  owner?: string
  email?: string
  vs?: string
  address?: string
  bankAccount?: string // číslo účtu pro přeplatek
  balance: number      // výsledek (přeplatek/nedoplatek)
  totalCost: number    // celkový náklad
  totalAdvance: number // celková záloha
  repairFund: number   // fond oprav
}

interface CostItem {
  service: string      // název služby
  buildingTotal: number // náklad domu
  cost: number         // náklad jednotky
  advance: number      // záloha jednotky
  balance: number      // rozdíl (záloha - náklad)
  consumption?: number // spotřeba jednotky
  buildingConsumption?: number // spotřeba domu
  unitPrice?: number   // cena za jednotku (číslo)
  share?: string       // rozúčtovací základ (Podíl)
  unitText?: string    // text jednotky (např. "vlastnický podíl")
  // NOVÁ POLE PRO VĚRNÝ TISK Z EXCELU (jako String pro zachování formátu)
  buildingUnits?: string  // Jednotek (dům) - Val6
  unitPriceStr?: string   // Kč/jedn - Val7 (jako string)
  unitUnits?: string      // Jednotek (byt) - Val8
}

interface MeterItem {
  service: string      // název služby (k párování s costs)
  serial: string       // výrobní číslo měřidla
  start: number        // počáteční stav
  end: number          // konečný stav
  diff: number         // spotřeba (rozdíl)
}

interface UnitData {
  unitName: string
  info: UnitInfo
  costs: CostItem[]
  meters: MeterItem[]
  monthly: number[]    // 12 měsíčních záloh
}

// ============================================================================
// 3. NAČTENÍ A PARSOVÁNÍ (CSV nebo XLSX)
// ============================================================================

interface RawRecord {
  UnitName?: string
  DataType?: string
  Key?: string
  Val1?: string
  Val2?: string
  Val3?: string
  Val4?: string
  Val5?: string
  Val6?: string
  Val7?: string
  Val8?: string
  Val9?: string
  Val10?: string
  Val11?: string
  Val12?: string
  [key: string]: unknown
}

function loadFromFile(filePath: string): RawRecord[] {
  console.log(`📂 Načítám: ${filePath}`)
  
  if (filePath.endsWith('.csv')) {
    // CSV soubor
    const content = fs.readFileSync(filePath, 'utf-8')
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    })
  } else {
    // Excel soubor
    const buffer = fs.readFileSync(filePath)
    const workbook = read(buffer, { type: 'buffer' })
    
    // Najít list EXPORT_FULL
    const sheetName = workbook.SheetNames.find(n => 
      n === 'EXPORT_FULL' || n.toLowerCase() === 'export_full'
    )
    
    if (!sheetName) {
      throw new Error(`List EXPORT_FULL nenalezen. Dostupné listy: ${workbook.SheetNames.join(', ')}`)
    }
    
    console.log(`📋 Používám list: ${sheetName}`)
    
    const sheet = workbook.Sheets[sheetName]
    return utils.sheet_to_json<RawRecord>(sheet, { defval: '' })
  }
}

function loadToJson(filePath: string): Map<string, UnitData> {
  const records = loadFromFile(filePath)
  console.log(`📋 Načteno ${records.length} řádků`)
  
  const unitsData = new Map<string, UnitData>()
  
  for (const row of records) {
    const unitName = String(row.UnitName || '').trim()
    if (!unitName) continue
    
    const dataType = String(row.DataType || '').toUpperCase().trim()
    const key = String(row.Key || '').trim()
    
    // Inicializace jednotky
    if (!unitsData.has(unitName)) {
      unitsData.set(unitName, {
        unitName,
        info: {
          balance: 0,
          totalCost: 0,
          totalAdvance: 0,
          repairFund: 0,
        },
        costs: [],
        meters: [],
        monthly: Array(12).fill(0),
      })
    }
    
    const unit = unitsData.get(unitName)!

    // Helper to infer unit text based on service name
    const inferUnitText = (serviceName: string): string => {
      const s = serviceName.toLowerCase()
      if (s.includes('elektrická') || s.includes('úklid') || s.includes('fond')) return 'vlastnický podíl'
      if (s.includes('vodné (teplá')) return 'odečty TUV'
      if (s.includes('vodné (studená')) return 'odečet SV'
      if (s.includes('teplo') || s.includes('ohřev')) return 'externí'
      if (s.includes('správa')) return 'na byt'
      return ''
    }

    // Validace klíče pro COST a METER
    // Ignorovat řádky, kde Key vypadá jako cena, číslo, nebo je to souhrn
    const isInvalidKey = (k: string) => {
      if (!k) return true
      if (k.match(/^[\d\s]+\s*(Kč|kc)/i)) return true // "9 137 Kč" nebo "8 542 Kč"
      if (k.match(/^[\d\s]+([.,]\d+)?$/)) return true // "123.45" nebo "8 542"
      if (k.startsWith('#')) return true // "#N/A"
      if (k.match(/^Celkem/i)) return true // "Celkem náklady..."
      if (k.match(/^K úhradě/i)) return true // "K úhradě za rok"
      if (k.match(/^\d+\/\d{4}$/)) return true // "1/2024"
      if (k.match(/^Měsíce/i)) return true // "Měsíce" je pro ADVANCE_MONTHLY, ale ne pro COST/METER
      return false
    }
    
    switch (dataType) {
      case 'INFO': {
        // NOVÝ FORMÁT: Val1: Jméno vlastníka, Val2: VS, Val3: Email, Val4: Výsledek, Val5: Bankovní účet
        unit.info.owner = row.Val1 || undefined
        unit.info.vs = row.Val2 || undefined
        unit.info.email = row.Val3 || undefined
        unit.info.balance = parseCzNumber(row.Val4)
        unit.info.bankAccount = row.Val5 || undefined
        // Tyto hodnoty nejsou v novém formátu v INFO řádku, dopočítáme z COST řádků později
        // unit.info.totalCost = parseCzNumber(row.Val5)
        // unit.info.totalAdvance = parseCzNumber(row.Val6)
        // unit.info.repairFund = parseCzNumber(row.Val7)
        break
      }
      
      case 'COST': {
        // Key: název služby
        const serviceName = key
        if (isInvalidKey(serviceName)) break
        
        // V11 FORMÁT:
        // Val1=Náklad Dům, Val2=Náklad Byt, Val3=Záloha, Val4=Přeplatek
        // Val5=Spotřeba Dům, Val6=Jednotek Dům, Val7=Kč/jedn, Val8=Jednotek Uživatel
        // Val9=Spotřeba Uživatel, Val10=Podíl/základ
        
        let cost = parseCzNumber(row.Val2)
        const advance = parseCzNumber(row.Val3)
        const balanceFromExcel = parseCzNumber(row.Val4)
        
        // FIX: Pokud je cost 0 a v Excelu je #NAME? nebo chyba, zkusíme to dopočítat
        if (cost === 0 && (advance !== 0 || balanceFromExcel !== 0)) {
          cost = advance - balanceFromExcel
          if (cost !== 0) {
            console.log(`   🔧 Oprava nákladu pro ${serviceName}: Záloha ${advance} - Přeplatek ${balanceFromExcel} = Náklad ${cost}`)
          }
        }

        // Přeskočit nulové služby (cost=0 AND advance=0)
        if (cost === 0 && advance === 0) break
        
        // Načtení textových hodnot pro sloupce jednotek (zachovat formát z Excelu)
        const buildingUnits = preserveAsString(row.Val6)  // Jednotek (dům)
        const unitPriceStr = preserveAsString(row.Val7)   // Kč/jedn
        const unitUnits = preserveAsString(row.Val8)      // Jednotek (byt)
        
        unit.costs.push({
          service: serviceName,
          buildingTotal: parseCzNumber(row.Val1),
          cost,
          advance,
          balance: advance - cost,
          buildingConsumption: parseCzNumber(row.Val5) || undefined,
          consumption: parseCzNumber(row.Val9) || undefined,  // Spotřeba uživatele je ve Val9
          unitPrice: parseCzNumber(row.Val7) || undefined,    // Kč/jedn jako číslo
          share: row.Val10 || undefined,                       // Podíl/základ je ve Val10
          unitText: inferUnitText(serviceName),
          // NOVÁ POLE pro věrný tisk
          buildingUnits,
          unitPriceStr,
          unitUnits,
        })
        break
      }
      
      case 'METER': {
        // Key: název služby
        const serviceName = key
        if (isInvalidKey(serviceName)) break
        
        unit.meters.push({
          service: serviceName,
          serial: row.Val1 || '',
          start: parseCzNumber(row.Val2),
          end: parseCzNumber(row.Val3),
          diff: parseCzNumber(row.Val4),
        })
        break
      }
      
      case 'ADVANCE_MONTHLY': {
        // Val1-Val12: měsíční zálohy
        console.log(`   📅 Měsíční zálohy pro ${unitName}:`)
        for (let m = 1; m <= 12; m++) {
          const val = row[`Val${m}`]
          unit.monthly[m - 1] = parseCzNumber(val)
        }
        console.log(`      -> ${JSON.stringify(unit.monthly)}`)
        break
      }
      
      case 'FUND': {
        // Fond oprav - speciální služba
        const fundName = key || 'Fond oprav'
        const fundAmount = parseCzNumber(row.Val1)
        
        unit.info.repairFund = fundAmount
        
        // Přidat jako službu pokud má hodnotu
        if (fundAmount !== 0) {
          unit.costs.push({
            service: fundName,
            buildingTotal: parseCzNumber(row.Val2),
            cost: fundAmount,
            advance: parseCzNumber(row.Val3),
            balance: parseCzNumber(row.Val3) - fundAmount,
          })
        }
        break
      }
    }
  }
  
  console.log(`✅ Načteno ${unitsData.size} jednotek`)
  return unitsData
}

// ============================================================================
// 4. ULOŽENÍ DO DATABÁZE
// ============================================================================

async function saveToDatabase(unitsData: Map<string, UnitData>, year: number) {
  console.log(`\n💾 Ukládám do databáze pro rok ${year}...`)
  
  // 4.1 Najít budovu podle č.p. z názvů bytů
  const firstUnitName = Array.from(unitsData.keys())[0] || ''
  const cpMatch = firstUnitName.match(/(\d{4})\d$/)
  const cisloPopisne = cpMatch ? cpMatch[1] : null
  
  if (!cisloPopisne) {
    throw new Error(`Nelze extrahovat č.p. z názvu jednotky: ${firstUnitName}`)
  }
  
  console.log(`🔍 Hledám budovu s č.p.: ${cisloPopisne}`)
  
  const building = await prisma.building.findFirst({
    where: {
      OR: [
        { name: { contains: cisloPopisne } },
        { address: { contains: cisloPopisne } },
      ],
    },
    include: { units: true },
  })
  
  if (!building) {
    throw new Error(`Budova s č.p. ${cisloPopisne} nenalezena v databázi`)
  }
  
  console.log(`✅ Budova: ${building.name}`)
  console.log(`   Jednotek v DB: ${building.units.length}`)
  
  // 4.2 Najít/vytvořit BillingPeriod
  const billingPeriod = await prisma.billingPeriod.upsert({
    where: {
      buildingId_year: {
        buildingId: building.id,
        year,
      },
    },
    create: {
      buildingId: building.id,
      year,
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
    update: {
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
  })
  
  console.log(`📅 Billing period: ${billingPeriod.id}`)
  
  // 4.3 Smazat staré výsledky
  await prisma.billingServiceCost.deleteMany({
    where: { billingPeriodId: billingPeriod.id },
  })
  await prisma.billingResult.deleteMany({
    where: { billingPeriodId: billingPeriod.id },
  })
  // Smazat staré náklady pro tento rok, aby se nenačítaly duplicitně
  await prisma.cost.deleteMany({
    where: {
      buildingId: building.id,
      period: year
    }
  })
  console.log('🗑️  Staré výsledky a náklady smazány')
  
  // 4.4 Cache služeb
  const serviceCache = new Map<string, string>()
  
  async function getOrCreateService(serviceName: string): Promise<string> {
    const normalized = serviceName.toLowerCase().trim()
    
    if (serviceCache.has(normalized)) {
      return serviceCache.get(normalized)!
    }
    
    // Hledat existující
    let service = await prisma.service.findFirst({
      where: {
        buildingId: building.id,
        OR: [
          { name: serviceName },
          { name: { equals: serviceName, mode: 'insensitive' } },
          { name: { startsWith: serviceName.substring(0, 15), mode: 'insensitive' } },
        ],
      },
    })
    
    // Vytvořit novou
    if (!service) {
      const code = normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20)
        .toUpperCase()
      
      service = await prisma.service.create({
        data: {
          buildingId: building.id,
          name: serviceName,
          code: code + '_' + Date.now().toString(36),
          methodology: 'OWNERSHIP_SHARE',
          isActive: true,
        },
      })
      console.log(`   ➕ Nová služba: ${serviceName}`)
    }
    
    serviceCache.set(normalized, service.id)
    return service.id
  }
  
  // 4.5 Párování jednotek
  function findUnit(unitName: string) {
    // Normalizovat název
    const normalized = unitName
      .replace(/Byt[-\s]*č\.?\s*/gi, '')
      .replace(/-/g, '/')
      .trim()
    
    return building.units.find(u => {
      const uNorm = u.unitNumber
        .replace(/Byt[-\s]*č\.?\s*/gi, '')
        .replace(/-/g, '/')
        .trim()
      
      return uNorm === normalized || 
             u.unitNumber === unitName ||
             uNorm.includes(normalized) ||
             normalized.includes(uNorm)
    })
  }
  
  // 4.6 Iterace a ukládání
  let savedUnits = 0
  let savedCosts = 0
  const processedUnitIds = new Set<string>()
  const serviceBuildingCosts = new Map<string, number>()
  
  for (const [unitName, data] of unitsData) {
    const unit = findUnit(unitName)
    
    if (!unit) {
      console.log(`   ⚠️ Jednotka nenalezena: ${unitName}`)
      continue
    }
    
    // Přeskočit pokud už byla zpracována (např. duplicitní mapování)
    if (processedUnitIds.has(unit.id)) {
      console.log(`   ⏭️ Přeskakuji duplicitu: ${unitName} -> ${unit.unitNumber}`)
      continue
    }
    processedUnitIds.add(unit.id)
    
    // Vypočítat celkové hodnoty z costs pokud nejsou v info
    const totalCost = data.info.totalCost || data.costs.reduce((sum, c) => sum + c.cost, 0)
    const totalAdvance = data.info.totalAdvance || data.costs.reduce((sum, c) => sum + c.advance, 0)
    const balance = data.info.balance || (totalAdvance - totalCost)
    
    // Vytvořit nebo najít vlastníka
    let ownerId: string | null = null
    if (data.info.owner) {
      // Parsovat jméno vlastníka (může obsahovat tituly)
      const ownerName = data.info.owner.trim()
      const nameParts = ownerName.split(' ')
      // Předpokládáme formát: [Titul] Jméno Příjmení nebo Jméno Příjmení
      let firstName = ''
      let lastName = ''
      if (nameParts.length >= 2) {
        // Poslední část je příjmení
        lastName = nameParts[nameParts.length - 1]
        // Zbytek je jméno (včetně titulů)
        firstName = nameParts.slice(0, nameParts.length - 1).join(' ')
      } else {
        firstName = ownerName
        lastName = ''
      }
      
      // Najít nebo vytvořit vlastníka podle emailu nebo jména
      const existingOwner = data.info.email 
        ? await prisma.owner.findFirst({ where: { email: data.info.email } })
        : await prisma.owner.findFirst({ where: { firstName, lastName } })
      
      if (existingOwner) {
        ownerId = existingOwner.id
        // Aktualizovat bankovní účet pokud je nový
        if (data.info.bankAccount && !existingOwner.bankAccount) {
          await prisma.owner.update({
            where: { id: existingOwner.id },
            data: { bankAccount: data.info.bankAccount }
          })
        }
      } else {
        const newOwner = await prisma.owner.create({
          data: {
            firstName,
            lastName,
            email: data.info.email || null,
            bankAccount: data.info.bankAccount || null,
          }
        })
        ownerId = newOwner.id
        console.log(`   ✅ Vytvořen vlastník: ${firstName} ${lastName}`)
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
              validFrom: new Date(`${billingPeriod.year}-01-01`),
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
        repairFund: data.info.repairFund,
        result: balance,
        monthlyPrescriptions: data.monthly,
        monthlyPayments: data.monthly, // Předpokládáme, že úhrady = předpisy, pokud není uvedeno jinak
        summaryJson: JSON.stringify({
          owner: data.info.owner,
          email: data.info.email,
          vs: data.info.vs,
          address: data.info.address,
          bankAccount: data.info.bankAccount,
        }),
      },
    })
    
    savedUnits++
    
    // Vytvořit BillingServiceCost pro každou službu
    for (const costItem of data.costs) {
      const serviceId = await getOrCreateService(costItem.service)
      
      // Uložit celkový náklad na budovu pro tuto službu (pokud ještě nemáme nebo je větší)
      // Předpokládáme, že buildingTotal je stejný pro všechny jednotky, ale pro jistotu vezmeme max
      const currentMax = serviceBuildingCosts.get(serviceId) || 0
      if (costItem.buildingTotal > currentMax) {
        serviceBuildingCosts.set(serviceId, costItem.buildingTotal)
      }
      
      // Najít měřidla pro tuto službu
      const serviceMeters = data.meters.filter(m => {
        const mService = m.service.toLowerCase()
        const cService = costItem.service.toLowerCase()
        return mService === cService || 
               mService.includes(cService.substring(0, 10)) ||
               cService.includes(mService.substring(0, 10))
      })
      
      await prisma.billingServiceCost.create({
        data: {
          billingPeriodId: billingPeriod.id,
          billingResultId: billingResult.id,
          serviceId,
          unitId: unit.id,
          buildingTotalCost: costItem.buildingTotal,
          buildingConsumption: costItem.buildingConsumption || null,
          unitConsumption: costItem.consumption || null,
          unitCost: costItem.cost,
          unitAdvance: costItem.advance,
          unitBalance: costItem.balance,
          unitPricePerUnit: costItem.unitPrice || null,
          distributionBase: costItem.share || null,
          calculationBasis: costItem.unitText || null, // Uložíme text jednotky sem
          // NOVÁ POLE pro věrný tisk z Excelu
          buildingUnits: costItem.buildingUnits || null,
          unitPrice: costItem.unitPriceStr || null,
          unitUnits: costItem.unitUnits || null,
          meterReadings: serviceMeters.length > 0 
            ? JSON.stringify(serviceMeters.map(m => ({
                serial: m.serial,
                start: m.start,
                end: m.end,
                consumption: m.diff,
              })))
            : null,
          calculationType: serviceMeters.length > 0 ? 'METER' : 'COST',
        },
      })
      
      savedCosts++
    }
  }

  // 4.7 Vytvořit záznamy nákladů budovy (Cost)
  console.log(`💰 Vytvářím ${serviceBuildingCosts.size} záznamů nákladů budovy...`)
  for (const [serviceId, amount] of serviceBuildingCosts) {
    if (amount > 0) {
      await prisma.cost.create({
        data: {
          buildingId: building.id,
          serviceId,
          amount,
          description: 'Import z Excelu (EXPORT_FULL)',
          invoiceDate: new Date(year, 11, 31), // 31.12.
          period: year,
        }
      })
    }
  }
  
  console.log('✅ Import dokončen!')
  console.log(`   📊 Jednotek: ${savedUnits}`)
  console.log(`   💰 Nákladů služeb: ${savedCosts}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  
  // Výchozí cesta
  let filePath = args[0] || 'public/import/vyuctovani2024.xlsx'
  const year = parseInt(args[1] || '2024', 10)
  
  // Zkusit najít soubor
  if (!fs.existsSync(filePath)) {
    // Zkusit v public/import
    const altPath = `public/import/${filePath}`
    if (fs.existsSync(altPath)) {
      filePath = altPath
    } else {
      // Najít jakýkoliv XLSX nebo CSV
      const importDir = 'public/import'
      if (fs.existsSync(importDir)) {
        const files = fs.readdirSync(importDir)
        const exportFile = files.find(f => 
          (f.includes('vyuctovani') || f.includes('EXPORT')) && 
          (f.endsWith('.xlsx') || f.endsWith('.csv'))
        )
        if (exportFile) {
          filePath = `${importDir}/${exportFile}`
        }
      }
    }
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Soubor nenalezen: ${filePath}`)
    console.log('\nPoužití:')
    console.log('  npx tsx scripts/import-snapshot-json.ts <cesta-k-souboru> [rok]')
    console.log('  npx tsx scripts/import-snapshot-json.ts "public/import/vyuctovani2024.xlsx" 2024')
    process.exit(1)
  }
  
  console.log('='.repeat(60))
  console.log('📥 IMPORT SNAPSHOT Z EXCELU/CSV')
  console.log('='.repeat(60))
  console.log(`📂 Soubor: ${filePath}`)
  console.log(`📅 Rok: ${year}`)
  console.log('')
  
  try {
    // Načíst do JSON struktury
    const unitsData = loadToJson(filePath)
    
    // Debug: Vypsat první jednotku
    const firstUnit = Array.from(unitsData.values())[0]
    if (firstUnit) {
      console.log('\n📋 Ukázka dat (první jednotka):')
      console.log(`   Název: ${firstUnit.unitName}`)
      console.log(`   Vlastník: ${firstUnit.info.owner || 'N/A'}`)
      console.log(`   Výsledek: ${firstUnit.info.balance} Kč`)
      console.log(`   Služeb: ${firstUnit.costs.length}`)
      console.log(`   Měřidel: ${firstUnit.meters.length}`)
      console.log(`   Měsíční zálohy: ${firstUnit.monthly.filter(m => m > 0).length} nenulových`)
    }
    
    // Uložit do DB
    await saveToDatabase(unitsData, year)
    
  } catch (error) {
    console.error('❌ Chyba při importu:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
