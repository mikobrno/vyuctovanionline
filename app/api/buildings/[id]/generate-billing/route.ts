import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { generateAndSaveBilling } from '@/lib/billingEngine'

/**
 * API endpoint pro generování kompletního vyúčtování
 * 
 * POST /api/buildings/[id]/generate-billing
 * Body: { period: number }
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
    const { period } = await req.json()

    if (!period) {
      return NextResponse.json(
        { message: 'Chybí povinný parametr: period (rok)' },
        { status: 400 }
      )
    }

    console.log(`[Generate Billing API] Building: ${buildingId}, Period: ${period}`)

    // Generovat vyúčtování pomocí billing enginu
    const result = await generateAndSaveBilling(buildingId, period)

    return NextResponse.json({
      success: true,
      message: `Vyúčtování pro rok ${period} bylo úspěšně vygenerováno`,
      data: {
        billingPeriodId: result.billingPeriod.id,
        summary: result.billing.summary,
        numberOfUnits: result.billing.units.length,
        numberOfServices: result.billing.services.length,
        services: result.billing.services.map(s => ({
          name: s.serviceName,
          code: s.serviceCode,
          totalCost: s.totalCost
        })),
        generatedAt: result.billing.generatedAt
      }
    })
  } catch (error) {
    console.error('[Generate Billing API Error]', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Chyba při generování vyúčtování',
      },
      { status: 500 }
    )
  }
}
