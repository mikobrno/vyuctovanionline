import { read, utils } from 'xlsx'
import * as fs from 'fs'

const buffer = fs.readFileSync('JSON/vyuctovani2024 s makrem import.xlsx')
const workbook = read(buffer, { type: 'buffer' })
const sheet = workbook.Sheets['EXPORT_FULL']
const data = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

console.log('Počet řádků:', data.length)
console.log('\nPrvních 5 řádků:')
data.slice(0, 5).forEach((row, i) => {
  const r = row as unknown[]
  console.log(`Row ${i}:`, r.slice(0, 10))
})

console.log('\nVšechny unikátní DataType (sloupec B):')
const types = new Set<string>()
data.slice(1).forEach(row => {
  const r = row as unknown[]
  if (r[1]) types.add(String(r[1]))
})
console.log([...types])

// Hledám řádky které obsahují měsíční data
console.log('\nHledám řádky s měsíčními daty (ADVANCE, PAYMENT, MONTHLY):')
let foundMonthly = false
data.forEach((row, i) => {
  const r = row as unknown[]
  const dataType = String(r[1] || '').toUpperCase()
  if (dataType.includes('ADVANCE') || dataType.includes('PAYMENT') || dataType.includes('MONTHLY')) {
    console.log(`Row ${i}:`, r.slice(0, 15))
    foundMonthly = true
  }
})
if (!foundMonthly) {
  console.log('  -> Žádné nenalezeny')
}

// Ukázat posledních 20 řádků
console.log('\nPosledních 20 řádků:')
data.slice(-20).forEach((row, i) => {
  const r = row as unknown[]
  const idx = data.length - 20 + i
  if (r[0] || r[1]) { // jen neprázdné
    console.log(`Row ${idx}:`, r.slice(0, 8))
  }
})
