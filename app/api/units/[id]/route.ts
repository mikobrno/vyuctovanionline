import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Detail jednotky
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const { id } = await params

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        building: true,
        ownerships: {
          include: {
            owner: true,
          },
        },
        meters: true,
        payments: true,
      },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Jednotka nebyla nalezena' }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error('Error fetching unit:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání jednotky' },
      { status: 500 }
    )
  }
}

// PUT - Aktualizace jednotky
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const unit = await prisma.unit.update({
      where: { id },
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

    return NextResponse.json(unit)
  } catch (error) {
    console.error('Error updating unit:', error)
    return NextResponse.json(
      { error: 'Chyba při aktualizaci jednotky' },
      { status: 500 }
    )
  }
}

// DELETE - Smazání jednotky
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const { id } = await params

    // Kontrola, zda jednotka existuje
    const unit = await prisma.unit.findUnique({
      where: { id },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Jednotka nebyla nalezena' }, { status: 404 })
    }

    // Smazání jednotky a všech souvisejících dat (kaskádově)
    // Nejprve smazat závislé záznamy
    await prisma.$transaction(async (tx) => {
      // Smazat vlastnictví
      await tx.ownership.deleteMany({
        where: { unitId: id },
      })
      
      // Smazat měřidla
      await tx.meter.deleteMany({
        where: { unitId: id },
      })
      
      // Smazat platby
      await tx.payment.deleteMany({
        where: { unitId: id },
      })
      
      // Smazat náklady na služby pro jednotku
      await tx.billingServiceCost.deleteMany({
        where: { unitId: id },
      })
      
      // Smazat výsledky vyúčtování jednotky
      await tx.billingResult.deleteMany({
        where: { unitId: id },
      })
      
      // Nakonec smazat jednotku
      await tx.unit.delete({
        where: { id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json(
      { error: 'Chyba při mazání jednotky' },
      { status: 500 }
    )
  }
}
