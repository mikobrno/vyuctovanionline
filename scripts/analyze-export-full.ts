import { read, utils } from 'xlsx'
import * as fs from 'fs'

// Načíst Excel a analyzovat strukturu EXPORT_FULL
const filePath = 'public/import/vyuctovani2024.xlsx'

if (!fs.existsSync(filePath)) {
  console.log('Soubor nenalezen, zkouším alternativy...')
  const altFiles = fs.readdirSync('public/import')
  console.log('Dostupné soubory:', altFiles)
  process.exit(1)
}

const buffer = fs.readFileSync(filePath)
const workbook = read(buffer, { type: 'buffer' })

console.log('Listy v souboru:', workbook.SheetNames)

// Najít EXPORT_FULL - přesná shoda
const exportSheet = workbook.SheetNames.find(n => 
  n === 'EXPORT_FULL' || n.toLowerCase() === 'export_full'
)

if (!exportSheet) {
  console.log('EXPORT_FULL nenalezen')
  process.exit(1)
}

console.log('\n=== List:', exportSheet, '===')
const sheet = workbook.Sheets[exportSheet]
const data = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

console.log('\nPrvní řádek (hlavičky):')
console.log(data[0])

console.log('\nPrvních 20 řádků dat:')
for (let i = 1; i < Math.min(21, data.length); i++) {
  const row = data[i] as unknown[]
  console.log(`[${i}] ${row.slice(0, 6).map(v => String(v).substring(0, 25)).join(' | ')}`)
}
