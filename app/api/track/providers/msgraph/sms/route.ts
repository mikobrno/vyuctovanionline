import { NextResponse } from 'next/server'
import { handleProviderEvents, type ProviderEvent } from '@/lib/track/providerEvents'

const allowedStatuses = new Set<ProviderEvent['status']>([
  'delivered',
  'opened',
  'failed',
])

const verifySecret = (request: Request) => {
  const configured = process.env.TRACK_WEBHOOK_SECRET
  if (!configured) {
    return true
  }
  const provided = request.headers.get('x-track-secret')
  return configured === provided
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Neautorizovaný webhook' }, { status: 401 })
  }

  type RawEvent = {
    providerMessageId?: string
    messageId?: string
    smsId?: string
    status?: string
    timestamp?: string
    [key: string]: unknown
  }

  const body = await request.json().catch(() => null)
  const rawEvents: RawEvent[] = Array.isArray(body?.events) ? body.events : []

  const events: ProviderEvent[] = rawEvents
    .map((entry) => {
      const status = typeof entry?.status === 'string' ? entry.status.toLowerCase() : ''
      if (!allowedStatuses.has(status as ProviderEvent['status'])) {
        return null
      }
      const messageId = entry?.providerMessageId || entry?.smsId || entry?.messageId || ''
      if (!messageId) {
        return null
      }
      return {
        providerMessageId: messageId,
        status: status as ProviderEvent['status'],
        timestamp: entry?.timestamp,
        payload: entry,
      }
    })
    .filter(Boolean) as ProviderEvent[]

  const result = await handleProviderEvents('SMS', events)

  return NextResponse.json({ success: true, ...result })
}
