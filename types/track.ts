import type {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationEventSource,
  CommunicationEventType,
  ExportStatus,
  PhysicalDeliveryMethod,
} from '@prisma/client'

export type TrackBuildingSummary = {
  id: string
  name: string
  address: string
  city: string
  totals: {
    total: number
    byStatus: Partial<Record<CommunicationDeliveryStatus, number>>
    byChannel: Partial<Record<CommunicationChannel, number>>
  }
  manualDeliveries: number
  lastActivity: string | null
  years: number[]
}

export type TrackYearSummary = {
  year: number
  totals: {
    total: number
    byStatus: Partial<Record<CommunicationDeliveryStatus, number>>
    byChannel: Partial<Record<CommunicationChannel, number>>
  }
}

export type TrackUnitRow = {
  unitId: string
  unitNumber: string
  ownerNames: string[]
  ownerEmails: (string | null)[]
  ownerPhones: (string | null)[]
  communications: {
    totals: Partial<
      Record<CommunicationChannel, { total: number; delivered: number; failed: number }>
    >
    lastStatus: CommunicationDeliveryStatus | null
    lastUpdatedAt: string | null
  }
  manualDelivery?: {
    method: PhysicalDeliveryMethod
    dispatchedAt: string | null
    deliveredAt: string | null
  }
}

export type TrackUnitListResponse = {
  items: TrackUnitRow[]
  page: number
  pageSize: number
  total: number
}

export type TrackCommunicationAttachment = {
  id: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  downloadPath: string
}

export type TrackCommunicationEvent = {
  id: string
  type: CommunicationEventType
  source: CommunicationEventSource
  payload?: Record<string, unknown> | null
  createdAt: string
  user?: {
    id: string
    name: string | null
    email: string | null
  } | null
}

export type TrackCommunicationDetail = {
  id: string
  channel: CommunicationChannel
  subject: string | null
  previewText: string | null
  htmlBody: string | null
  textBody: string | null
  deliveryStatus: CommunicationDeliveryStatus
  queuedAt: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  metadata: Record<string, unknown> | null
  attachments: TrackCommunicationAttachment[]
  events: TrackCommunicationEvent[]
}

export type TrackUnitCommunication = {
  id: string
  channel: CommunicationChannel
  deliveryStatus: CommunicationDeliveryStatus
  subject: string | null
  previewText: string | null
  queuedAt: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  lastEvent: string | null
}

export type TrackExportSummary = {
  id: string
  buildingId: string | null
  year: number | null
  status: ExportStatus
  createdAt: string
  completedAt: string | null
  downloadPath: string | null
  errorMessage: string | null
}
