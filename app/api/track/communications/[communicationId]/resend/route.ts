import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { enqueueCommunicationJob } from '@/lib/queues/communicationQueue'
import { CommunicationChannel } from '@prisma/client'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

export async function POST(
  request: Request,
  { params }: { params: { communicationId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nemáte oprávnění odesílat komunikaci' },
      { status: 403 }
    )
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const { communicationId } = params
    const body = await request.json().catch(() => ({}))

    const override = body?.channelOverride as CommunicationChannel | undefined
    const channelOverride = override && Object.values(CommunicationChannel).includes(override)
      ? override
      : undefined

    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
      select: {
        id: true,
        channel: true,
        deliveryStatus: true,
      },
    })

    if (!communication) {
      return NextResponse.json({ error: 'Komunikace nenalezena' }, { status: 404 })
    }

    const channel = channelOverride ?? communication.channel

    const now = new Date()

    await prisma.$transaction([
      prisma.communication.update({
        where: { id: communicationId },
        data: {
          channel,
          deliveryStatus: 'ENQUEUED',
          queuedAt: now,
          initiatedById: session.user.id,
        },
      }),
      prisma.communicationEvent.create({
        data: {
          communicationId,
          type: 'RESEND_REQUESTED',
          source: 'MANUAL',
          userId: session.user.id,
          payload: {
            requestedChannel: channel,
          },
        },
      }),
    ])

    await enqueueCommunicationJob({
      communicationId,
      channel,
      initiatedById: session.user.id,
      resend: true,
    })

    return NextResponse.json({ success: true, status: 'ENQUEUED' })
  } catch (error) {
    console.error('[TrackCenter][POST /api/track/communications/:id/resend]', error)
    return NextResponse.json(
      {
        error: 'TRACK_COMMUNICATION_RESEND_FAILED',
        message: 'Znovuodeslání komunikace se nezdařilo.',
      },
      { status: 500 }
    )
  }
}
