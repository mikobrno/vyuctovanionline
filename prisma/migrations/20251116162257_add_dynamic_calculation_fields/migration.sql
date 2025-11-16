-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('METER_DATA', 'UNIT_ATTRIBUTE', 'PERSON_MONTHS', 'UNIT_COUNT', 'FIXED_AMOUNT', 'NONE');

-- CreateEnum
CREATE TYPE "MeterDataSource" AS ENUM ('VODOMER_SV', 'VODOMER_TUV', 'TEPLO', 'ELEKTROMER');

-- CreateEnum
CREATE TYPE "UnitAttributeSource" AS ENUM ('VLASTNICKY_PODIL', 'CELKOVA_VYMERA', 'PODLAHOVA_VYMERA', 'POCET_OBYVATEL');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "dataSourceColumn" TEXT,
ADD COLUMN     "dataSourceName" TEXT,
ADD COLUMN     "dataSourceType" "DataSourceType",
ADD COLUMN     "unitAttributeName" TEXT;
