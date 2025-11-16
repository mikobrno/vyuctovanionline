import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const { id, serviceId } = await params
    const body = await req.json()

    // Ověření, že služba patří k dané budově
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        buildingId: id,
      },
    })

    if (!service) {
      return NextResponse.json({ message: 'Služba nenalezena' }, { status: 404 })
    }

    // Update služby
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name: body.name,
        code: body.code,
        methodology: body.methodology,
        measurementUnit: body.measurementUnit,
        unitPrice: body.unitPrice,
        fixedAmountPerUnit: body.fixedAmountPerUnit,
        advancePaymentColumn: body.advancePaymentColumn,
        showOnStatement: body.showOnStatement,
        isActive: body.isActive,
        order: body.order,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Služba byla úspěšně aktualizována',
      service: updatedService,
    })
  } catch (error) {
    console.error('[Service update]', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Nepodařilo se aktualizovat službu',
      },
      { status: 500 }
    )
  }
}
