
import { read, utils } from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function stripUnitPrefixes(value: string) {
  return value
    .replace(/^(jednotka|byt|nebytový prostor|nebyt\.|ateliér|atelier|garáž|garaz|sklep|bazén|bazen)\s*(č\.?|c\.?)?\s*/gi, '')
    .replace(/^(č\.?|c\.?)\s*/gi, '')
    .trim()
}

async function main() {
  const filePath = path.join(process.cwd(), 'public', 'vyuctovani2024 (20).xlsx')
  console.log(`Reading file: ${filePath}`)
  
  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  
  const buildingName = 'Neptun' // Hardcoded for test
  const building = await prisma.building.findFirst({
    where: { name: { contains: buildingName, mode: 'insensitive' } }
  })
  
  if (!building) {
    console.error('Building not found')
    return
  }
  console.log(`Building: ${building.name} (${building.id})`)

  console.log('All Sheet Names:', workbook.SheetNames)
  
  let advancesSheetName = workbook.SheetNames.find(name => {
    const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
    return n === 'předpis po mesici' || n === 'predpis po mesici'
  })
  
  if (!advancesSheetName) {
     advancesSheetName = workbook.SheetNames.find(name => {
        const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
        return n.includes('zálohy') || n.includes('zalohy')
     })
  }

  if (!advancesSheetName) {
    console.error('Advances sheet not found!')
    return
  }
  console.log(`Advances sheet found: "${advancesSheetName}"`)

  const advancesSheet = workbook.Sheets[advancesSheetName]
  const rawData = utils.sheet_to_json<unknown[]>(advancesSheet, { header: 1, defval: null })
  
  console.log('--- COLUMN 0 VALUES (First 100 rows) ---')
  for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i] as unknown[]
    const col0 = String(row[0] ?? '').trim()
    if (col0 && col0 !== '0' && col0 !== 'null') {
       console.log(`Row ${i}: "${col0}"`)
    }
  }
  console.log('---------------------------------------------------')

  // --- LOGIKA Z ROUTE.TS ---
  
  const serviceMapping: { serviceId: string, colIndex: number, serviceName: string }[] = []
  
  // 1. Mapování z definice služeb (sloupec M ve Fakturách)
  const servicesWithAdvanceCol = await prisma.service.findMany({
     where: { buildingId: building.id, advancePaymentColumn: { not: null } }
  })
  
  console.log(`Services with advance col: ${servicesWithAdvanceCol.length}`)
  
  if (servicesWithAdvanceCol.length > 0) {
     for (const s of servicesWithAdvanceCol) {
        if (s.advancePaymentColumn) {
           try {
              let colIndex = -1
              if (/^\d+$/.test(s.advancePaymentColumn)) {
                colIndex = parseInt(s.advancePaymentColumn, 10)
              } else {
                colIndex = utils.decode_col(s.advancePaymentColumn)
              }
              
              console.log(`Service ${s.name}: Col "${s.advancePaymentColumn}" -> Index ${colIndex}`)
              
              if (colIndex >= 0) {
                 serviceMapping.push({ serviceId: s.id, colIndex, serviceName: s.name })
              }
           } catch (e) {
              console.error(`Error decoding col for ${s.name}:`, e)
           }
        }
     }
  }

  if (serviceMapping.length === 0) {
    console.log('No service mapping found. Fallback logic would run here (skipped for test).')
    return
  }

  console.log(`Using mapping for ${serviceMapping.length} services.`)

  // Load units for mapping
  const allUnits = await prisma.unit.findMany({ where: { buildingId: building.id } })
  const unitMap = new Map<string, any>()
  allUnits.forEach(u => {
    unitMap.set(u.unitNumber, u)
    unitMap.set(stripUnitPrefixes(u.unitNumber), u)
  })

  let foundCount = 0
  
  for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex] as unknown[]
    if (!row || row.length === 0) continue
    
    const cellValue = String(row[0] ?? '').trim()
    if (!cellValue) continue

    const stripped = stripUnitPrefixes(cellValue)
    const unit = unitMap.get(cellValue) || unitMap.get(stripped)
    
    if (!unit) {
        // console.log(`Row ${rowIndex}: Unit not found for "${cellValue}"`)
        continue
    }

    for (const mapping of serviceMapping) {
       for (let month = 1; month <= 12; month++) {
          const monthColIndex = mapping.colIndex + (month - 1)
          let amount = 0
          if (monthColIndex < row.length) {
             const val = row[monthColIndex]
             amount = parseFloat(String(val ?? '').replace(',', '.').replace(/\s/g, '')) || 0
          }

          if (amount > 0) {
             foundCount++
             if (foundCount <= 5) {
                console.log(`Found advance: Unit ${unit.unitNumber}, Service ${mapping.serviceName}, Month ${month}, Amount ${amount} (Row ${rowIndex}, Col ${monthColIndex})`)
             }
          }
       }
    }
  }
  
  console.log(`Total advances found in Excel: ${foundCount}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
