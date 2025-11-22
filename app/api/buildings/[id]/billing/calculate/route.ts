import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { calculateBillingForBuilding } from '@/lib/billingEngine'

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

    const result = await calculateBillingForBuilding(id, parseInt(year))

    return NextResponse.json({
      success: true,
      message: `Vyúčtování pro rok ${year} bylo úspěšně vypočteno`,
      details: result,
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
