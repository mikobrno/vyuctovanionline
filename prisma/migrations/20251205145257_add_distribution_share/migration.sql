-- AlterEnum
ALTER TYPE "CalculationMethod" ADD VALUE 'UNIT_PARAMETER';

-- AlterTable
ALTER TABLE "billing_periods" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "billing_results" ADD COLUMN     "meterReadingsJson" JSONB,
ADD COLUMN     "monthlyPayments" JSONB,
ADD COLUMN     "monthlyPrescriptions" JSONB,
ADD COLUMN     "summaryJson" TEXT;

-- AlterTable
ALTER TABLE "billing_service_costs" ADD COLUMN     "buildingUnits" TEXT,
ADD COLUMN     "calculationType" TEXT,
ADD COLUMN     "distributionShare" TEXT,
ADD COLUMN     "meterReadings" TEXT,
ADD COLUMN     "monthlyAdvances" TEXT,
ADD COLUMN     "unitPrice" TEXT,
ADD COLUMN     "unitUnits" TEXT;

-- AlterTable
ALTER TABLE "communications" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "meter_readings" ADD COLUMN     "dateEnd" TIMESTAMP(3),
ADD COLUMN     "dateStart" TIMESTAMP(3),
ADD COLUMN     "precalculatedCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "meters" ADD COLUMN     "variant" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "costWithMeter" DOUBLE PRECISION,
ADD COLUMN     "costWithoutMeter" DOUBLE PRECISION,
ADD COLUMN     "customFormula" TEXT,
ADD COLUMN     "divisor" DOUBLE PRECISION,
ADD COLUMN     "excelColumn" TEXT,
ADD COLUMN     "guidanceNumber" DOUBLE PRECISION DEFAULT 35,
ADD COLUMN     "manualCost" DOUBLE PRECISION,
ADD COLUMN     "manualShare" DOUBLE PRECISION,
ADD COLUMN     "useDualCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userMergeWithNext" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "bankAccount" TEXT;

-- CreateTable
CREATE TABLE "unit_parameters" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_service_meter_settings" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "hasMeter" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_service_meter_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_yearly_costs" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "costWithMeter" DOUBLE PRECISION,
    "costWithoutMeter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_yearly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_configs" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,

    CONSTRAINT "calculation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_parameters_unitId_name_key" ON "unit_parameters"("unitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "unit_service_meter_settings_unitId_serviceId_key" ON "unit_service_meter_settings"("unitId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "service_yearly_costs_serviceId_year_key" ON "service_yearly_costs"("serviceId", "year");

-- AddForeignKey
ALTER TABLE "unit_parameters" ADD CONSTRAINT "unit_parameters_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_service_meter_settings" ADD CONSTRAINT "unit_service_meter_settings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_service_meter_settings" ADD CONSTRAINT "unit_service_meter_settings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_yearly_costs" ADD CONSTRAINT "service_yearly_costs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_configs" ADD CONSTRAINT "calculation_configs_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
