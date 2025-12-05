-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "managerName" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "managerEmail" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "managerPhone" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "totalArea" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "chargeableArea" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "chimneysCount" INTEGER;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "totalPeople" INTEGER;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "unitCountOverride" INTEGER;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "emailTemplateSubject" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "emailTemplateBody" TEXT;

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "smsTemplateBody" TEXT;
