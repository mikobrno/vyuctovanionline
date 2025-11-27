import { getServiceBusReceiver, closeServiceBusClient } from '@/lib/queues/serviceBusClient'
import type { SendCommunicationJob } from '@/lib/queues/communicationQueue'
import { prisma } from '@/lib/prisma'

const QUEUE_NAME = process.env.TRACK_COMMUNICATION_QUEUE ?? 'track-communications'

async function processSendCommunicationJob(job: SendCommunicationJob) {
  const communication = await prisma.communication.findUnique({
    where: { id: job.communicationId },
    include: {
      unit: {
        select: { unitNumber: true },
      },
      building: {
        select: { name: true },
      },
    },
  })

  if (!communication) {
    console.warn('[worker] Communication not found', job.communicationId)
    return
  }

  console.info('[worker] Sending communication', {
    id: communication.id,
    channel: job.channel,
    building: communication.building.name,
    unit: communication.unit?.unitNumber,
  })

  // TODO: integrate with Microsoft Graph + SMS providers
  await prisma.communicationEvent.create({
    data: {
      communicationId: communication.id,
      type: 'SENT',
      source: 'SYSTEM',
      payload: {
        note: 'Placeholder worker processed job',
      },
    },
  })
}

export async function runCommunicationWorker() {
  const receiver = getServiceBusReceiver(QUEUE_NAME)

  if (!receiver) {
    console.error('Service Bus connection string is not configured')
    process.exit(1)
  }

  console.info(`[worker] Listening on ${QUEUE_NAME}`)

  const subscription = receiver.subscribe({
    processMessage: async (message) => {
      const payload = message.body as SendCommunicationJob
      await processSendCommunicationJob(payload)
    },
    processError: async (args) => {
      console.error('[worker] Error processing message', args.error)
    },
  })

  process.on('SIGINT', async () => {
    await subscription.close()
    await closeServiceBusClient()
    process.exit(0)
  })
}

if (require.main === module) {
  runCommunicationWorker().catch((error) => {
    console.error('[worker] Fatal error', error)
    process.exit(1)
  })
}
