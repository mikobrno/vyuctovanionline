/**
 * Script pro výpis dat z portálu ve formátu EXPORT_FULL
 * 
 * Použití:
 *   npx tsx scripts/read-export-full.ts "Kníničky 318" 2024
 *   npx tsx scripts/read-export-full.ts --buildingId=clxxxxxx 2024
 *   npx tsx scripts/read-export-full.ts "Kníničky 318" 2024 --csv
 * 
 * Parametry:
 *   buildingName - název budovy (nebo --buildingId=xxx pro ID)
 *   year - rok vyúčtování
 *   --csv - výstup jako CSV (volitelné)
 *   --json - výstup jako JSON (výchozí)
 *   --summary - pouze souhrn bez detailů
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

interface ExportFullRow {
  UnitName: string
  DataType: 'INFO' | 'COST' | 'METER' | 'PAYMENT_MONTHLY' | 'ADVANCE_MONTHLY' | 'FIXED_PAYMENT'
  Key: string
  Val1: string
  Val2: string
  Val3: string
  Val4: string
  Val5: string
  Val6: string
  Val7: string
  Val8: string
  Val9: string
  Val10: string
  Val11: string
  Val12: string
  Val13: string
  SourceRow: string
}

interface ApiResponse {
  success: boolean
  buildingId?: string
  year?: number
  rowCount?: number
  unitCount?: number
  data?: ExportFullRow[]
  error?: string
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log('Použití:')
    console.log('  npx tsx scripts/read-export-full.ts "Kníničky 318" 2024')
    console.log('  npx tsx scripts/read-export-full.ts --buildingId=clxxxxxx 2024')
    console.log('  npx tsx scripts/read-export-full.ts "Kníničky 318" 2024 --csv')
    console.log('  npx tsx scripts/read-export-full.ts "Kníničky 318" 2024 --summary')
    process.exit(1)
  }

  // Parsovat argumenty
  let buildingName: string | null = null
  let buildingId: string | null = null
  let year: number | null = null
  let format = 'json'
  let summaryOnly = false

  for (const arg of args) {
    if (arg.startsWith('--buildingId=')) {
      buildingId = arg.split('=')[1]
    } else if (arg === '--csv') {
      format = 'csv'
    } else if (arg === '--json') {
      format = 'json'
    } else if (arg === '--summary') {
      summaryOnly = true
    } else if (/^\d{4}$/.test(arg)) {
      year = parseInt(arg, 10)
    } else if (!arg.startsWith('--')) {
      buildingName = arg
    }
  }

  if (!year) {
    console.error('❌ Chybí rok (např. 2024)')
    process.exit(1)
  }

  if (!buildingId && !buildingName) {
    console.error('❌ Chybí název budovy nebo --buildingId')
    process.exit(1)
  }

  // Sestavit URL
  const params = new URLSearchParams()
  if (buildingId) {
    params.set('buildingId', buildingId)
  } else if (buildingName) {
    params.set('buildingName', buildingName)
  }
  params.set('year', year.toString())
  params.set('format', format)

  const url = `${BASE_URL}/api/export-full/data?${params.toString()}`
  
  console.log(`🚀 Načítám data z: ${url}\n`)

  try {
    const response = await fetch(url)
    
    if (format === 'csv') {
      // CSV formát - vypsat přímo
      const text = await response.text()
      if (!response.ok) {
        console.error('❌ Chyba:', text)
        process.exit(1)
      }
      console.log(text)
      return
    }

    // JSON formát
    const result: ApiResponse = await response.json()

    if (!result.success) {
      console.error('❌ Chyba:', result.error)
      process.exit(1)
    }

    console.log(`✅ Načteno ${result.rowCount} řádků pro ${result.unitCount} jednotek\n`)

    if (summaryOnly || !result.data) {
      // Pouze souhrn
      console.log('📊 Souhrn:')
      console.log(`   Building ID: ${result.buildingId}`)
      console.log(`   Rok: ${result.year}`)
      console.log(`   Počet jednotek: ${result.unitCount}`)
      console.log(`   Počet řádků: ${result.rowCount}`)
      
      if (result.data) {
        const infoRows = result.data.filter(r => r.DataType === 'INFO')
        const costRows = result.data.filter(r => r.DataType === 'COST')
        const meterRows = result.data.filter(r => r.DataType === 'METER')
        const paymentRows = result.data.filter(r => r.DataType === 'PAYMENT_MONTHLY')
        const advanceRows = result.data.filter(r => r.DataType === 'ADVANCE_MONTHLY')
        const fixedRows = result.data.filter(r => r.DataType === 'FIXED_PAYMENT')
        
        console.log(`\n📈 Rozložení dat:`)
        console.log(`   INFO:            ${infoRows.length}`)
        console.log(`   COST:            ${costRows.length}`)
        console.log(`   METER:           ${meterRows.length}`)
        console.log(`   PAYMENT_MONTHLY: ${paymentRows.length}`)
        console.log(`   ADVANCE_MONTHLY: ${advanceRows.length}`)
        console.log(`   FIXED_PAYMENT:   ${fixedRows.length}`)
        
        // Unikátní jednotky
        const units = [...new Set(infoRows.map(r => r.UnitName))]
        console.log(`\n🏠 Jednotky (${units.length}):`)
        for (const unit of units.slice(0, 10)) {
          const info = infoRows.find(r => r.UnitName === unit)
          const costs = costRows.filter(r => r.UnitName === unit)
          console.log(`   ${unit}: ${info?.Val1 || '(bez vlastníka)'} - ${costs.length} služeb`)
        }
        if (units.length > 10) {
          console.log(`   ... a dalších ${units.length - 10} jednotek`)
        }
      }
      return
    }

    // Detailní výpis
    console.log('=' .repeat(100))
    console.log('UnitName'.padEnd(20) + 'DataType'.padEnd(18) + 'Key'.padEnd(25) + 'Val1'.padEnd(15) + 'Val2'.padEnd(15) + 'Val3'.padEnd(15) + 'Val4')
    console.log('=' .repeat(100))

    let currentUnit = ''
    for (const row of result.data) {
      // Oddělení mezi jednotkami
      if (row.UnitName !== currentUnit) {
        if (currentUnit) console.log('-'.repeat(100))
        currentUnit = row.UnitName
      }

      const line = [
        row.UnitName.substring(0, 19).padEnd(20),
        row.DataType.padEnd(18),
        row.Key.substring(0, 24).padEnd(25),
        row.Val1.substring(0, 14).padEnd(15),
        row.Val2.substring(0, 14).padEnd(15),
        row.Val3.substring(0, 14).padEnd(15),
        row.Val4.substring(0, 14)
      ].join('')

      console.log(line)
    }

    console.log('=' .repeat(100))
    console.log(`\n✅ Celkem ${result.rowCount} řádků`)

  } catch (error) {
    console.error('❌ Chyba při volání API:', error)
    process.exit(1)
  }
}

main()
