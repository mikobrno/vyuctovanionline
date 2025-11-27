import { getServiceBusSender } from './serviceBusClient'

export type ExportJob = {
  exportId: string
}

const EXPORT_QUEUE = process.env.TRACK_EXPORT_QUEUE ?? 'track-exports'

export async function enqueueExportJob(job: ExportJob) {
  const sender = getServiceBusSender(EXPORT_QUEUE)

  if (sender) {
    await sender.sendMessages({ body: job })
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[queue:fallback] enqueueExportJob', job)
  }
}
