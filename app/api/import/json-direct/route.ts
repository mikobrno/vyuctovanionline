import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * API endpoint pro přímý import EXPORT_FULL dat jako JSON
 * Používá se z Office Scripts přes Power Automate nebo přímo
 * 
 * POST /api/import/json-direct
 * Body: {
 *   buildingName: string,
 *   year: number,
 *   data: ExportFullRow[]
 * }
 */

interface ExportFullRow {
  UnitName: string
  DataType: string
  Key: string
  Val1?: string
  Val2?: string
  Val3?: string
  Val4?: string
  Val5?: string
  Val6?: string
  Val7?: string
  Val8?: string
  Val9?: string
  Val10?: string
  Val11?: string
  Val12?: string
  Val13?: string
  SourceRow?: string
}

interface ImportPayload {
  buildingName: string
  year: number
  data: ExportFullRow[]
}

function parseMoney(value: string | undefined): number {
  if (!value) return 0
  const str = value.toString().replace(/[^\d,.\-]/g, '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

function normalizeUnitName(name: string): string {
  return name
    .toLowerCase()
    .replace(/byt[-\s]*č\.?\s*/gi, '')
    .replace(/jednotka[-\s]*č\.?\s*/gi, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, '')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const body: ImportPayload = await req.json()
    
    const { buildingName, year, data } = body

    // Validace
    if (!buildingName) {
      return NextResponse.json({ success: false, error: 'Chybí buildingName' }, { status: 400 })
    }
    if (!year || isNaN(year)) {
      return NextResponse.json({ success: false, error: 'Chybí nebo neplatný year' }, { status: 400 })
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Chybí nebo prázdná data' }, { status: 400 })
    }

    console.log(`[JSON Import] Přijato ${data.length} řádků pro "${buildingName}" rok ${year}`)

    // Najít nebo vytvořit budovu
    let building = await prisma.building.findFirst({
      where: { name: { contains: buildingName, mode: 'insensitive' } }
    })

    if (!building) {
      // Vytvořit novou budovu
      building = await prisma.building.create({
        data: {
          name: buildingName,
          address: buildingName,
          city: 'Brno',
          zip: '60200'
        }
      })
      console.log(`[JSON Import] Vytvořena nová budova: ${building.id}`)
    }

    // Najít nebo vytvořit billing period
    let billingPeriod = await prisma.billingPeriod.findFirst({
      where: { buildingId: building.id, year }
    })

    if (!billingPeriod) {
      billingPeriod = await prisma.billingPeriod.create({
        data: {
          buildingId: building.id,
          year,
          status: 'DRAFT'
        }
      })
      console.log(`[JSON Import] Vytvořeno období: ${billingPeriod.id}`)
    }

    // Smazat existující výsledky
    await prisma.billingServiceCost.deleteMany({ where: { billingPeriodId: billingPeriod.id } })
    await prisma.billingResult.deleteMany({ where: { billingPeriodId: billingPeriod.id } })

    // Seskupit data podle jednotek
    const unitDataMap = new Map<string, {
      info: ExportFullRow | null
      costs: ExportFullRow[]
      meters: ExportFullRow[]
      payments: ExportFullRow | null
      advances: ExportFullRow | null
      fixed: ExportFullRow[]
    }>()

    for (const row of data) {
      const unitName = row.UnitName?.trim()
      if (!unitName) continue

      if (!unitDataMap.has(unitName)) {
        unitDataMap.set(unitName, {
          info: null,
          costs: [],
          meters: [],
          payments: null,
          advances: null,
          fixed: []
        })
      }

      const ud = unitDataMap.get(unitName)!
      
      switch (row.DataType?.toUpperCase()) {
        case 'INFO':
          ud.info = row
          break
        case 'COST':
          ud.costs.push(row)
          break
        case 'METER':
          ud.meters.push(row)
          break
        case 'PAYMENT_MONTHLY':
          ud.payments = row
          break
        case 'ADVANCE_MONTHLY':
          ud.advances = row
          break
        case 'FIXED_PAYMENT':
          ud.fixed.push(row)
          break
      }
    }

    console.log(`[JSON Import] Nalezeno ${unitDataMap.size} jednotek`)

    // Vytvořit/aktualizovat jednotky a výsledky
    let createdUnits = 0
    let createdResults = 0
    let createdServices = 0

    for (const [unitName, ud] of unitDataMap) {
      // Přeskočit neplatné jednotky
      if (!unitName || unitName === '0' || /^\d+$/.test(unitName)) continue

      // Najít nebo vytvořit jednotku
      let unit = await prisma.unit.findFirst({
        where: {
          buildingId: building.id,
          unitNumber: unitName
        }
      })

      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            buildingId: building.id,
            unitNumber: unitName,
            type: 'APARTMENT',
            shareNumerator: 1,
            shareDenominator: 100,
            totalArea: 50,
            variableSymbol: ud.info?.Val2 || undefined,
            bankAccount: ud.info?.Val5 || undefined
          }
        })
        createdUnits++
      }

      // Vytvořit/aktualizovat vlastníka
      if (ud.info?.Val1) {
        const ownerName = ud.info.Val1.trim()
        const nameParts = ownerName.split(' ')
        const firstName = nameParts[0] || ownerName
        const lastName = nameParts.slice(1).join(' ') || ''

        let owner = await prisma.owner.findFirst({
          where: {
            firstName: { contains: firstName, mode: 'insensitive' },
            lastName: { contains: lastName, mode: 'insensitive' }
          }
        })

        if (!owner) {
          owner = await prisma.owner.create({
            data: {
              firstName,
              lastName,
              email: ud.info.Val3 || undefined,
              bankAccount: ud.info.Val5 || undefined
            }
          })
        }

        // Vytvořit vlastnictví
        const existingOwnership = await prisma.ownership.findFirst({
          where: { unitId: unit.id, ownerId: owner.id }
        })

        if (!existingOwnership) {
          await prisma.ownership.create({
            data: {
              unitId: unit.id,
              ownerId: owner.id,
              validFrom: new Date(`${year}-01-01`),
              sharePercent: 100
            }
          })
        }
      }

      // Spočítat součty
      let totalCost = 0
      let totalAdvance = 0
      let repairFund = 0

      for (const cost of ud.costs) {
        totalCost += parseMoney(cost.Val2) // Náklad byt
        totalAdvance += parseMoney(cost.Val3) // Záloha
      }

      for (const fixed of ud.fixed) {
        if (fixed.Key?.toLowerCase().includes('fond')) {
          repairFund += parseMoney(fixed.Val1)
        }
      }

      const totalResult = parseMoney(ud.info?.Val4) || (totalAdvance - totalCost)

      // Měsíční data
      const monthlyPayments: number[] = []
      const monthlyPrescriptions: number[] = []

      if (ud.payments) {
        for (let i = 0; i < 12; i++) {
          const key = `Val${i + 1}` as keyof ExportFullRow
          monthlyPayments.push(parseMoney(ud.payments[key] as string))
        }
      }

      if (ud.advances) {
        for (let i = 0; i < 12; i++) {
          const key = `Val${i + 1}` as keyof ExportFullRow
          monthlyPrescriptions.push(parseMoney(ud.advances[key] as string))
        }
      }

      // Měřidla
      const meterReadings = ud.meters.map(m => ({
        service: m.Key || '',
        serial: m.Val1 || '',
        start: parseMoney(m.Val2),
        end: parseMoney(m.Val3),
        consumption: parseMoney(m.Val4)
      }))

      // Vytvořit BillingResult
      const billingResult = await prisma.billingResult.create({
        data: {
          billingPeriodId: billingPeriod.id,
          unitId: unit.id,
          totalCost,
          totalAdvancePrescribed: totalAdvance,
          totalAdvancePaid: monthlyPayments.reduce((a, b) => a + b, 0) || totalAdvance,
          repairFund,
          result: totalResult,
          monthlyPrescriptions: monthlyPrescriptions.length > 0 ? monthlyPrescriptions : undefined,
          monthlyPayments: monthlyPayments.length > 0 ? monthlyPayments : undefined,
          meterReadingsJson: meterReadings.length > 0 ? meterReadings : undefined,
          summaryJson: JSON.stringify({
            ownerName: ud.info?.Val1 || '',
            variableSymbol: ud.info?.Val2 || '',
            email: ud.info?.Val3 || '',
            bankAccount: ud.info?.Val5 || ''
          })
        }
      })
      createdResults++

      // Vytvořit BillingServiceCost pro každou službu
      for (const cost of ud.costs) {
        const serviceName = cost.Key?.trim()
        if (!serviceName) continue

        // Najít nebo vytvořit službu
        let service = await prisma.service.findFirst({
          where: {
            buildingId: building.id,
            name: { equals: serviceName, mode: 'insensitive' }
          }
        })

        if (!service) {
          const code = serviceName.substring(0, 10).toUpperCase().replace(/\s+/g, '_')
          service = await prisma.service.create({
            data: {
              buildingId: building.id,
              name: serviceName,
              code: code + '_' + Date.now().toString().slice(-4),
              methodology: 'OWNERSHIP_SHARE'
            }
          })
        }

        // Měřidla pro tuto službu
        const serviceMeters = meterReadings.filter(m => 
          m.service.toLowerCase().includes(serviceName.toLowerCase()) ||
          serviceName.toLowerCase().includes(m.service.toLowerCase())
        )

        await prisma.billingServiceCost.create({
          data: {
            billingPeriodId: billingPeriod.id,
            billingResultId: billingResult.id,
            serviceId: service.id,
            unitId: unit.id,
            buildingTotalCost: parseMoney(cost.Val1),
            unitCost: parseMoney(cost.Val2),
            unitAdvance: parseMoney(cost.Val3),
            unitBalance: parseMoney(cost.Val4),
            distributionBase: cost.Val5 || undefined,
            buildingUnits: cost.Val6 || undefined,
            unitPrice: cost.Val7 || undefined,
            unitUnits: cost.Val8 || undefined,
            distributionShare: cost.Val9 || undefined,
            calculationType: 'COST',
            meterReadings: serviceMeters.length > 0 ? JSON.stringify(serviceMeters) : undefined
          }
        })
        createdServices++
      }
    }

    // Aktualizovat status období
    await prisma.billingPeriod.update({
      where: { id: billingPeriod.id },
      data: { 
        status: 'CALCULATED',
        calculatedAt: new Date()
      }
    })

    console.log(`[JSON Import] Hotovo: ${createdUnits} jednotek, ${createdResults} výsledků, ${createdServices} služeb`)

    return NextResponse.json({
      success: true,
      buildingId: building.id,
      buildingName: building.name,
      billingPeriodId: billingPeriod.id,
      year,
      stats: {
        rowsReceived: data.length,
        unitsProcessed: unitDataMap.size,
        unitsCreated: createdUnits,
        resultsCreated: createdResults,
        servicesCreated: createdServices
      }
    })

  } catch (error) {
    console.error('[JSON Import] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba' 
    }, { status: 500 })
  }
}
