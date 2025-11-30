
import { read, utils } from 'xlsx'
import * as fs from 'fs'

const filePath = 'public/import/vyuctovani2024.xlsx'

if (!fs.existsSync(filePath)) {
  console.error('File not found')
  process.exit(1)
}

const buffer = fs.readFileSync(filePath)
const workbook = read(buffer, { type: 'buffer' })
const sheet = workbook.Sheets['EXPORT_FULL']

if (!sheet) {
  console.error('Sheet EXPORT_FULL not found')
  process.exit(1)
}

const data = utils.sheet_to_json<any>(sheet)

// Find rows for "Byt-č.-20801"
const unitRows = data.filter(r => r.UnitName === 'Byt-č.-20801')

console.log('--- Rows for Byt-č.-20801 ---')
for (const row of unitRows) {
  if (row.DataType === 'COST') {
    console.log(`Key: "${row.Key}", Val1: "${row.Val1}", Val2: "${row.Val2}", Val3: "${row.Val3}", Val8: "${row.Val8}"`)
  }
}

// Check if there is any column that looks like "Jednotka"
console.log('\n--- First row keys ---')
console.log(Object.keys(data[0]))
