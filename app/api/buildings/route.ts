import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// POST - Vytvoření nového domu
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, city, zip, ico, bankAccount } = body

    if (!name || !address || !city || !zip) {
      return NextResponse.json(
        { error: 'Vyplňte všechna povinná pole' },
        { status: 400 }
      )
    }

    const building = await prisma.building.create({
      data: {
        name,
        address,
        city,
        zip,
        ico: ico || null,
        bankAccount: bankAccount || null,
      },
    })

    return NextResponse.json(building, { status: 201 })
  } catch (error) {
    console.error('Error creating building:', error)
    return NextResponse.json(
      { error: 'Chyba při vytváření domu' },
      { status: 500 }
    )
  }
}

// GET - Seznam všech domů
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const buildings = await prisma.building.findMany({
      include: {
        _count: {
          select: {
            units: true,
            services: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(buildings)
  } catch (error) {
    console.error('Error fetching buildings:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání domů' },
      { status: 500 }
    )
  }
}
