-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('APARTMENT', 'GARAGE', 'CELLAR', 'NON_RESIDENTIAL');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('HEATING', 'COLD_WATER', 'HOT_WATER', 'ELECTRICITY');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'SENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "ico" TEXT,
    "bankAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'APARTMENT',
    "shareNumerator" INTEGER NOT NULL,
    "shareDenominator" INTEGER NOT NULL,
    "totalArea" DOUBLE PRECISION NOT NULL,
    "floorArea" DOUBLE PRECISION,
    "residents" INTEGER,
    "variableSymbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "bankAccount" TEXT,
    "salutation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "measurementUnit" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "vatAmount" DOUBLE PRECISION,
    "period" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "initialReading" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serviceId" TEXT,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" INTEGER NOT NULL,
    "consumption" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payments" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payment_records" (
    "id" TEXT NOT NULL,
    "advancePaymentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "variableSymbol" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_months" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "personCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_results" (
    "id" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "totalAdvancePrescribed" DOUBLE PRECISION NOT NULL,
    "totalAdvancePaid" DOUBLE PRECISION NOT NULL,
    "result" DOUBLE PRECISION NOT NULL,
    "pdfGenerated" BOOLEAN NOT NULL DEFAULT false,
    "pdfUrl" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_service_costs" (
    "id" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "billingResultId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "buildingTotalCost" DOUBLE PRECISION NOT NULL,
    "buildingConsumption" DOUBLE PRECISION,
    "unitConsumption" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "calculationBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_service_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "units_variableSymbol_key" ON "units"("variableSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "units_buildingId_unitNumber_key" ON "units"("buildingId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "owners_userId_key" ON "owners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "services_buildingId_code_key" ON "services"("buildingId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "meters_unitId_serialNumber_key" ON "meters"("unitId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payments_serviceId_year_key" ON "advance_payments"("serviceId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payment_records_advancePaymentId_unitId_key" ON "advance_payment_records"("advancePaymentId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "person_months_unitId_year_month_key" ON "person_months"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_buildingId_year_key" ON "billing_periods"("buildingId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "billing_results_billingPeriodId_unitId_key" ON "billing_results"("billingPeriodId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_service_costs_billingResultId_serviceId_key" ON "billing_service_costs"("billingResultId", "serviceId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_records" ADD CONSTRAINT "advance_payment_records_advancePaymentId_fkey" FOREIGN KEY ("advancePaymentId") REFERENCES "advance_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_records" ADD CONSTRAINT "advance_payment_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_months" ADD CONSTRAINT "person_months_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_results" ADD CONSTRAINT "billing_results_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_results" ADD CONSTRAINT "billing_results_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_service_costs" ADD CONSTRAINT "billing_service_costs_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_service_costs" ADD CONSTRAINT "billing_service_costs_billingResultId_fkey" FOREIGN KEY ("billingResultId") REFERENCES "billing_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_service_costs" ADD CONSTRAINT "billing_service_costs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
