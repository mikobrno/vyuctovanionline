import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Nemáte oprávnění mazat vyúčtování' }, { status: 403 })
    }

    const { id } = await params

    const billingPeriod = await prisma.billingPeriod.findUnique({
      where: { id },
      include: {
        building: {
          select: { name: true },
        },
        _count: {
          select: {
            results: true,
            serviceCosts: true,
          },
        },
      },
    })

    if (!billingPeriod) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno' }, { status: 404 })
    }

    await prisma.billingPeriod.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `Vyúčtování ${billingPeriod.year} pro dům "${billingPeriod.building.name}" bylo smazáno.`,
      counts: {
        results: billingPeriod._count.results,
        serviceCosts: billingPeriod._count.serviceCosts,
      },
    })
  } catch (error) {
    console.error('Error deleting billing period:', error)
    return NextResponse.json(
      { error: 'Chyba při mazání vyúčtování' },
      { status: 500 }
    )
  }
}
