/**
 * Přímý test snapshot importu - pracuje přímo s DB
 * npx tsx scripts/test-snapshot-direct.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { read, utils } from 'xlsx'
import { prisma } from '../lib/prisma'

async function testSnapshotDirect() {
  const filePath = path.join(__dirname, '../JSON/vyuctovani2024.xlsx')
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Soubor neexistuje:', filePath)
    process.exit(1)
  }
  
  console.log('📁 Načítám soubor:', filePath)
  
  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  
  // Najít list EXPORT_FULL
  const exportSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().replace(/[\s_-]/g, '').includes('exportfull')
  )
  
  if (!exportSheetName) {
    console.error('❌ List EXPORT_FULL nenalezen')
    console.log('Dostupné listy:', workbook.SheetNames)
    process.exit(1)
  }
  
  console.log('✓ Nalezen list:', exportSheetName)
  
  const sheet = workbook.Sheets[exportSheetName]
  const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  
  console.log('📊 Řádků:', rawData.length)
  
  // Hlavička
  const headers = (rawData[0] as unknown[]).map(h => String(h || '').trim())
  console.log('Hlavička:', headers)
  
  // Indexy sloupců
  const getColIndex = (name: string) => headers.findIndex(h => 
    h.toLowerCase().includes(name.toLowerCase())
  )
  
  const colUnitName = Math.max(0, getColIndex('UnitName'))
  const colDataType = Math.max(1, getColIndex('DataType'))
  const colKey = Math.max(2, getColIndex('Key'))
  const colVal1 = Math.max(3, getColIndex('Val1'))
  
  console.log(`Sloupce: UnitName=${colUnitName}, DataType=${colDataType}, Key=${colKey}, Val1=${colVal1}`)
  
  // Zjistit první jednotku a adresu
  let firstUnitName = ''
  let firstAddress = ''
  let buildingNumber = ''
  
  for (let i = 1; i < Math.min(rawData.length, 50); i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length === 0) continue
    
    const unitName = String(row[colUnitName] || '').trim()
    const dataType = String(row[colDataType] || '').toUpperCase().trim()
    
    if (unitName && !firstUnitName) {
      firstUnitName = unitName
      // Extrahovat číslo domu
      const allDigits = unitName.match(/(\d+)$/)
      if (allDigits) {
        const digits = allDigits[1]
        if (digits.length >= 5) {
          buildingNumber = digits.substring(0, 4)
        } else if (digits.length >= 4) {
          buildingNumber = digits.substring(0, 3)
        } else {
          buildingNumber = digits
        }
      }
    }
    
    if (dataType === 'INFO' && !firstAddress) {
      const addr = String(row[colVal1] || '').trim()
      if (addr && !addr.includes('#')) {
        firstAddress = addr
      }
    }
    
    if (firstUnitName && firstAddress) break
  }
  
  console.log('')
  console.log('=== DETEKCE BUDOVY ===')
  console.log('První jednotka:', firstUnitName)
  console.log('Číslo domu (z bytu):', buildingNumber)
  console.log('První adresa:', firstAddress)
  
  // Hledat budovu v DB
  console.log('')
  console.log('=== HLEDÁNÍ V DB ===')
  
  const allBuildings = await prisma.building.findMany()
  console.log('Budovy v DB:', allBuildings.map(b => `${b.name} (${b.id})`))
  
  // Zkusit najít podle čísla
  if (buildingNumber) {
    const matchByNumber = allBuildings.filter(b => 
      b.name.includes(buildingNumber) || b.address.includes(buildingNumber)
    )
    console.log(`Shoda podle č.p. "${buildingNumber}":`, matchByNumber.map(b => b.name))
  }
  
  // Zkusit najít podle ulice
  if (firstAddress) {
    const street = firstAddress.split(',')[0].trim().split(' ')[0]
    const matchByStreet = allBuildings.filter(b =>
      b.name.toLowerCase().includes(street.toLowerCase()) ||
      b.address.toLowerCase().includes(street.toLowerCase())
    )
    console.log(`Shoda podle ulice "${street}":`, matchByStreet.map(b => b.name))
  }
  
  await prisma.$disconnect()
}

testSnapshotDirect()
