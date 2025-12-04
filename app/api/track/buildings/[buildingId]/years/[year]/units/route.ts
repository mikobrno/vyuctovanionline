import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackUnitListResponse, TrackUnitRow } from '@/types/track'
import {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  Prisma,
} from '@prisma/client'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

const parseChannel = (value: string | null): CommunicationChannel | undefined => {
  if (!value) return undefined
  return Object.values(CommunicationChannel).includes(value as CommunicationChannel)
    ? (value as CommunicationChannel)
    : undefined
}

const parseStatus = (
  value: string | null
): CommunicationDeliveryStatus | undefined => {
  if (!value) return undefined
  return Object.values(CommunicationDeliveryStatus).includes(
    value as CommunicationDeliveryStatus
  )
    ? (value as CommunicationDeliveryStatus)
    : undefined
}

const DEFAULT_PAGE_SIZE = 25

export async function GET(
  request: Request,
  props: { params: Promise<{ buildingId: string; year: string }> }
) {
  const params = await props.params;
  const { buildingId, year } = params;
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nemáte oprávnění zobrazit Track Center' },
      { status: 403 }
    )
  }

  const yearNumber = Number(year)

  if (!Number.isInteger(yearNumber)) {
    return NextResponse.json({ error: 'Rok musí být číslo' }, { status: 400 })
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  const url = new URL(request.url)
  const searchParam = url.searchParams.get('search')?.trim() ?? null
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1)
  const pageSize = Math.min(
    Math.max(Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE), 1),
    200
  )
  const channel = parseChannel(url.searchParams.get('channel'))
  const status = parseStatus(url.searchParams.get('status'))

  const unitWhere: Prisma.UnitWhereInput = {
    buildingId,
  }

  if (searchParam) {
    unitWhere.OR = [
      { unitNumber: { contains: searchParam, mode: 'insensitive' } },
      {
        ownerships: {
          some: {
            owner: {
              OR: [
                { firstName: { contains: searchParam, mode: 'insensitive' } },
                { lastName: { contains: searchParam, mode: 'insensitive' } },
                { email: { contains: searchParam, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ]
  }

  try {
    const [total, units] = await Promise.all([
      prisma.unit.count({ where: unitWhere }),
      prisma.unit.findMany({
        where: unitWhere,
        include: {
          ownerships: {
            include: { owner: true },
          },
          communications: {
            where: {
              year: yearNumber,
              ...(channel ? { channel } : {}),
              ...(status ? { deliveryStatus: status } : {}),
            },
            select: {
              id: true,
              channel: true,
              deliveryStatus: true,
              updatedAt: true,
            },
          },
          deliveryRecords: {
            where: { year: yearNumber },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { unitNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const items: TrackUnitRow[] = units.map((unit) => {
      const channelTotals: TrackUnitRow['communications']['totals'] = {}
      let lastStatus: CommunicationDeliveryStatus | null = null
      let lastUpdatedDate: Date | undefined = undefined

      unit.communications.forEach((communication) => {
        const bucket = channelTotals[communication.channel] ?? {
          total: 0,
          delivered: 0,
          failed: 0,
        }
        bucket.total += 1
        if (communication.deliveryStatus === 'DELIVERED' || communication.deliveryStatus === 'OPENED') {
          bucket.delivered += 1
        }
        if (communication.deliveryStatus === 'FAILED') {
          bucket.failed += 1
        }
        channelTotals[communication.channel] = bucket

        if (!lastUpdatedDate || communication.updatedAt > lastUpdatedDate) {
          lastStatus = communication.deliveryStatus
          lastUpdatedDate = communication.updatedAt
        }
      })

      const latestDeliveryRecord = unit.deliveryRecords[0]

      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        ownerNames: unit.ownerships.map((ownership) =>
          `${ownership.owner.firstName ?? ''} ${ownership.owner.lastName ?? ''}`.trim()
        ),
        ownerEmails: unit.ownerships.map((ownership) => ownership.owner.email ?? null),
        ownerPhones: unit.ownerships.map((ownership) => ownership.owner.phone ?? null),
        communications: {
          totals: channelTotals,
          lastStatus,
          lastUpdatedAt: lastUpdatedDate ? (lastUpdatedDate as Date).toISOString() : null,
        },
        manualDelivery: latestDeliveryRecord
          ? {
              method: latestDeliveryRecord.method,
              dispatchedAt: latestDeliveryRecord.dispatchedAt?.toISOString() ?? null,
              deliveredAt: latestDeliveryRecord.deliveredAt?.toISOString() ?? null,
            }
          : undefined,
      }
    })

    const response: TrackUnitListResponse = {
      items,
      page,
      pageSize,
      total,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/buildings/[buildingId]/years/[year]/units]', error)
    return NextResponse.json(
      {
        error: 'TRACK_UNITS_FAILED',
        message: 'Nepodařilo se načíst jednotky pro zvolené období.',
      },
      { status: 500 }
    )
  }
}
