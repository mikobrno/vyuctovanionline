import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import {
  CommunicationDeliveryStatus,
  CommunicationEventType,
} from '@prisma/client'

const allowedManualTypes: CommunicationEventType[] = ['MANUAL_MARKED']

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
      { error: 'Nemáte oprávnění provádět tuto akci' },
      { status: 403 }
    )
  }

  const { communicationId } = params
  const body = await request.json().catch(() => ({}))
  const { type, note, deliveryStatus, metadata } = body as {
    type?: CommunicationEventType
    note?: string
    deliveryStatus?: CommunicationDeliveryStatus
    metadata?: Record<string, unknown>
  }

  if (!type || !allowedManualTypes.includes(type)) {
    return NextResponse.json({ error: 'Nepodporovaný typ události' }, { status: 400 })
  }

  if (
    deliveryStatus &&
    !Object.values(CommunicationDeliveryStatus).includes(deliveryStatus)
  ) {
    return NextResponse.json({ error: 'Neplatný stav doručení' }, { status: 400 })
  }

  const communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    select: { id: true },
  })

  if (!communication) {
    return NextResponse.json({ error: 'Komunikace nenalezena' }, { status: 404 })
  }

  const now = new Date()

  await prisma.$transaction((tx) => {
    const ops = [] as Promise<unknown>[]

    if (deliveryStatus) {
      ops.push(
        tx.communication.update({
          where: { id: communicationId },
          data: {
            deliveryStatus,
            updatedAt: now,
          },
        })
      )
    }

    ops.push(
      tx.communicationEvent.create({
        data: {
          communicationId,
          type,
          source: 'MANUAL',
          userId: session.user.id,
          payload: metadata ?? null,
        },
      })
    )

    if (note) {
      ops.push(
        tx.communicationAuditNote.create({
          data: {
            communicationId,
            userId: session.user.id,
            note,
          },
        })
      )
    }

    return Promise.all(ops)
  })

  return NextResponse.json({ success: true })
}
