import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackUnitCommunication } from '@/types/track'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ unitId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění' }, { status: 403 })
  }

  const yearParam = request.nextUrl.searchParams.get('year')
  const year = Number(yearParam)

  if (!yearParam || Number.isNaN(year)) {
    return NextResponse.json({ error: 'Rok je povinný parametr' }, { status: 400 })
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.unitId },
      select: { id: true },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Jednotka nenalezena' }, { status: 404 })
    }

    const communications = await prisma.communication.findMany({
      where: {
        unitId: unit.id,
        year,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        channel: true,
        deliveryStatus: true,
        subject: true,
        previewText: true,
        queuedAt: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { type: true, createdAt: true },
        },
      },
    })

    const payload: TrackUnitCommunication[] = communications.map((item) => ({
      id: item.id,
      channel: item.channel,
      deliveryStatus: item.deliveryStatus,
      subject: item.subject,
      previewText: item.previewText,
      queuedAt: item.queuedAt?.toISOString() ?? null,
      sentAt: item.sentAt?.toISOString() ?? null,
      deliveredAt: item.deliveredAt?.toISOString() ?? null,
      openedAt: item.openedAt?.toISOString() ?? null,
      lastEvent: item.events[0]?.type ?? null,
    }))

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/units/:unitId/communications]', error)
    return NextResponse.json(
      { error: 'TRACK_UNIT_COMMUNICATIONS_FAILED', message: 'Nepodařilo se načíst komunikace jednotky.' },
      { status: 500 }
    )
  }
}
