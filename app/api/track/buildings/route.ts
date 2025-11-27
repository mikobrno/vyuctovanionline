import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackBuildingSummary } from '@/types/track'
import { CommunicationChannel, CommunicationDeliveryStatus } from '@prisma/client'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

const emptyStatusMap = Object.values(CommunicationDeliveryStatus).reduce(
  (acc, status) => {
    acc[status] = 0
    return acc
  },
  {} as Record<CommunicationDeliveryStatus, number>
)

const emptyChannelMap = Object.values(CommunicationChannel).reduce(
  (acc, channel) => {
    acc[channel] = 0
    return acc
  },
  {} as Record<CommunicationChannel, number>
)

export async function GET() {
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
    const [buildings, statusGroup, channelGroup, manualRecords, latestActivities, batchYears] =
      await Promise.all([
        prisma.building.findMany({
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.communication.groupBy({
          by: ['buildingId', 'deliveryStatus'],
          _count: { _all: true },
        }),
        prisma.communication.groupBy({
          by: ['buildingId', 'channel'],
          _count: { _all: true },
        }),
        prisma.unitDeliveryRecord.findMany({
          select: {
            id: true,
            unit: {
              select: { buildingId: true },
            },
          },
        }),
        prisma.communication.findMany({
          select: { buildingId: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          distinct: ['buildingId'],
        }),
        prisma.communicationBatch.findMany({
          select: { buildingId: true, year: true },
          orderBy: { year: 'desc' },
        }),
      ])

    const statusMap = new Map<string, Record<CommunicationDeliveryStatus, number>>()
    statusGroup.forEach((row) => {
      const existing = statusMap.get(row.buildingId) ?? { ...emptyStatusMap }
      existing[row.deliveryStatus] = row._count._all
      statusMap.set(row.buildingId, existing)
    })

    const channelMap = new Map<string, Record<CommunicationChannel, number>>()
    channelGroup.forEach((row) => {
      const existing = channelMap.get(row.buildingId) ?? { ...emptyChannelMap }
      existing[row.channel] = row._count._all
      channelMap.set(row.buildingId, existing)
    })

    const manualMap = new Map<string, number>()
    manualRecords.forEach((record) => {
      const buildingId = record.unit?.buildingId
      if (!buildingId) return
      manualMap.set(buildingId, (manualMap.get(buildingId) ?? 0) + 1)
    })

    const latestMap = new Map<string, string>()
    latestActivities.forEach((row) => {
      latestMap.set(row.buildingId, row.updatedAt.toISOString())
    })

    const yearMap = new Map<string, Set<number>>()
    batchYears.forEach((row) => {
      const bucket = yearMap.get(row.buildingId) ?? new Set<number>()
      bucket.add(row.year)
      yearMap.set(row.buildingId, bucket)
    })

    const response: TrackBuildingSummary[] = buildings.map((building) => {
      const byStatus = statusMap.get(building.id) ?? { ...emptyStatusMap }
      const byChannel = channelMap.get(building.id) ?? { ...emptyChannelMap }
      const total = Object.values(byStatus).reduce((acc, value) => acc + value, 0)

      return {
        id: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        totals: {
          total,
          byStatus,
          byChannel,
        },
        manualDeliveries: manualMap.get(building.id) ?? 0,
        lastActivity: latestMap.get(building.id) ?? null,
        years: Array.from(yearMap.get(building.id) ?? new Set<number>()).sort((a, b) => b - a),
      }
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/buildings]', error)
    return NextResponse.json(
      {
        error: 'TRACK_BUILDINGS_FAILED',
        message:
          'Nepodařilo se načíst statistiky Track Centra. Zkuste to prosím znovu nebo zkontrolujte stav databáze.',
      },
      { status: 500 }
    )
  }
}
