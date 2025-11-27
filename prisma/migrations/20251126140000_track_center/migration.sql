-- Track Center schema additions

-- Enums
CREATE TYPE "CommunicationBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'LETTER', 'LETTER_WITH_RECEIPT');
CREATE TYPE "CommunicationDeliveryStatus" AS ENUM ('PENDING', 'ENQUEUED', 'SENT', 'DELIVERED', 'OPENED', 'FAILED', 'CANCELLED');
CREATE TYPE "CommunicationEventType" AS ENUM ('CREATED', 'ENQUEUED', 'SENT', 'DELIVERED', 'OPENED', 'FAILED', 'RESEND_REQUESTED', 'MANUAL_MARKED', 'EXPORT_GENERATED');
CREATE TYPE "CommunicationEventSource" AS ENUM ('SYSTEM', 'QUEUE', 'WEBHOOK', 'MANUAL');
CREATE TYPE "PhysicalDeliveryMethod" AS ENUM ('LETTER', 'LETTER_WITH_RECEIPT', 'HAND_DELIVERY', 'OTHER');
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- communication_batches
CREATE TABLE "communication_batches" (
    "id" TEXT PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceFile" TEXT,
    "retentionHint" INTEGER,
    "status" "CommunicationBatchStatus" NOT NULL DEFAULT 'PENDING',
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB
);

CREATE INDEX "communication_batches_buildingId_year_idx"
    ON "communication_batches" ("buildingId", "year");

ALTER TABLE "communication_batches"
    ADD CONSTRAINT "communication_batches_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication_batches"
    ADD CONSTRAINT "communication_batches_startedById_fkey"
    FOREIGN KEY ("startedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- communications
CREATE TABLE "communications" (
    "id" TEXT PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT,
    "initiatedById" TEXT,
    "year" INTEGER,
    "channel" "CommunicationChannel" NOT NULL,
    "deliveryStatus" "CommunicationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "previewText" TEXT,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "templateKey" TEXT,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "communications_buildingId_channel_idx"
    ON "communications" ("buildingId", "channel");

CREATE INDEX "communications_unitId_idx"
    ON "communications" ("unitId");

ALTER TABLE "communications"
    ADD CONSTRAINT "communications_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communications"
    ADD CONSTRAINT "communications_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "communication_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communications"
    ADD CONSTRAINT "communications_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communications"
    ADD CONSTRAINT "communications_initiatedById_fkey"
    FOREIGN KEY ("initiatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- communication_events
CREATE TABLE "communication_events" (
    "id" TEXT PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "type" "CommunicationEventType" NOT NULL,
    "source" "CommunicationEventSource" NOT NULL DEFAULT 'SYSTEM',
    "payload" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "communication_events_communicationId_type_idx"
    ON "communication_events" ("communicationId", "type");

ALTER TABLE "communication_events"
    ADD CONSTRAINT "communication_events_communicationId_fkey"
    FOREIGN KEY ("communicationId") REFERENCES "communications" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication_events"
    ADD CONSTRAINT "communication_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- communication_attachments
CREATE TABLE "communication_attachments" (
    "id" TEXT PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "communication_attachments"
    ADD CONSTRAINT "communication_attachments_communicationId_fkey"
    FOREIGN KEY ("communicationId") REFERENCES "communications" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- communication_audit_notes
CREATE TABLE "communication_audit_notes" (
    "id" TEXT PRIMARY KEY,
    "communicationId" TEXT,
    "unitId" TEXT,
    "userId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "communication_audit_notes_unitId_idx"
    ON "communication_audit_notes" ("unitId");

ALTER TABLE "communication_audit_notes"
    ADD CONSTRAINT "communication_audit_notes_communicationId_fkey"
    FOREIGN KEY ("communicationId") REFERENCES "communications" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication_audit_notes"
    ADD CONSTRAINT "communication_audit_notes_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication_audit_notes"
    ADD CONSTRAINT "communication_audit_notes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- unit_delivery_records
CREATE TABLE "unit_delivery_records" (
    "id" TEXT PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "method" "PhysicalDeliveryMethod" NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "proofFilePath" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "unit_delivery_records_unitId_year_idx"
    ON "unit_delivery_records" ("unitId", "year");

ALTER TABLE "unit_delivery_records"
    ADD CONSTRAINT "unit_delivery_records_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "unit_delivery_records"
    ADD CONSTRAINT "unit_delivery_records_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- communication_exports
CREATE TABLE "communication_exports" (
    "id" TEXT PRIMARY KEY,
    "buildingId" TEXT,
    "year" INTEGER,
    "filters" JSONB,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "storagePath" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT
);

CREATE INDEX "communication_exports_buildingId_status_idx"
    ON "communication_exports" ("buildingId", "status");

ALTER TABLE "communication_exports"
    ADD CONSTRAINT "communication_exports_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication_exports"
    ADD CONSTRAINT "communication_exports_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
