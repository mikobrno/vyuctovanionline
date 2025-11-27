import type { CommunicationChannel } from '@prisma/client'
import { getServiceBusSender } from './serviceBusClient'

export type SendCommunicationJob = {
  communicationId: string
  channel: CommunicationChannel
  initiatedById?: string
  resend?: boolean
  metadata?: Record<string, unknown>
}

const COMMUNICATION_QUEUE =
  process.env.TRACK_COMMUNICATION_QUEUE ?? 'track-communications'

export async function enqueueCommunicationJob(job: SendCommunicationJob) {
  const sender = getServiceBusSender(COMMUNICATION_QUEUE)

  if (sender) {
    await sender.sendMessages({ body: job })
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[queue:fallback] enqueueCommunicationJob', job)
  }
}
