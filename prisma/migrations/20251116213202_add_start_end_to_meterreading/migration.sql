-- AlterTable
ALTER TABLE "meter_readings" ADD COLUMN     "endValue" DOUBLE PRECISION,
ADD COLUMN     "startValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "advance_monthly" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advance_monthly_unitId_serviceId_year_month_key" ON "advance_monthly"("unitId", "serviceId", "year", "month");

-- AddForeignKey
ALTER TABLE "advance_monthly" ADD CONSTRAINT "advance_monthly_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_monthly" ADD CONSTRAINT "advance_monthly_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
