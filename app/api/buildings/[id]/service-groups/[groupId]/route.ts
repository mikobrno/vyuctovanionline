import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; groupId: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const { label } = await req.json()
    if (!label || !label.trim()) {
      return NextResponse.json({ message: 'Zadejte název skupiny' }, { status: 400 })
    }

    const group = await prisma.serviceGroup.findFirst({
      where: { id: params.groupId, buildingId: params.id },
    })

    if (!group) {
      return NextResponse.json({ message: 'Skupina nenalezena' }, { status: 404 })
    }

    const updatedGroup = await prisma.serviceGroup.update({
      where: { id: params.groupId },
      data: {
        label: label.trim(),
      },
    })

    return NextResponse.json({ success: true, group: updatedGroup })
  } catch (error: unknown) {
    console.error('[ServiceGroups][PATCH]', error)
    if (error instanceof Error && error.message.includes('service_groups_buildingId_label_key')) {
      return NextResponse.json({ message: 'Skupina s tímto názvem již existuje' }, { status: 409 })
    }
    return NextResponse.json({ message: 'Nepodařilo se upravit skupinu' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; groupId: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const group = await prisma.serviceGroup.findFirst({
      where: { id: params.groupId, buildingId: params.id },
      include: { services: true },
    })

    if (!group) {
      return NextResponse.json({ message: 'Skupina nenalezena' }, { status: 404 })
    }

    const updatedServices = await prisma.$transaction(async (tx) => {
      const refreshedServices = await tx.service.findMany({
        where: { serviceGroupId: params.groupId },
        orderBy: { order: 'asc' },
      })

      const updated = [] as typeof refreshedServices
      for (const service of refreshedServices) {
        const res = await tx.service.update({
          where: { id: service.id },
          data: {
            serviceGroupId: null,
            groupShareLabel: null,
          },
          include: {
            serviceGroup: true,
          },
        })
        updated.push(res)
      }

      await tx.serviceGroup.delete({ where: { id: params.groupId } })
      return updated
    })

    return NextResponse.json({ success: true, services: updatedServices })
  } catch (error) {
    console.error('[ServiceGroups][DELETE]', error)
    return NextResponse.json({ message: 'Nepodařilo se zrušit skupinu' }, { status: 500 })
  }
}
