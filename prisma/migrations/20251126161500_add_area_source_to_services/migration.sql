-- CreateEnum
CREATE TYPE "AreaSource" AS ENUM ('TOTAL_AREA', 'CHARGEABLE_AREA');

-- AlterTable
ALTER TABLE "services"
ADD COLUMN     "areaSource" "AreaSource" NOT NULL DEFAULT 'TOTAL_AREA';
