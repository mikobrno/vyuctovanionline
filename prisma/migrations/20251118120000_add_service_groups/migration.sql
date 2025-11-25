-- CreateTable
CREATE TABLE "service_groups" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "serviceGroupId" TEXT,
ADD COLUMN     "groupShareLabel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "service_groups_buildingId_label_key" ON "service_groups"("buildingId", "label");

-- AddForeignKey
ALTER TABLE "service_groups" ADD CONSTRAINT "service_groups_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_serviceGroupId_fkey" FOREIGN KEY ("serviceGroupId") REFERENCES "service_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
