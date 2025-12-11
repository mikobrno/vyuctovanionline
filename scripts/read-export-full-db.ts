/**
 * Script pro přímý výpis dat z databáze ve formátu EXPORT_FULL
 * (Nevyžaduje běžící server - přistupuje přímo k DB přes Prisma)
 * 
 * Použití:
 *   npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024
 *   npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024 --summary
 *   npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024 --unit="Byt 1513/01"
 *   npx tsx scripts/read-export-full-db.ts --list-buildings
 * 
 * Parametry:
 *   buildingName - název budovy (částečná shoda)
 *   year - rok vyúčtování
 *   --summary - pouze souhrn bez detailů
 *   --unit="název" - pouze konkrétní jednotka
 *   --list-buildings - vypsat seznam budov
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

interface MeterReadingJson {
  service?: string
  type?: string
  serial?: string
  start?: number
  end?: number
  consumption?: number
}

function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (value === 0) return ''
  return value.toLocaleString('cs-CZ', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  })
}

async function listBuildings() {
  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      _count: {
        select: {
          units: true,
          billingPeriods: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  console.log('\n📋 Seznam budov v databázi:\n')
  console.log('ID'.padEnd(28) + 'Název'.padEnd(30) + 'Jednotek'.padEnd(10) + 'Období')
  console.log('='.repeat(80))
  
  for (const b of buildings) {
    console.log(
      b.id.padEnd(28) + 
      b.name.substring(0, 29).padEnd(30) + 
      b._count.units.toString().padEnd(10) + 
      b._count.billingPeriods.toString()
    )
  }
  console.log()
}

async function getExportFullData(buildingName: string, year: number, unitFilter?: string): Promise<ExportFullRow[]> {
  // Najít budovu
  const building = await prisma.building.findFirst({
    where: { 
      name: { contains: buildingName, mode: 'insensitive' }
    },
    select: { id: true, name: true }
  })

  if (!building) {
    throw new Error(`Budova "${buildingName}" nebyla nalezena`)
  }

  console.log(`\n🏢 Budova: ${building.name} (${building.id})`)

  // Najít billing period
  const billingPeriod = await prisma.billingPeriod.findFirst({
    where: { 
      buildingId: building.id,
      year 
    },
    select: { id: true, status: true, calculatedAt: true }
  })

  if (!billingPeriod) {
    throw new Error(`Vyúčtování za rok ${year} pro budovu "${building.name}" neexistuje`)
  }

  console.log(`📅 Období: ${year} (status: ${billingPeriod.status})`)

  // Načíst výsledky
  const results = await prisma.billingResult.findMany({
    where: { 
      billingPeriodId: billingPeriod.id,
      ...(unitFilter ? {
        unit: {
          unitNumber: { contains: unitFilter, mode: 'insensitive' }
        }
      } : {})
    },
    include: {
      unit: {
        include: {
          ownerships: {
            where: {
              validFrom: { lte: new Date(`${year}-12-31`) },
              OR: [
                { validTo: null },
                { validTo: { gte: new Date(`${year}-01-01`) } }
              ]
            },
            include: { owner: true },
            take: 1
          }
        }
      },
      serviceCosts: {
        include: {
          service: {
            select: { name: true, code: true, order: true }
          }
        },
        orderBy: {
          service: { order: 'asc' }
        }
      }
    },
    orderBy: {
      unit: { unitNumber: 'asc' }
    }
  })

  console.log(`📊 Nalezeno ${results.length} výsledků vyúčtování\n`)

  // Převést na EXPORT_FULL formát
  const exportRows: ExportFullRow[] = []

  for (const result of results) {
    const unit = result.unit
    const ownership = unit.ownerships[0]
    const owner = ownership?.owner

    // Parsovat summaryJson
    let summaryJson: Record<string, unknown> = {}
    if (result.summaryJson) {
      try {
        summaryJson = JSON.parse(result.summaryJson)
      } catch { /* ignore */ }
    }

    // 1. INFO řádek
    exportRows.push({
      UnitName: unit.unitNumber,
      DataType: 'INFO',
      Key: 'Detail',
      Val1: owner ? `${owner.firstName} ${owner.lastName}`.trim() : (summaryJson.ownerName as string) || '',
      Val2: unit.variableSymbol || (summaryJson.variableSymbol as string) || '',
      Val3: owner?.email || (summaryJson.email as string) || '',
      Val4: formatNumber(result.result),
      Val5: unit.bankAccount || owner?.bankAccount || (summaryJson.bankAccount as string) || '',
      Val6: (summaryJson.resultNote as string) || '',
      Val7: '',
      Val8: '',
      Val9: '',
      Val10: '',
      Val11: '',
      Val12: '',
      Val13: '',
      SourceRow: ''
    })

    // 2. COST řádky
    for (const sc of result.serviceCosts) {
      if (sc.calculationType === 'METER') continue

      exportRows.push({
        UnitName: unit.unitNumber,
        DataType: 'COST',
        Key: sc.service.name,
        Val1: formatNumber(sc.buildingTotalCost),
        Val2: formatNumber(sc.unitCost),
        Val3: formatNumber(sc.unitAdvance),
        Val4: formatNumber(sc.unitBalance),
        Val5: sc.distributionBase || '',
        Val6: sc.buildingUnits || formatNumber(sc.buildingConsumption),
        Val7: sc.unitPrice || formatNumber(sc.unitPricePerUnit),
        Val8: sc.unitUnits || formatNumber(sc.unitConsumption),
        Val9: sc.distributionShare || '',
        Val10: '',
        Val11: '',
        Val12: '',
        Val13: '',
        SourceRow: ''
      })
    }

    // 3. METER řádky
    const meterReadings = result.meterReadingsJson as MeterReadingJson[] | null
    if (meterReadings && Array.isArray(meterReadings)) {
      for (const meter of meterReadings) {
        exportRows.push({
          UnitName: unit.unitNumber,
          DataType: 'METER',
          Key: meter.service || meter.type || '',
          Val1: meter.serial || '',
          Val2: formatNumber(meter.start),
          Val3: formatNumber(meter.end),
          Val4: formatNumber(meter.consumption),
          Val5: '',
          Val6: '',
          Val7: '',
          Val8: '',
          Val9: '',
          Val10: '',
          Val11: '',
          Val12: '',
          Val13: '',
          SourceRow: ''
        })
      }
    }

    // Kontrola meterReadings v serviceCosts
    for (const sc of result.serviceCosts) {
      if (sc.meterReadings) {
        try {
          const meters = JSON.parse(sc.meterReadings) as MeterReadingJson[]
          for (const meter of meters) {
            const exists = exportRows.some(row => 
              row.UnitName === unit.unitNumber && 
              row.DataType === 'METER' && 
              row.Val1 === (meter.serial || '')
            )
            if (!exists) {
              exportRows.push({
                UnitName: unit.unitNumber,
                DataType: 'METER',
                Key: meter.service || sc.service.name || '',
                Val1: meter.serial || '',
                Val2: formatNumber(meter.start),
                Val3: formatNumber(meter.end),
                Val4: formatNumber(meter.consumption),
                Val5: '',
                Val6: '',
                Val7: '',
                Val8: '',
                Val9: '',
                Val10: '',
                Val11: '',
                Val12: '',
                Val13: '',
                SourceRow: ''
              })
            }
          }
        } catch { /* ignore */ }
      }
    }

    // 4. PAYMENT_MONTHLY
    const monthlyPayments = result.monthlyPayments as number[] | null
    if (monthlyPayments && Array.isArray(monthlyPayments) && monthlyPayments.some(v => v !== 0)) {
      exportRows.push({
        UnitName: unit.unitNumber,
        DataType: 'PAYMENT_MONTHLY',
        Key: 'Úhrady',
        Val1: formatNumber(monthlyPayments[0]),
        Val2: formatNumber(monthlyPayments[1]),
        Val3: formatNumber(monthlyPayments[2]),
        Val4: formatNumber(monthlyPayments[3]),
        Val5: formatNumber(monthlyPayments[4]),
        Val6: formatNumber(monthlyPayments[5]),
        Val7: formatNumber(monthlyPayments[6]),
        Val8: formatNumber(monthlyPayments[7]),
        Val9: formatNumber(monthlyPayments[8]),
        Val10: formatNumber(monthlyPayments[9]),
        Val11: formatNumber(monthlyPayments[10]),
        Val12: formatNumber(monthlyPayments[11]),
        Val13: '',
        SourceRow: ''
      })
    }

    // 5. ADVANCE_MONTHLY
    const monthlyPrescriptions = result.monthlyPrescriptions as number[] | null
    if (monthlyPrescriptions && Array.isArray(monthlyPrescriptions) && monthlyPrescriptions.some(v => v !== 0)) {
      exportRows.push({
        UnitName: unit.unitNumber,
        DataType: 'ADVANCE_MONTHLY',
        Key: 'Předpisy',
        Val1: formatNumber(monthlyPrescriptions[0]),
        Val2: formatNumber(monthlyPrescriptions[1]),
        Val3: formatNumber(monthlyPrescriptions[2]),
        Val4: formatNumber(monthlyPrescriptions[3]),
        Val5: formatNumber(monthlyPrescriptions[4]),
        Val6: formatNumber(monthlyPrescriptions[5]),
        Val7: formatNumber(monthlyPrescriptions[6]),
        Val8: formatNumber(monthlyPrescriptions[7]),
        Val9: formatNumber(monthlyPrescriptions[8]),
        Val10: formatNumber(monthlyPrescriptions[9]),
        Val11: formatNumber(monthlyPrescriptions[10]),
        Val12: formatNumber(monthlyPrescriptions[11]),
        Val13: '',
        SourceRow: ''
      })
    }

    // 6. FIXED_PAYMENT (fond oprav)
    if (result.repairFund && result.repairFund !== 0) {
      exportRows.push({
        UnitName: unit.unitNumber,
        DataType: 'FIXED_PAYMENT',
        Key: 'Fond oprav',
        Val1: formatNumber(result.repairFund),
        Val2: '',
        Val3: '',
        Val4: '',
        Val5: '',
        Val6: '',
        Val7: '',
        Val8: '',
        Val9: '',
        Val10: '',
        Val11: '',
        Val12: '',
        Val13: '',
        SourceRow: ''
      })
    }
  }

  return exportRows
}

