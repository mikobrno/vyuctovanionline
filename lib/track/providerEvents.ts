import { prisma } from '@/lib/prisma'
import {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  Prisma,
} from '@prisma/client'

export type ProviderEvent = {
  providerMessageId: string
  status: 'delivered' | 'opened' | 'failed'
  timestamp?: string
  payload?: Record<string, unknown>
}

const statusMap: Record<ProviderEvent['status'], CommunicationDeliveryStatus> = {
  delivered: 'DELIVERED',
  opened: 'OPENED',
  failed: 'FAILED',
}

export async function handleProviderEvents(
  channel: CommunicationChannel,
  events: ProviderEvent[]
) {
  if (!events.length) {
    return { processed: 0, missing: 0 }
  }

  let processed = 0
  let missing = 0

  for (const event of events) {
    if (!event.providerMessageId || !statusMap[event.status]) {
      missing += 1
      continue
    }

    const communication = await prisma.communication.findFirst({
      where: {
        providerMessageId: event.providerMessageId,
        channel,
      },
      select: { id: true },
    })

    if (!communication) {
      missing += 1
      continue
    }

    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date()
    const updateData: Prisma.CommunicationUpdateInput = {
      deliveryStatus: statusMap[event.status],
      updatedAt: timestamp,
    }

    if (event.status === 'delivered') {
      updateData.deliveredAt = timestamp
    }
    if (event.status === 'opened') {
      updateData.openedAt = timestamp
    }
    await prisma.$transaction([
      prisma.communication.update({
        where: { id: communication.id },
        data: updateData,
      }),
      prisma.communicationEvent.create({
        data: {
          communicationId: communication.id,
          type: event.status === 'opened' ? 'OPENED' : event.status === 'delivered' ? 'DELIVERED' : 'FAILED',
          source: 'WEBHOOK',
          payload: event.payload ?? null,
        },
      }),
    ])

    processed += 1
  }

  return { processed, missing }
}
