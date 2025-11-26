-- Add default flag to calculation configs
ALTER TABLE "calculation_configs"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT FALSE;
