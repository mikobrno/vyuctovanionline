-- AlterTable
ALTER TABLE "billing_results" ADD COLUMN     "smsSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsSentAt" TIMESTAMP(3);
