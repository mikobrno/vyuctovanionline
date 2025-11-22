import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Seznam verzí konfigurace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id } = await params

    const configs = await prisma.calculationConfig.findMany({
      where: { buildingId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      }
    })

    return NextResponse.json(configs)
  } catch (error) {
    return NextResponse.json({ error: 'Chyba při načítání verzí' }, { status: 500 })
  }
}

// POST - Uložení nové verze
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    // Načíst aktuální nastavení služeb
    const services = await prisma.service.findMany({
      where: { buildingId: id },
    })

    // Vytvořit snapshot konfigurace
    const configData = services.map(s => ({
      code: s.code,
      name: s.name,
      methodology: s.methodology,
      dataSourceType: s.dataSourceType,
      dataSourceName: s.dataSourceName,
      dataSourceColumn: s.dataSourceColumn,
      unitAttributeName: s.unitAttributeName,
      measurementUnit: s.measurementUnit,
      unitPrice: s.unitPrice,
      fixedAmountPerUnit: s.fixedAmountPerUnit,
      showOnStatement: s.showOnStatement,
    }))

    const config = await prisma.calculationConfig.create({
      data: {
        buildingId: id,
        name: name || `Konfigurace ${new Date().toLocaleDateString()}`,
        description,
        config: configData,
      }
    })

    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json({ error: 'Chyba při ukládání verze' }, { status: 500 })
  }
}
