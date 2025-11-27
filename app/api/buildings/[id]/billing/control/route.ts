import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: buildingId } = params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Získat všechny služby
    const services = await prisma.service.findMany({
      where: {
        buildingId,
        isActive: true,
      },
      include: {
        costs: {
          where: { period: year },
        },
      },
    })

    // Získat všechny jednotky pro výpočet celkových jednotek
    const units = await prisma.unit.findMany({
      where: { buildingId },
      include: {
        meters: {
          include: {
            readings: {
              where: { period: year },
            },
          },
        },
        personMonths: {
          where: { year },
        },
      },
    })

    // Pro každou službu vypočítat kontrolní údaje
    const controlData = services.map(service => {
      const totalCost = service.costs.reduce((sum, cost) => sum + cost.amount, 0)
      let buildingUnits = 0

      switch (service.methodology) {
        case 'OWNERSHIP_SHARE':
          // Součet všech vlastnických podílů
          buildingUnits = units.reduce((sum, unit) => {
            return sum + (unit.shareNumerator / unit.shareDenominator)
          }, 0)
          break

        case 'AREA':
          // Součet všech ploch
          buildingUnits = units.reduce((sum, unit) => {
            const areaValue = service.areaSource === 'CHARGEABLE_AREA'
              ? (unit.floorArea ?? unit.totalArea ?? 0)
              : (unit.totalArea || 0)
            return sum + areaValue
          }, 0)
          break

        case 'PERSON_MONTHS':
          // Součet všech osobo-měsíců
          buildingUnits = units.reduce((sum, unit) => {
            return sum + unit.personMonths.reduce((s, pm) => s + pm.personCount, 0)
          }, 0)
          break

        case 'METER_READING':
          // Součet všech spotřeb z měřidel
          const meterTypeMap: Record<string, string> = {
            'TEPLO': 'HEATING',
            'TUV': 'HOT_WATER',
            'SV': 'COLD_WATER',
            'ELEKTRINA': 'ELECTRICITY',
          }
          const meterType = meterTypeMap[service.code || ''] || 'HEATING'
          
          buildingUnits = units.reduce((sum, unit) => {
            const meter = unit.meters.find(m => m.type === meterType && m.isActive)
            if (meter && meter.readings.length > 0) {
              return sum + (meter.readings[0].consumption || 0)
            }
            return sum
          }, 0)
          break

        case 'FIXED_PER_UNIT':
        case 'EQUAL_SPLIT':
          // Počet jednotek (bytů)
          buildingUnits = units.length
          break

        case 'NO_BILLING':
          // Nevyúčtovává se
          buildingUnits = 0
          break

        default:
          buildingUnits = 0
      }

      const pricePerUnit = buildingUnits > 0 ? totalCost / buildingUnits : 0

      return {
        id: service.id,
        name: service.name,
        methodology: service.methodology,
        totalCost,
        buildingUnits,
        pricePerUnit,
        measurementUnit: service.measurementUnit,
      }
    })

    return NextResponse.json({
      services: controlData,
      year,
    })

  } catch (error) {
    console.error('Error loading control panel:', error)
    return NextResponse.json(
      { error: 'Failed to load control panel' },
      { status: 500 }
    )
  }
}
