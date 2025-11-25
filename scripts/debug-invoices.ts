import { read, utils } from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const filePath = path.join(process.cwd(), 'public', 'vyuctovani2024 (20).xlsx')
  console.log(`Reading file: ${filePath}`)
  
  const buffer = fs.readFileSync(filePath)
  const workbook = read(buffer, { type: 'buffer' })
  
  const invoicesSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('faktur') || name.toLowerCase().includes('invoice')
  )

  if (!invoicesSheetName) {
    console.error('Invoices sheet not found!')
    return
  }
  console.log(`Invoices sheet found: "${invoicesSheetName}"`)

  const sheet = workbook.Sheets[invoicesSheetName]
  const rawData = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  console.log('--- SHEET PREVIEW (First 20 rows) ---')
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i] as unknown[]
    console.log(`Row ${i}:`, row.slice(0, 15).map(c => String(c)))
  }
  
  // Logic from route.ts
  const idxService = 0;
  const idxMethod = 2;
  const idxAmount = 4;
  
  console.log('--- PARSING ATTEMPT ---')
  
  const looksLikeHeader = (value: string) => /služb|způsob|jednotk|popis|souhrn|celkem|záloha|jednotka č|jednotka c|náklad/.test(value.toLowerCase())

  let detectedStartIndex = rawData.findIndex(row => {
    const arr = row as unknown[]
    const serviceCell = String(arr[idxService] ?? '').trim()
    const methodCell = String(arr[idxMethod] ?? '').trim()
    const amountCell = String(arr[idxAmount] ?? '').trim()
    
    // Simple number check
    const amountVal = parseFloat(amountCell.replace(/\s/g, '').replace(',', '.'))
    
    if (!serviceCell) return false
    if (looksLikeHeader(serviceCell)) return false
    // FIX: Check if method cell looks like a header
    if (looksLikeHeader(methodCell)) return false
    
    if (/^jednotka\s*c?\.?/.test(serviceCell.toLowerCase())) return false
    if (/prázdn/i.test(serviceCell) || /součet|sum/i.test(serviceCell)) return false
    if (/služba|název|položka/i.test(serviceCell)) return false
    
    return Boolean(!isNaN(amountVal) || methodCell.length > 0)
  })
  
  console.log(`Detected start index: ${detectedStartIndex}`)
  
  if (detectedStartIndex !== -1) {
      for (let i = detectedStartIndex; i < Math.min(detectedStartIndex + 20, rawData.length); i++) {
          const row = rawData[i] as unknown[]
          const service = String(row[idxService] ?? '')
          const amount = String(row[idxAmount] ?? '')
          console.log(`Row ${i}: Service="${service}", Amount="${amount}"`)
      }
  }
}

main()
  .catch(e => console.error(e))
