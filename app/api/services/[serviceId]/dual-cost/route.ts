import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - načte nastavení duálních nákladů pro službu a rok
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params
    const url = new URL(request.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear() - 1))
    
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        building: {
          include: {
            units: {
              select: {
                id: true,
                unitNumber: true,
              },
              orderBy: { unitNumber: 'asc' }
            }
          }
        }
      }
    })
    
    if (!service) {
      return NextResponse.json({ error: 'Služba nenalezena' }, { status: 404 })
    }
    
    // Načteme meterSettings
    let meterSettings: { unitId: string; hasMeter: boolean }[] = []
    try {
      meterSettings = await prisma.unitServiceMeterSetting.findMany({
        where: { serviceId },
        select: { unitId: true, hasMeter: true }
      })
    } catch {
      // Tabulka možná ještě neexistuje
    }
    
    // Načteme roční náklady pro daný rok
    let yearlyCost: { costWithMeter: number | null; costWithoutMeter: number | null } | null = null
    try {
      yearlyCost = await prisma.serviceYearlyCost.findUnique({
        where: {
          serviceId_year: { serviceId, year }
        },
        select: { costWithMeter: true, costWithoutMeter: true }
      })
    } catch {
      // Tabulka možná ještě neexistuje
    }
    
    // Vytvoříme mapu jednotek s nastavením vodoměru
    const unitSettings = service.building.units.map(unit => {
      const setting = meterSettings.find(ms => ms.unitId === unit.id)
      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        hasMeter: setting?.hasMeter ?? true // výchozí = má vodoměr
      }
    })
    
    return NextResponse.json({
      serviceId: service.id,
      serviceName: service.name,
      year,
      useDualCost: service.useDualCost ?? false,
      // Použijeme roční náklady, pokud existují, jinak fallback na službu
      costWithMeter: yearlyCost?.costWithMeter ?? service.costWithMeter ?? null,
      costWithoutMeter: yearlyCost?.costWithoutMeter ?? service.costWithoutMeter ?? null,
      guidanceNumber: service.guidanceNumber ?? 35,
      unitSettings
    })
    
  } catch (error) {
    console.error('Error fetching dual cost settings:', error)
    return NextResponse.json({ 
      error: 'Chyba při načítání nastavení',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST - uloží nastavení duálních nákladů pro daný rok
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params
    const body = await request.json()
    
    const {
      year,
      useDualCost,
      costWithMeter,
      costWithoutMeter,
      guidanceNumber,
      unitSettings // [{ unitId, hasMeter }]
    } = body
    
    const yearNum = year || new Date().getFullYear() - 1
    
    // Aktualizujeme základní nastavení služby (useDualCost a guidanceNumber jsou globální)
    await prisma.service.update({
      where: { id: serviceId },
      data: {
        useDualCost: useDualCost ?? false,
        guidanceNumber: guidanceNumber ?? 35,
        // Fallback: ukládáme náklady přímo do Service pokud ServiceYearlyCost není dostupná
        costWithMeter: costWithMeter ?? null,
        costWithoutMeter: costWithoutMeter ?? null,
      }
    })
    
    // Zkusíme uložit roční náklady (pokud tabulka existuje)
    try {
      await prisma.serviceYearlyCost.upsert({
        where: {
          serviceId_year: { serviceId, year: yearNum }
        },
        update: {
          costWithMeter: costWithMeter ?? null,
          costWithoutMeter: costWithoutMeter ?? null,
        },
        create: {
          serviceId,
          year: yearNum,
          costWithMeter: costWithMeter ?? null,
          costWithoutMeter: costWithoutMeter ?? null,
        }
      })
    } catch (e) {
      console.log('ServiceYearlyCost table not available, using Service table fallback')
    }
    
    // Aktualizujeme nastavení vodoměrů pro jednotky (toto je globální, ne per rok)
    if (Array.isArray(unitSettings)) {
      try {
        for (const setting of unitSettings) {
          await prisma.unitServiceMeterSetting.upsert({
            where: {
              unitId_serviceId: {
                unitId: setting.unitId,
                serviceId: serviceId
              }
            },
            update: {
              hasMeter: setting.hasMeter
            },
            create: {
              unitId: setting.unitId,
              serviceId: serviceId,
              hasMeter: setting.hasMeter
            }
          })
        }
      } catch (e) {
        console.log('UnitServiceMeterSetting table not available:', e)
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Nastavení pro rok ${yearNum} uloženo`
    })
    
  } catch (error) {
    console.error('Error saving dual cost settings:', error)
    return NextResponse.json({ 
      error: 'Chyba při ukládání nastavení',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
