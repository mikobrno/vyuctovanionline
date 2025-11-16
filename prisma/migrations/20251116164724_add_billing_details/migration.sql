-- AlterTable
ALTER TABLE "billing_results" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "repairFund" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "billing_service_costs" ADD COLUMN     "distributionBase" TEXT,
ADD COLUMN     "unitAdvance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitAssignedUnits" DOUBLE PRECISION,
ADD COLUMN     "unitBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitPricePerUnit" DOUBLE PRECISION;
