import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
const BUILDING_INFO_UNIT_NAME = '__BUILDING__'

/**
 * API endpoint pro export dat ve formátu EXPORT_FULL
 * 
 * Query parametry:
 * - buildingId: ID budovy (povinné, nebo buildingName)
 * - buildingName: Název budovy (volitelné - použije se pokud není buildingId)
 * - year: Rok vyúčtování (povinné)
 * - format: 'json' (default) nebo 'csv'
 * 
 * Příklady:
 * GET /api/export-full/data?buildingId=xxx&year=2024
 * GET /api/export-full/data?buildingName=Kníničky%20318&year=2024
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    let buildingId = searchParams.get('buildingId')
    const buildingName = searchParams.get('buildingName')
    const yearParam = searchParams.get('year')
    const format = searchParams.get('format') || 'json'

    // Validace parametrů
    if (!buildingId && !buildingName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chybí parametr buildingId nebo buildingName' 
      }, { status: 400 })
    }

    if (!yearParam) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chybí parametr year' 
      }, { status: 400 })
    }

    const year = parseInt(yearParam, 10)
    if (isNaN(year)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Neplatný formát roku' 
      }, { status: 400 })
    }

    // Najít budovu podle názvu, pokud není buildingId
    if (!buildingId && buildingName) {
      const building = await prisma.building.findFirst({
        where: { 
          name: { contains: buildingName, mode: 'insensitive' }
        },
        select: { id: true, name: true }
      })

      if (!building) {
        return NextResponse.json({ 
          success: false, 
          error: `Budova "${buildingName}" nebyla nalezena` 
        }, { status: 404 })
      }
      buildingId = building.id
    }

    const building = await prisma.building.findUnique({
      where: { id: buildingId! },
      select: { id: true, name: true, address: true, bankAccount: true }
    })

    if (!building) {
      return NextResponse.json({
        success: false,
        error: 'Budova nebyla nalezena'
      }, { status: 404 })
    }

    // Najít billing period
    const billingPeriod = await prisma.billingPeriod.findFirst({
      where: { 
        buildingId: building.id,
        year 
      },
      select: { id: true }
    })

    if (!billingPeriod) {
      return NextResponse.json({ 
        success: false, 
        error: `Vyúčtování za rok ${year} pro tuto budovu neexistuje` 
      }, { status: 404 })
    }

    // Načíst všechny výsledky vyúčtování
    const results = await prisma.billingResult.findMany({
      where: { billingPeriodId: billingPeriod.id },
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

    // Převést na EXPORT_FULL formát
    const exportRows: ExportFullRow[] = []

    if (building.bankAccount || building.address || building.name) {
      exportRows.push({
        UnitName: BUILDING_INFO_UNIT_NAME,
        DataType: 'BUILDING_INFO',
        Key: 'BuildingBankAccount',
        Val1: building.bankAccount || '',
        Val2: building.address || '',
        Val3: building.name || '',
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

    for (const result of results) {
      const unit = result.unit
      const ownership = unit.ownerships[0]
      const owner = ownership?.owner

      // 1. INFO řádek
      const summaryJson = result.summaryJson ? JSON.parse(result.summaryJson) : {}
      
      exportRows.push({
        UnitName: unit.unitNumber,
        DataType: 'INFO',
        Key: 'Detail',
        Val1: owner ? `${owner.firstName} ${owner.lastName}`.trim() : summaryJson.ownerName || '',
        Val2: unit.variableSymbol || summaryJson.variableSymbol || '',
        Val3: owner?.email || summaryJson.email || '',
        Val4: formatNumber(result.result),
        Val5: unit.bankAccount || owner?.bankAccount || summaryJson.bankAccount || '',
        Val6: summaryJson.resultNote || '',
        Val7: '',
        Val8: '',
        Val9: '',
        Val10: '',
        Val11: '',
        Val12: '',
        Val13: '',
        SourceRow: ''
      })

      // 2. COST řádky pro každou službu
      for (const sc of result.serviceCosts) {
        if (sc.calculationType === 'METER') continue // Měřidla zpracujeme zvlášť

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

      // 3. METER řádky (z meterReadingsJson nebo z serviceCosts s typem METER)
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

      // Také kontrola meterReadings v serviceCosts
      for (const sc of result.serviceCosts) {
        if (sc.meterReadings) {
          try {
            const meters = JSON.parse(sc.meterReadings) as MeterReadingJson[]
            for (const meter of meters) {
              // Kontrola, že jsme tento meter ještě nepřidali
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
          } catch { /* ignore invalid JSON */ }
        }
      }

      // 4. PAYMENT_MONTHLY řádek
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

      // 5. ADVANCE_MONTHLY řádek
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

    // Vrátit data ve zvoleném formátu
    if (format === 'csv') {
      const csv = convertToCSV(exportRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="EXPORT_FULL_${year}.csv"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      buildingId,
      year,
      rowCount: exportRows.length,
      unitCount: results.length,
      data: exportRows
    })

  } catch (error) {
    console.error('EXPORT_FULL data error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba' 
    }, { status: 500 })
  }
}

// Typy
interface ExportFullRow {
  UnitName: string
  DataType: 'INFO' | 'COST' | 'METER' | 'PAYMENT_MONTHLY' | 'ADVANCE_MONTHLY' | 'FIXED_PAYMENT' | 'BUILDING_INFO'
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

// Helper funkce
function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (value === 0) return ''
  // České formátování s čárkou jako desetinným oddělovačem
  return value.toLocaleString('cs-CZ', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  })
}

function convertToCSV(rows: ExportFullRow[]): string {
  const headers = [
    'UnitName', 'DataType', 'Key',
    'Val1', 'Val2', 'Val3', 'Val4', 'Val5', 'Val6', 'Val7',
    'Val8', 'Val9', 'Val10', 'Val11', 'Val12', 'Val13', 'SourceRow'
  ]
  
  const csvRows = [headers.join(';')]
  
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h as keyof ExportFullRow] || ''
      // Escapovat hodnoty s čárkou nebo středníkem
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    })
    csvRows.push(values.join(';'))
  }
  
  return '\ufeff' + csvRows.join('\r\n') // BOM pro Excel UTF-8
}
