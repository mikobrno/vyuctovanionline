/**
 * Test API endpointu /api/import/snapshot
 * Simuluje webový import bez nutnosti spouštět dev server
 */

import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'

// Importujeme přímo handler
async function testSnapshotImport() {
  console.log('🧪 Test API endpoint /api/import/snapshot')
  console.log('=' .repeat(60))
  
  // Načíst soubor
  const filePath = path.join(process.cwd(), 'JSON', 'vyuctovani2024 s makrem import.xlsx')
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Soubor nenalezen: ${filePath}`)
    process.exit(1)
  }
  
  console.log(`📂 Soubor: ${filePath}`)
  
  // Musíme použít HTTP požadavek pokud server běží
  const serverUrl = 'http://localhost:3000/api/import/snapshot'
  
  console.log(`🌐 Testuji endpoint: ${serverUrl}`)
  
  // Přečíst soubor jako buffer
  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  // Vytvořit FormData
  const formData = new globalThis.FormData()
  formData.append('file', blob, 'vyuctovani2024 s makrem import.xlsx')
  formData.append('year', '2024')
  
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      body: formData
    })
    
    const data = await response.json()
    
    console.log(`\n📊 Response status: ${response.status}`)
    console.log(`📋 Response:`)
    console.log(JSON.stringify(data, null, 2))
    
    if (data.success) {
      console.log('\n✅ Import úspěšný!')
      console.log(`   📊 Jednotek: ${data.summary?.unitsInExcel}`)
      console.log(`   💾 Výsledků: ${data.summary?.billingResultsCreated}`)
      console.log(`   💰 Nákladů služeb: ${data.summary?.serviceCostsCreated}`)
    } else {
      console.log('\n❌ Import selhal:', data.error)
    }
  } catch (error) {
    console.error('❌ Chyba při volání API:', error)
    console.log('\n💡 Ujistěte se, že dev server běží (npm run dev)')
  }
}

testSnapshotImport()
