
import { read, utils } from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const filePath = path.join(process.cwd(), 'public', 'vyuctovani2024 (20).xlsx')

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath)
  process.exit(1)
}

const buffer = fs.readFileSync(filePath)
const workbook = read(buffer, { type: 'buffer' })

console.log('Sheet Names:', workbook.SheetNames)

// Check "Vodoměry SV"
const svSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('vodoměry sv'))
if (svSheetName) {
  console.log(`\n--- Checking Vodoměry SV Sheet: ${svSheetName} ---`)
  const sheet = workbook.Sheets[svSheetName]
  const data = utils.sheet_to_json(sheet, { header: 1 })
  data.slice(0, 20).forEach((row: any, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row))
  })
}
