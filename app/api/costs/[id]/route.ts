import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Detail nákladu
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const cost = await prisma.cost.findUnique({
      where: { id: params.id },
      include: {
        building: true,
        service: true,
      },
    })

    if (!cost) {
      return NextResponse.json({ error: 'Náklad nenalezen' }, { status: 404 })
    }

    return NextResponse.json(cost)
  } catch (error) {
    console.error('Error fetching cost:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání nákladu' },
      { status: 500 }
    )
  }
}

// PUT - Aktualizovat náklad
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const data = await request.json()

    const cost = await prisma.cost.update({
      where: { id: params.id },
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

    return NextResponse.json(cost)
  } catch (error) {
    console.error('Error updating cost:', error)
    return NextResponse.json(
      { error: 'Chyba při aktualizaci nákladu' },
      { status: 500 }
    )
  }
}

// DELETE - Smazat náklad
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    await prisma.cost.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cost:', error)
    return NextResponse.json(
      { error: 'Chyba při mazání nákladu' },
      { status: 500 }
    )
  }
}
