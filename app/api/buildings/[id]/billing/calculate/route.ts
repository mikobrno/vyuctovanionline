import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { BillingCalculator } from '@/lib/billing-calculator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const { id } = await params
    const { year } = await req.json()

    if (!year) {
      return NextResponse.json({ message: 'Chybí rok vyúčtování' }, { status: 400 })
    }

    console.log(`[API] Spouštím výpočet vyúčtování pro budovu ${id}, rok ${year}`)

    const calculator = new BillingCalculator(id, parseInt(year))
    const billingPeriod = await calculator.calculate()

    return NextResponse.json({
      success: true,
      message: `Vyúčtování pro rok ${year} bylo úspěšně vypočteno`,
      billingPeriodId: billingPeriod.id,
    })
  } catch (error) {
    console.error('[Billing calculate]', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Chyba při výpočtu vyúčtování',
      },
      { status: 500 }
    )
  }
}
