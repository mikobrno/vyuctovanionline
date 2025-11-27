import { getServiceBusReceiver, closeServiceBusClient } from '@/lib/queues/serviceBusClient'
import type { ExportJob } from '@/lib/queues/exportQueue'
import { prisma } from '@/lib/prisma'

const QUEUE_NAME = process.env.TRACK_EXPORT_QUEUE ?? 'track-exports'

async function processExportJob(job: ExportJob) {
  const exportRecord = await prisma.communicationExport.findUnique({
    where: { id: job.exportId },
  })

  if (!exportRecord) {
    console.warn('[export-worker] Export not found', job.exportId)
    return
  }

  console.info('[export-worker] Generating export', job.exportId)

  // TODO: implement CSV generation + storage upload
  await prisma.communicationExport.update({
    where: { id: job.exportId },
    data: {
      status: 'READY',
      completedAt: new Date(),
      storagePath: `/exports/${job.exportId}.csv`,
    },
  })
}

export async function runExportWorker() {
  const receiver = getServiceBusReceiver(QUEUE_NAME)

  if (!receiver) {
    console.error('Service Bus connection string is not configured')
    process.exit(1)
  }

  console.info(`[export-worker] Listening on ${QUEUE_NAME}`)

  const subscription = receiver.subscribe({
    processMessage: async (message) => {
      const payload = message.body as ExportJob
      await processExportJob(payload)
    },
    processError: async (args) => {
      console.error('[export-worker] Error', args.error)
    },
  })

  process.on('SIGINT', async () => {
    await subscription.close()
    await closeServiceBusClient()
    process.exit(0)
  })
}

if (require.main === module) {
  runExportWorker().catch((error) => {
    console.error('[export-worker] Fatal error', error)
    process.exit(1)
  })
}
