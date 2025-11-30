
import { read, utils } from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const importDir = path.join(process.cwd(), 'public/import')

async function main() {
  if (!fs.existsSync(importDir)) {
    console.log(`Directory not found: ${importDir}`)
    return
  }

  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.xlsx'))
  if (files.length === 0) {
    console.log('No XLSX files found in public/import')
    return
  }
  // Prefer the one with "vyuctovani" in name
  const file = files.find(f => f.includes('vyuctovani')) || files[0]
  const filePath = path.join(importDir, file)
  console.log(`Inspecting ${filePath}`)

  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'EXPORT_FULL')
  
  if (!sheetName) {
    console.log('Sheet EXPORT_FULL not found')
    console.log('Available sheets:', workbook.SheetNames)
    return
  }

  const sheet = workbook.Sheets[sheetName]
  // Get raw data as array of arrays
  const json = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

  console.log('--- HEADERS (Row 0) ---')
  console.log(JSON.stringify(json[0], null, 2))

  console.log('--- ROW 1 ---')
  console.log(JSON.stringify(json[1], null, 2))

  // Find column indices
  const headers = json[0].map(h => String(h).trim())
  const dataTypeIdx = headers.findIndex(h => h.toUpperCase() === 'DATATYPE')
  const keyIdx = headers.findIndex(h => h.toUpperCase() === 'KEY')
  const val1Idx = headers.findIndex(h => h.toUpperCase() === 'VAL1')
  const val2Idx = headers.findIndex(h => h.toUpperCase() === 'VAL2')

  console.log(`Indices: DataType=${dataTypeIdx}, Key=${keyIdx}, Val1=${val1Idx}, Val2=${val2Idx}`)

  if (dataTypeIdx !== -1) {
    // Search for specific values
    const searchValues = ['Ohřev']
    console.log(`\nSearching for rows containing: ${searchValues.join(', ')}`)
    
    const foundRows = json.filter(row => 
      row.some(cell => searchValues.some(sv => String(cell).includes(sv)))
    )
    
    console.log(`Found ${foundRows.length} rows:`)
    foundRows.slice(0, 5).forEach((row, i) => {
      console.log(`\n--- Match ${i+1} ---`)
      console.log(`DataType: ${row[dataTypeIdx]}`)
      console.log(`Key: ${row[keyIdx]}`)
      console.log(`Val1: ${row[val1Idx]}`)
      console.log(`Val5: ${row[val1Idx + 4]}`) // Val5 is 4 columns after Val1
      console.log(`Full row: ${JSON.stringify(row)}`)
    })
  }
}

main()
