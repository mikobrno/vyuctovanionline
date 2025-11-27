import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import type { TrackCommunicationDetail } from '@/types/track'
import { respondIfTrackSchemaMissing } from '@/lib/track/schemaGuard'

export async function GET(
  _request: Request,
  { params }: { params: { communicationId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nemáte oprávnění zobrazit detail komunikace' },
      { status: 403 }
    )
  }

  const schemaResponse = await respondIfTrackSchemaMissing()
  if (schemaResponse) {
    return schemaResponse
  }

  try {
    const { communicationId } = params

    const communication = await prisma.communication.findUnique({
      where: { id: communicationId },
      include: {
        attachments: true,
        events: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!communication) {
      return NextResponse.json({ error: 'Komunikace nenalezena' }, { status: 404 })
    }

    const detail: TrackCommunicationDetail = {
      id: communication.id,
      channel: communication.channel,
      subject: communication.subject,
      previewText: communication.previewText,
      htmlBody: communication.htmlBody,
      textBody: communication.textBody,
      deliveryStatus: communication.deliveryStatus,
      queuedAt: communication.queuedAt?.toISOString() ?? null,
      sentAt: communication.sentAt?.toISOString() ?? null,
      deliveredAt: communication.deliveredAt?.toISOString() ?? null,
      openedAt: communication.openedAt?.toISOString() ?? null,
      metadata: (communication.metadata as Record<string, unknown> | null) ?? null,
      attachments: communication.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes ?? null,
        downloadPath: attachment.storagePath,
      })),
      events: communication.events.map((event) => ({
        id: event.id,
        type: event.type,
        source: event.source,
        payload: (event.payload as Record<string, unknown> | null) ?? null,
        createdAt: event.createdAt.toISOString(),
        user: event.user
          ? {
              id: event.user.id,
              name: event.user.name,
              email: event.user.email,
            }
          : null,
      })),
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[TrackCenter][GET /api/track/communications/:id]', error)
    return NextResponse.json(
      { error: 'TRACK_COMMUNICATION_DETAIL_FAILED', message: 'Detail komunikace se nepodařilo načíst.' },
      { status: 500 }
    )
  }
}
