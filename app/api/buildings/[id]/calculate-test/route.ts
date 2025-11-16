import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateServiceDistribution } from '@/lib/calculationEngine'

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
