import { read, utils } from 'xlsx'
import * as fs from 'fs'

const buffer = fs.readFileSync('D:/Projekty/vyuctovanionline-1/JSON/vyuctovani2024.xlsx')
const workbook = read(buffer, { type: 'buffer' })

console.log('=== LISTY V SOUBORU ===')
console.log(workbook.SheetNames.join(', '))

const exportSheet = workbook.SheetNames.find(n => 
  n.toLowerCase().includes('export_full') || 
  n.toLowerCase().replace(/[\s_-]/g, '').includes('exportfull')
)

if (exportSheet) {
  console.log('\n=== NALEZEN LIST: ' + exportSheet + ' ===')
  const sheet = workbook.Sheets[exportSheet]
  const data = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  
  console.log('\nPočet řádků:', data.length)
  console.log('\nPrvních 10 řádků:')
  data.slice(0, 10).forEach((row, i) => {
    console.log('Řádek ' + i + ':', JSON.stringify((row as unknown[]).slice(0, 12)))
  })
  
  const types: Record<string, number> = {}
  data.slice(1).forEach(row => {
    const r = row as unknown[]
    const type = String(r[1] || '').toUpperCase().trim()
    if (type) {
      types[type] = (types[type] || 0) + 1
    }
  })
  console.log('\nTypy řádků (DataType):', JSON.stringify(types, null, 2))
} else {
  console.log('\n❌ List EXPORT_FULL NEBYL NALEZEN')
  console.log('\nDostupné listy:', workbook.SheetNames)
  
  // Ukážeme strukturu všech listů
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const data = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
    console.log(`\n--- List "${sheetName}" (${data.length} řádků) ---`)
    data.slice(0, 3).forEach((row, i) => {
      console.log('Řádek ' + i + ':', JSON.stringify((row as unknown[]).slice(0, 10)))
    })
  })
}
