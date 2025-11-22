import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Detail domu
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

    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        units: true,
        services: true,
        _count: {
          select: {
            units: true,
            services: true,
          },
        },
      },
    })

    if (!building) {
      return NextResponse.json({ error: 'Dům nebyl nalezen' }, { status: 404 })
    }

    return NextResponse.json(building)
  } catch (error) {
    console.error('Error fetching building:', error)
    return NextResponse.json(
      { error: 'Chyba při načítání domu' },
      { status: 500 }
    )
  }
}

// PUT - Aktualizace domu
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
    const { name, address, city, zip, ico, bankAccount } = body

    if (!name || !address || !city || !zip) {
      return NextResponse.json(
        { error: 'Vyplňte všechna povinná pole' },
        { status: 400 }
      )
    }

    const { id } = await params

    const building = await prisma.building.update({
      where: { id },
      data: {
        name,
        address,
        city,
        zip,
        ico: ico || null,
        bankAccount: bankAccount || null,
      },
    })

    return NextResponse.json(building)
  } catch (error) {
    console.error('Error updating building:', error)
    return NextResponse.json(
      { error: 'Chyba při aktualizaci domu' },
      { status: 500 }
    )
  }
}

// DELETE - Smazání domu
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
      return NextResponse.json({ error: 'Nemáte oprávnění mazat domy' }, { status: 403 })
    }

    const { id } = await params

    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            units: true,
            services: true,
            costs: true,
          },
        },
      },
    })

    if (!building) {
      return NextResponse.json({ error: 'Dům nebyl nalezen' }, { status: 404 })
    }

    // Smazat dům včetně všech souvisejících záznamů (cascade delete)
    await prisma.building.delete({
      where: { id },
    })

    return NextResponse.json({ 
      success: true,
      message: `Dům "${building.name}" byl úspěšně smazán včetně ${building._count.units} jednotek, ${building._count.services} služeb a ${building._count.costs} nákladů.`
    })
  } catch (error) {
    console.error('Error deleting building:', error)
    return NextResponse.json(
      { error: 'Chyba při mazání domu' },
      { status: 500 }
    )
  }
}

// PATCH - Částečná aktualizace domu (včetně globálních parametrů)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = await params

    // Filtrovat pouze povolené pole pro update
    const allowedFields = [
      'name', 'address', 'city', 'zip', 'ico', 'bankAccount', 'managerName',
      'totalArea', 'chargeableArea', 'chimneysCount', 'totalPeople', 'unitCountOverride'
    ]

    const dataToUpdate: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        dataToUpdate[field] = body[field]
      }
    }

    const building = await prisma.building.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(building)
  } catch (error) {
    console.error('Error updating building:', error)
    return NextResponse.json(
      { error: 'Chyba při aktualizaci domu' },
      { status: 500 }
    )
  }
}
