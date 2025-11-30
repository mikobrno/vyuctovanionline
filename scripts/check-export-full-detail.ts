import { read, utils } from 'xlsx'
import * as fs from 'fs'

const buffer = fs.readFileSync('D:/Projekty/vyuctovanionline-1/JSON/vyuctovani2024.xlsx')
const workbook = read(buffer, { type: 'buffer' })
const sheet = workbook.Sheets['EXPORT_FULL']
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

// Hlavička
console.log('=== HLAVIČKA ===')
console.log(data[0])

// Najdi INFO řádky
console.log('\n=== INFO řádky (první 3) ===')
const infoRows = data.filter(r => String(r[1]).toUpperCase() === 'INFO')
infoRows.slice(0, 3).forEach((row, i) => {
  console.log('INFO ' + i + ':', row)
})

// Najdi COST řádky pro první jednotku
console.log('\n=== COST řádky pro Byt-č.-20801 ===')
const costRows = data.filter(r => String(r[0]).includes('20801') && String(r[1]).toUpperCase() === 'COST')
costRows.forEach(row => {
  console.log(row[2], ':', row.slice(3, 8))
})

// Najdi METER řádky pro první jednotku
console.log('\n=== METER řádky pro Byt-č.-20801 ===')
const meterRows = data.filter(r => String(r[0]).includes('20801') && String(r[1]).toUpperCase() === 'METER')
meterRows.forEach(row => {
  console.log(row[2], ':', row.slice(3, 8))
})

// Najdi ADVANCE_MONTHLY řádky
console.log('\n=== ADVANCE_MONTHLY řádky (první 2) ===')
const advanceRows = data.filter(r => String(r[1]).toUpperCase() === 'ADVANCE_MONTHLY')
advanceRows.slice(0, 2).forEach(row => {
  console.log(row[0], ':', row.slice(3, 15))
})
