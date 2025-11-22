import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateBillingForBuilding } from '@/lib/billingEngine'
import { prisma } from '@/lib/prisma'

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
    const result = await calculateBillingForBuilding(buildingId, period)

    // Načíst agregované výsledky pro odpověď
    const billingResults = await prisma.billingResult.findMany({
      where: { billingPeriodId: result.billingPeriod.id }
    });

    const serviceCosts = await prisma.billingServiceCost.findMany({
      where: { billingPeriodId: result.billingPeriod.id },
      include: { service: true }
    });

    const totalCosts = billingResults.reduce((sum, r) => sum + r.totalCost, 0);
    const totalAdvances = billingResults.reduce((sum, r) => sum + r.totalAdvancePaid, 0);
    const totalBalance = billingResults.reduce((sum, r) => sum + r.result, 0);

    // Seskupit náklady podle služeb
    const serviceMap = new Map<string, { name: string, code: string, totalCost: number }>();
    
    for (const sc of serviceCosts) {
      const existing = serviceMap.get(sc.serviceId) || { 
        name: sc.service.name, 
        code: sc.service.code || '', 
        totalCost: 0 
      };
      existing.totalCost += sc.unitCost;
      serviceMap.set(sc.serviceId, existing);
    }

    const servicesSummary = Array.from(serviceMap.values());

    return NextResponse.json({
      success: true,
      message: `Vyúčtování pro rok ${period} bylo úspěšně vygenerováno`,
      data: {
        summary: {
          totalCosts: totalCosts,
          totalDistributed: totalCosts,
          totalAdvances: totalAdvances,
          totalBalance: totalBalance
        },
        numberOfUnits: result.processedUnits,
        numberOfServices: servicesSummary.length,
        services: servicesSummary,
        billingPeriodId: result.billingPeriod.id,
        generatedAt: new Date()
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
