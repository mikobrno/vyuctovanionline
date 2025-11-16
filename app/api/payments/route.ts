import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unitId')
    const period = searchParams.get('period')

    const where: Record<string,unknown> = {}
    if (unitId) where.unitId = unitId
    if (period) where.period = parseInt(period)

    const payments = await prisma.payment.findMany({
      where,
      include: {
        unit: {
          select: {
            unitNumber: true,
            building: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { paymentDate: 'desc' }
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Chyba při načítání plateb' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const data = await request.json()

    const payment = await prisma.payment.create({
      data: {
        unitId: data.unitId,
        amount: parseFloat(data.amount),
        paymentDate: new Date(data.paymentDate),
        variableSymbol: data.variableSymbol,
        period: parseInt(data.period),
        description: data.description || null,
      }
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Chyba při vytváření platby' }, { status: 500 })
  }
}
