import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateServiceDistribution } from '@/lib/calculationEngine'
import { prisma } from '@/lib/prisma'

/**
 * API endpoint pro testování dynamického výpočetního enginu
 * 
 * POST /api/buildings/[id]/calculate-test
 * Body: { serviceId: string, period: number, totalCost: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const { id: buildingId } = await params
    const { serviceId, period, totalCost } = await req.json()

    if (!serviceId || !period || totalCost === undefined) {
      return NextResponse.json(
        { message: 'Chybí povinné parametry (serviceId, period, totalCost)' },
        { status: 400 }
      )
    }

    console.log(`[Calculation Engine Test] Building: ${buildingId}, Service: ${serviceId}, Period: ${period}, Cost: ${totalCost}`)

    // Zavolání dynamického výpočetního enginu
    const results = await calculateServiceDistribution(
      serviceId,
      buildingId,
      period,
      totalCost
    )

    // Statistiky
    const totalDistributed = results.reduce((sum, r) => sum + r.amount, 0)
    const difference = totalCost - totalDistributed

    return NextResponse.json({
      success: true,
      message: 'Výpočet úspěšně proveden',
      data: {
        totalCost,
        totalDistributed: Math.round(totalDistributed * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        numberOfUnits: results.length,
        results: results.map(r => ({
          unitId: r.unitId,
          unitName: r.unitName,
          amount: r.amount,
          formula: r.formula,
          breakdown: r.breakdown,
        })),
      },
    })
  } catch (error) {
    console.error('[Calculation Engine Test Error]', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Chyba při výpočtu',
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint pro spuštění výpočtu pro všechny služby v budově
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const buildingId = params.id;
  const periodId = req.nextUrl.searchParams.get('periodId');

  if (!buildingId || !periodId) {
    return NextResponse.json({ error: 'Missing buildingId or periodId' }, { status: 400 });
  }

  try {
    // Načtení všech služeb pro budovu
    const services = await prisma.service.findMany({
      where: { buildingId },
    });

    const results = [];

    for (const service of services) {
      // Načtení celkových nákladů pro službu
      const cost = await prisma.cost.findFirst({
        where: { serviceId: service.id, period: parseInt(periodId, 10) },
      });

      if (!cost) {
        results.push({
          serviceId: service.id,
          serviceName: service.name,
          error: 'No cost data found',
        });
        continue;
      }

      // Spuštění výpočtu pro službu
      const serviceResults = await calculateServiceDistribution(
        service.id,
        buildingId,
        parseInt(periodId, 10),
        cost.amount
      );

      results.push({
        serviceId: service.id,
        serviceName: service.name,
        results: serviceResults,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error during calculation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
