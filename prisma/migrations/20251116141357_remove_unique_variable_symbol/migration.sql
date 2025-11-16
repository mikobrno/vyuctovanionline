-- DropIndex
DROP INDEX "units_variableSymbol_key";

-- AlterTable
ALTER TABLE "units" ALTER COLUMN "variableSymbol" DROP NOT NULL;
