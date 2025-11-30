/**
 * Test skript pro import snapshot
 * npx tsx scripts/test-snapshot-import.ts
 */

import * as fs from 'fs'
import * as path from 'path'

async function testSnapshotImport() {
  const filePath = path.join(__dirname, '../JSON/vyuctovani2024.xlsx')
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Soubor neexistuje:', filePath)
    process.exit(1)
  }
  
  console.log('📁 Načítám soubor:', filePath)
  
  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  const formData = new FormData()
  formData.append('file', blob, 'vyuctovani2024.xlsx')
  formData.append('year', '2024')
  
  console.log('📤 Posílám na server...')
  
  try {
    const response = await fetch('http://localhost:3000/api/import/snapshot', {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    console.log('')
    console.log('Status:', response.status)
    console.log('')
    console.log(JSON.stringify(result, null, 2))
    
    if (result.success) {
      console.log('')
      console.log('✅ Import úspěšný!')
      console.log('   Budova:', result.building?.name, result.building?.created ? '(NOVÁ)' : '(existující)')
      console.log('   Rok:', result.year)
      console.log('   Jednotek v Excelu:', result.summary?.unitsInExcel)
      console.log('   BillingResults:', result.summary?.billingResultsCreated)
      console.log('   ServiceCosts:', result.summary?.serviceCostsCreated)
    } else {
      console.log('')
      console.log('❌ Import selhal:', result.error)
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('')
      console.log('⚠️  Varování:')
      result.warnings.forEach((w: string) => console.log('   -', w))
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('')
      console.log('❌ Chyby:')
      result.errors.forEach((e: string) => console.log('   -', e))
    }
    
  } catch (error) {
    console.error('❌ Chyba:', error)
  }
}

testSnapshotImport()
