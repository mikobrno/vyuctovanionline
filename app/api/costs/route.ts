import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Seznam všech nákladů
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId')
    const period = searchParams.get('period')

    const where: any = {}
    if (buildingId) where.buildingId = buildingId
    if (period) where.period = parseInt(period)

    const costs = await prisma.cost.findMany({
      where,
      include: {
        building: {
          select: {
            name: true,
          },
        },
        service: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { period: 'desc' },
        { invoiceDate: 'desc' },
      ],
    })

    return NextResponse.json(costs)
  } catch (error) {
    console.error('Error fetching costs:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání nákladů' },
      { status: 500 }
    )
  }
}

// POST - Vytvořit nový náklad
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const data = await request.json()

    const cost = await prisma.cost.create({
      data: {
        buildingId: data.buildingId,
        serviceId: data.serviceId,
        amount: parseFloat(data.amount),
        description: data.description,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: new Date(data.invoiceDate),
        vatAmount: data.vatAmount ? parseFloat(data.vatAmount) : null,
        period: parseInt(data.period),
      },
      include: {
        building: {
          select: {
            name: true,
          },
        },
        service: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    })

    return NextResponse.json(cost, { status: 201 })
  } catch (error) {
    console.error('Error creating cost:', error)
    return NextResponse.json(
      { error: 'Chyba při vytváření nákladu' },
      { status: 500 }
    )
  }
}
