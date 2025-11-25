import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

const normalizeBaseName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/u, '').trim()

type MergePayload = {
  label?: string
  serviceIds: string[]
  shareLabels?: Record<string, string>
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const groups = await prisma.serviceGroup.findMany({
      where: { buildingId: params.id },
      orderBy: { order: 'asc' },
      include: {
        services: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('[ServiceGroups][GET]', error)
    return NextResponse.json({ message: 'Nepodařilo se načíst skupiny služeb' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: 'Nepřihlášen' }, { status: 401 })
    }

    const body = (await req.json()) as MergePayload
    const { serviceIds, shareLabels } = body

    if (!Array.isArray(serviceIds) || serviceIds.length < 2) {
      return NextResponse.json({ message: 'Vyberte alespoň dvě služby pro sloučení' }, { status: 400 })
    }

    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        buildingId: params.id,
      },
      orderBy: { order: 'asc' },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ message: 'Některé ze zvolených služeb nebyly nalezeny' }, { status: 404 })
    }

    const targetLabel = (body.label || normalizeBaseName(services[0].name) || 'Sloučená služba').trim()
    const groupOrder = Math.min(...services.map((srv) => srv.order ?? 0))
    const previousGroupIds = services
      .map((srv) => srv.serviceGroupId)
      .filter((value): value is string => Boolean(value))

    const result = await prisma.$transaction(async (tx) => {
      const createdGroup = await tx.serviceGroup.create({
        data: {
          buildingId: params.id,
          label: targetLabel,
          order: groupOrder,
        },
      })

      const updatedServices = [] as Array<typeof services[number]>

      for (const srv of services) {
        const shareLabel = shareLabels?.[srv.id]?.trim()
        const updated = await tx.service.update({
          where: { id: srv.id },
          data: {
            serviceGroupId: createdGroup.id,
            groupShareLabel: shareLabel || null,
          },
          include: {
            serviceGroup: true,
          },
        })
        updatedServices.push(updated)
      }

      if (previousGroupIds.length > 0) {
        await tx.serviceGroup.deleteMany({
          where: {
            id: { in: previousGroupIds },
            buildingId: params.id,
            services: { none: {} },
          },
        })
      }

      return { group: createdGroup, services: updatedServices }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    console.error('[ServiceGroups][POST]', error)
    if (error instanceof Error && error.message.includes('service_groups_buildingId_label_key')) {
      return NextResponse.json({ message: 'Skupina s tímto názvem již existuje' }, { status: 409 })
    }
    return NextResponse.json({ message: 'Nepodařilo se vytvořit skupinu služeb' }, { status: 500 })
  }
}
