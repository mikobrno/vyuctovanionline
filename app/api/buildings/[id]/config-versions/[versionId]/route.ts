import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// POST - Obnovení konfigurace z verze
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { id, versionId } = await params

    const config = await prisma.calculationConfig.findUnique({
      where: { id: versionId },
    })

    if (!config) {
      return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configData = config.config as any[]

    // Aplikovat nastavení na služby
    // Procházíme uloženou konfiguraci a hledáme odpovídající služby podle kódu
    for (const item of configData) {
      await prisma.service.updateMany({
        where: { 
          buildingId: id,
          code: item.code 
        },
        data: {
          methodology: item.methodology,
          dataSourceType: item.dataSourceType,
          dataSourceName: item.dataSourceName,
          dataSourceColumn: item.dataSourceColumn,
          unitAttributeName: item.unitAttributeName,
          measurementUnit: item.measurementUnit,
          unitPrice: item.unitPrice,
          fixedAmountPerUnit: item.fixedAmountPerUnit,
          showOnStatement: item.showOnStatement,
          isActive: item.isActive,
          order: item.order,
          customFormula: item.customFormula,
          divisor: item.divisor,
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Chyba při obnově verze' }, { status: 500 })
  }
}

// DELETE - Smazání verze
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

    const { versionId } = await params

    await prisma.calculationConfig.delete({
      where: { id: versionId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Chyba při mazání verze' }, { status: 500 })
  }
}
