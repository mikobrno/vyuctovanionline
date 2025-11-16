/*
  Warnings:

  - The `methodology` column on the `services` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CalculationMethod" AS ENUM ('OWNERSHIP_SHARE', 'AREA', 'PERSON_MONTHS', 'METER_READING', 'FIXED_PER_UNIT', 'EQUAL_SPLIT', 'CUSTOM');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "advancePaymentColumn" TEXT,
ADD COLUMN     "fixedAmountPerUnit" DOUBLE PRECISION,
ADD COLUMN     "showOnStatement" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "methodology",
ADD COLUMN     "methodology" "CalculationMethod" NOT NULL DEFAULT 'OWNERSHIP_SHARE';