async function main() {
  const args = process.argv.slice(2)
  
  // Kontrola --list-buildings
  if (args.includes('--list-buildings')) {
    await listBuildings()
    await prisma.$disconnect()
    return
  }

  if (args.length < 2) {
    console.log('Použití:')
    console.log('  npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024')
    console.log('  npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024 --summary')
    console.log('  npx tsx scripts/read-export-full-db.ts "Kníničky 318" 2024 --unit="Byt 1513/01"')
    console.log('  npx tsx scripts/read-export-full-db.ts --list-buildings')
    await prisma.$disconnect()
    process.exit(1)
  }

  // Parsovat argumenty
  let buildingName: string | null = null
  let year: number | null = null
  let summaryOnly = false
  let unitFilter: string | undefined

  for (const arg of args) {
    if (arg === '--summary') {
      summaryOnly = true
    } else if (arg.startsWith('--unit=')) {
      unitFilter = arg.split('=')[1].replace(/"/g, '')
    } else if (/^\d{4}$/.test(arg)) {
      year = parseInt(arg, 10)
    } else if (!arg.startsWith('--')) {
      buildingName = arg
    }
  }

  if (!year) {
    console.error('❌ Chybí rok (např. 2024)')
    await prisma.$disconnect()
    process.exit(1)
  }

  if (!buildingName) {
    console.error('❌ Chybí název budovy')
    await prisma.$disconnect()
    process.exit(1)
  }

  try {
    const data = await getExportFullData(buildingName, year, unitFilter)
    
    if (summaryOnly) {
      // Souhrn
      const infoRows = data.filter(r => r.DataType === 'INFO')
      const costRows = data.filter(r => r.DataType === 'COST')
      const meterRows = data.filter(r => r.DataType === 'METER')
      const paymentRows = data.filter(r => r.DataType === 'PAYMENT_MONTHLY')
      const advanceRows = data.filter(r => r.DataType === 'ADVANCE_MONTHLY')
      const fixedRows = data.filter(r => r.DataType === 'FIXED_PAYMENT')
      
      console.log(`📈 Rozložení dat (celkem ${data.length} řádků):`)
      console.log(`   INFO:            ${infoRows.length}`)
      console.log(`   COST:            ${costRows.length}`)
      console.log(`   METER:           ${meterRows.length}`)
      console.log(`   PAYMENT_MONTHLY: ${paymentRows.length}`)
      console.log(`   ADVANCE_MONTHLY: ${advanceRows.length}`)
      console.log(`   FIXED_PAYMENT:   ${fixedRows.length}`)
      
      // Unikátní služby
      const services = [...new Set(costRows.map(r => r.Key))]
      console.log(`\n📋 Služby (${services.length}):`)
      for (const svc of services) {
        console.log(`   - ${svc}`)
      }
      
      // Jednotky
      const units = [...new Set(infoRows.map(r => r.UnitName))]
      console.log(`\n🏠 Jednotky (${units.length}):`)
      for (const unit of units.slice(0, 10)) {
        const info = infoRows.find(r => r.UnitName === unit)
        const costs = costRows.filter(r => r.UnitName === unit)
        const totalResult = info?.Val4 || '0'
        console.log(`   ${unit.padEnd(20)} ${(info?.Val1 || '').substring(0, 25).padEnd(26)} Výsledek: ${totalResult.padStart(10)} (${costs.length} služeb)`)
      }
      if (units.length > 10) {
        console.log(`   ... a dalších ${units.length - 10} jednotek`)
      }
    } else {
      // Detailní výpis
      console.log('='.repeat(120))
      console.log(
        'UnitName'.padEnd(20) + 
        'DataType'.padEnd(18) + 
        'Key'.padEnd(28) + 
        'Val1(NáklD)'.padEnd(14) + 
        'Val2(NáklB)'.padEnd(14) + 
        'Val3(Záloh)'.padEnd(14) + 
        'Val4(Výsl)'
      )
      console.log('='.repeat(120))

      let currentUnit = ''
      for (const row of data) {
        if (row.UnitName !== currentUnit) {
          if (currentUnit) console.log('-'.repeat(120))
          currentUnit = row.UnitName
        }

        const line = [
          row.UnitName.substring(0, 19).padEnd(20),
          row.DataType.padEnd(18),
          row.Key.substring(0, 27).padEnd(28),
          row.Val1.substring(0, 13).padEnd(14),
          row.Val2.substring(0, 13).padEnd(14),
          row.Val3.substring(0, 13).padEnd(14),
          row.Val4.substring(0, 13)
        ].join('')

        console.log(line)
      }

      console.log('='.repeat(120))
    }

    console.log(`\n✅ Hotovo! Načteno ${data.length} řádků`)

  } catch (error) {
    console.error('❌ Chyba:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
