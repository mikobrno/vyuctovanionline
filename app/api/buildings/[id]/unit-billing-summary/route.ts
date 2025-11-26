import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const searchParams = request.nextUrl.searchParams
    const unitId = searchParams.get('unitId')
    const yearParam = searchParams.get('year')
    const year = yearParam ? Number(yearParam) : NaN

    if (!unitId || !yearParam || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Missing unitId or year' }, { status: 400 })
    }

    const currentPeriod = await prisma.billingPeriod.findFirst({
      where: { buildingId: id, year },
      select: { id: true }
    })

    const previousPeriod = await prisma.billingPeriod.findFirst({
      where: { buildingId: id, year: year - 1 },
      select: { id: true }
    })

    const currentResult = currentPeriod
      ? await prisma.billingResult.findUnique({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: currentPeriod.id,
              unitId,
            },
          },
          select: {
            id: true,
            totalCost: true,
            totalAdvancePrescribed: true,
            totalAdvancePaid: true,
            repairFund: true,
            result: true,
          },
        })
      : null

    const previousResult = previousPeriod
      ? await prisma.billingResult.findUnique({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: previousPeriod.id,
              unitId,
            },
          },
          select: {
            id: true,
            totalCost: true,
            totalAdvancePrescribed: true,
            totalAdvancePaid: true,
            repairFund: true,
            result: true,
          },
        })
      : null

    return NextResponse.json({ current: currentResult, previous: previousResult })
  } catch (error) {
    console.error('Failed to load unit billing summary', error)
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 })
  }
}
