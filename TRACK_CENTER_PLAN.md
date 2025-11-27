# Track Center Implementation Plan

## 1. Scope Overview
Track Center centralizes the delivery history of every billing artefact (emails, SMS, physical letters). It ties each communication to a building, import year, unit, and the originating batch, while keeping an immutable event timeline and audit trail for manual actions.

## 2. Backend Architecture
- **Queue**: Azure Service Bus (topic per channel). Producers push `SendCommunicationJob` messages; workers in `scripts/` or a new `queue/worker` consume and call Microsoft Graph (email + SMS) or internal PDF generator (letters).
- **Workers**:
  - `EmailWorker`: renders HTML + attachments using billing results snapshot, sends via Graph, emits `CommunicationEvent` (`SENT`/`FAILED`).
  - `SmsWorker`: renders SMS text, calls Graph SMS, logs provider IDs.
  - `LetterWorker`: generates PDFs + labels + optional lodgement slip, stores them via `storage.save`, and marks communication as `READY_TO_PRINT` (mapped to `SENT` event).
- **Webhook handlers**: new API routes capture Microsoft Graph delivery + open notifications for both email and SMS. Each webhook payload resolves `providerMessageId` → `communicationId` and appends `CommunicationEvent` (`DELIVERED`, `OPENED`, `FAILED`).
- **Retention hook**: nightly job scans `communication_batches` with `retentionHint` to decide which bodies/attachments should be archived or purged (GDPR readiness, but no deletion yet).

## 3. API Routes
| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/track/buildings` | Aggregate stats per building (sent/failed/manual). Admin-only guard. |
| GET | `/api/track/buildings/:buildingId/years` | Returns available years (derived from `communication_batches.year`) plus per-channel counts. |
| GET | `/api/track/buildings/:buildingId/years/:year/units` | Paginated unit list with computed metrics (last event, counts, manual letter badges). Query params: `channel`, `status`, `search`. |
| GET | `/api/track/communications/:id` | Full detail: metadata, HTML/text body, attachments, event timeline, audit notes. |
| POST | `/api/track/communications/:id/resend` | Validates permissions, records `RESEND_REQUESTED`, enqueues job with `communicationId` + channel override. |
| POST | `/api/track/communications/:id/manual-event` | Inserts custom events (e.g., "Marked as postal delivery"). Accepts `type`, `note`, optional `proofFile`. |
| POST | `/api/track/units/:unitId/delivery-record` | Creates/updates `UnitDeliveryRecord` (method, dispatched/delivered timestamps, attachments). |
| POST | `/api/track/export` | Stores filters + enqueues export worker. |
| GET | `/api/track/export/:id` | Returns signed download URL and status. |
| POST | `/api/track/providers/msgraph/email` | Webhook for email delivery/open events. |
| POST | `/api/track/providers/msgraph/sms` | Webhook for SMS delivery receipts. |

Middleware: `adminOnly()` guard on all routes; per-building ACL ready for future roles.

## 4. Data Flow
1. **Import** triggers creation of `CommunicationBatch` (one per building/year). For each unit, system creates `Communication` rows for email/SMS/letter based on delivery preferences.
2. When user sends communications, service sets `deliveryStatus = ENQUEUED`, stores `queuedAt`, adds `CommunicationEvent` (`ENQUEUED`, source `SYSTEM`).
3. Worker updates `communications` with provider IDs + timestamps and emits `SENT/FAILED` events.
4. Webhooks append `DELIVERED/OPENED` events which update `deliveryStatus` accordingly.
5. Manual UI actions add `CommunicationAuditNote` and optionally `UnitDeliveryRecord` entries.
6. Export job queries `communications` joined with units/buildings, writes CSV to storage, links file in `communication_exports` (status `READY`).

## 5. Queue Payloads
```ts
interface SendCommunicationJob {
  communicationId: string;
  channel: 'EMAIL' | 'SMS' | 'LETTER' | 'LETTER_WITH_RECEIPT';
  resend?: boolean;
  initiatedById?: string;
}

interface ExportJob {
  exportId: string;
}
```
Workers fetch communication payload via Prisma, render templates, and write back event rows.

## 6. Error Handling & Auditing
- All state transitions go through `CommunicationEvent`. Mutations update `communications.deliveryStatus` to keep queries fast.
- Manual overrides require `userId`; API writes both `CommunicationEvent` (`MANUAL_MARKED`) and `CommunicationAuditNote` with the provided comment.
- Failed sends trigger `CommunicationEvent` (`FAILED`) with provider error JSON; UI surfaces this in the Activity tab.

## 7. Export Format
CSV columns: `building`, `unitNumber`, `channel`, `subject`, `status`, `queuedAt`, `sentAt`, `deliveredAt`, `openedAt`, `providerMessageId`, `lastEventType`, `manualNotes`, `attachments`. When export finishes, store file (e.g., Azure Blob / local storage) and record path in `communication_exports.storagePath`.

This plan, combined with the Prisma schema/migrations, covers the backend foundation for Track Center.

## 8. Frontend Structure
- **Route**: `app/track/page.tsx` (admin protected). Uses server component to prefetch building list + summary; client component handles interactions.
- **Layout**:
  - Left sidebar `TrackBuildingFilter` (building dropdown, search, quick stats) + `TrackYearTimeline` (scrollable chips ordered desc, default `currentYear - 1`).
  - Main area tabs: `Units`, `Activity`, `Exports`.

### Components
| Component | Responsibility |
| --- | --- |
| `TrackCenterPage` | Fetch initial data, manage route params (`?buildingId=&year=`), provide context via `TrackCenterProvider`. |
| `TrackSummaryCards` | Display aggregated counts per channel (sent/delivered/failed/manual letters). |
| `TrackUnitTable` | Paginated table (unit, recipient, channels, last status). Supports filters, search, badges. Uses `DataTable` pattern from other admin pages. |
| `TrackUnitDrawer` | Slide-over panel showing selected unit's communications; includes action buttons (`Resend`, `Mark as letter`, `Add note`). |
| `CommunicationTimeline` | Vertical timeline (events) with icons + metadata + user info; reused for Activity tab. |
| `CommunicationPreview` | Modal rendering HTML / SMS text / PDF viewer (letters). Provides attachment download buttons + label/lodgement files. |
| `ManualDeliveryForm` | Modal for logging physical delivery (method, dates, proof upload). |
| `ActivityFeed` | Stream of latest events (failed deliveries, manual overrides) across entire building/year. Polls or uses SWR revalidation. |
| `ExportPanel` | Shows export history (status chips, download links) + trigger button -> confirms filters -> calls `/api/track/export`. |

### State & Data Fetching
- Use `useSearchParams` for building/year/channel filter to keep shareable links.
- Data fetching via `useSWR`/`react-query` or Next `use` pattern per route segment (consistent with rest of app).
- Actions (resend, manual note) call `/api/track/...` endpoints; optimistic `CommunicationEvent` appended locally.
- File previews use existing PDF viewer component (from `components/pdf`) with signed URLs from attachments endpoint.

### UX Details
- Default filter chooses the most recent completed `CommunicationBatch` year (or `currentYear - 1`).
- Table highlights failed statuses (red badge) and manual letters (brown badge). Tooltip reveals provider error message.
- Activity tab groups events by day, allowing quick scanning of issues needing attention.
- Export tab includes info text about GDPR retention and manual cleanup reminders.
