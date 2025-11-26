import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; resultId: string }> }
) {
  const params = await props.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: buildingId, resultId } = params

    const billingResult = await prisma.billingResult.findUnique({
      where: { id: resultId },
      include: {
        billingPeriod: true,
      },
    })

    if (!billingResult) {
      return NextResponse.json({ error: 'Vyúčtování nenalezeno' }, { status: 404 })
    }

    if (billingResult.billingPeriod.buildingId !== buildingId) {
      return NextResponse.json({ error: 'Neplatné ID budovy' }, { status: 400 })
    }

    await prisma.billingServiceCost.deleteMany({ where: { billingResultId: resultId } })
    await prisma.billingResult.delete({ where: { id: resultId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting billing result:', error)
    return NextResponse.json(
      { error: 'Interní chyba serveru' },
      { status: 500 }
    )
  }
}
