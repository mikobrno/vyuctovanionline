import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// POST - Vytvoření nové jednotky
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const body = await request.json()
    const {
      buildingId,
      unitNumber,
      variableSymbol,
      totalArea,
      floorArea,
      shareNumerator,
      shareDenominator,
      residents,
    } = body

    if (!buildingId || !unitNumber || !variableSymbol || !totalArea || !shareNumerator || !shareDenominator) {
      return NextResponse.json(
        { error: 'Vyplňte všechna povinná pole' },
        { status: 400 }
      )
    }

    // Kontrola, zda dům existuje
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
    })

    if (!building) {
      return NextResponse.json(
        { error: 'Bytový dům nebyl nalezen' },
        { status: 404 }
      )
    }

    const unit = await prisma.unit.create({
      data: {
        buildingId,
        unitNumber,
        variableSymbol,
        totalArea: parseFloat(totalArea),
        floorArea: floorArea ? parseFloat(floorArea) : null,
        shareNumerator: parseInt(shareNumerator),
        shareDenominator: parseInt(shareDenominator),
        residents: residents ? parseInt(residents) : null,
      },
    })

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json(
      { error: 'Chyba při vytváření jednotky' },
      { status: 500 }
    )
  }
}

// GET - Seznam všech jednotek
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const units = await prisma.unit.findMany({
      include: {
        building: true,
        ownerships: {
          where: {
            validTo: null,
          },
          include: {
            owner: true,
          },
        },
      },
      orderBy: {
        unitNumber: 'asc',
      },
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání jednotek' },
      { status: 500 }
    )
  }
}
