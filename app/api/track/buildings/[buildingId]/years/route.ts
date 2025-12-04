import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackYearSummary } from '@/types/track'
import { CommunicationChannel, CommunicationDeliveryStatus } from '@prisma/client'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

const createStatusMap = () =>
  Object.values(CommunicationDeliveryStatus).reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {} as Record<CommunicationDeliveryStatus, number>)

const createChannelMap = () =>
  Object.values(CommunicationChannel).reduce((acc, channel) => {
    acc[channel] = 0
    return acc
  }, {} as Record<CommunicationChannel, number>)

export async function GET(
  _request: Request,
  props: { params: Promise<{ buildingId: string }> }
) {
  const params = await props.params;
  const { buildingId } = params;
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

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const buildingExists = await prisma.building.count({ where: { id: buildingId } })
    if (!buildingExists) {
      return NextResponse.json({ error: 'Dům nebyl nalezen' }, { status: 404 })
    }

    const [statusGroup, channelGroup, batches] = await Promise.all([
      prisma.communication.groupBy({
        by: ['year', 'deliveryStatus'],
        where: { buildingId, year: { not: null } },
        _count: { _all: true },
      }),
      prisma.communication.groupBy({
        by: ['year', 'channel'],
        where: { buildingId, year: { not: null } },
        _count: { _all: true },
      }),
      prisma.communicationBatch.findMany({
        where: { buildingId },
        select: { year: true },
      }),
    ])

    const yearsSet = new Set<number>()
    batches.forEach((batch) => yearsSet.add(batch.year))
    statusGroup.forEach((row) => {
      if (row.year !== null) yearsSet.add(row.year)
    })
    channelGroup.forEach((row) => {
      if (row.year !== null) yearsSet.add(row.year)
    })

    const statusMap = new Map<number, Record<CommunicationDeliveryStatus, number>>()
    statusGroup.forEach((row) => {
      if (row.year === null) return
      const bucket = statusMap.get(row.year) ?? createStatusMap()
      bucket[row.deliveryStatus] = row._count._all
      statusMap.set(row.year, bucket)
    })

    const channelMap = new Map<number, Record<CommunicationChannel, number>>()
    channelGroup.forEach((row) => {
      if (row.year === null) return
      const bucket = channelMap.get(row.year) ?? createChannelMap()
      bucket[row.channel] = row._count._all
      channelMap.set(row.year, bucket)
    })

    const summaries: TrackYearSummary[] = Array.from(yearsSet)
      .sort((a, b) => b - a)
      .map((year) => {
        const byStatus = statusMap.get(year) ?? createStatusMap()
        const total = Object.values(byStatus).reduce((acc, value) => acc + value, 0)
        return {
          year,
          totals: {
            total,
            byStatus,
            byChannel: channelMap.get(year) ?? createChannelMap(),
          },
        }
      })

    return NextResponse.json(summaries)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/buildings/[buildingId]/years]', error)
    return NextResponse.json(
      {
        error: 'TRACK_BUILDING_YEARS_FAILED',
        message: 'Nepodařilo se načíst dostupné roky pro Track Center.',
      },
      { status: 500 }
    )
  }
}
