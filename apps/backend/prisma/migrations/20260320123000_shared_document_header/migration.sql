-- CreateEnum
CREATE TYPE "documents"."SettlementMode" AS ENUM ('CASH', 'CREDIT');

-- AlterTable
ALTER TABLE "documents"."documents"
ADD COLUMN "settlement_mode" "documents"."SettlementMode",
ADD COLUMN "party_snapshot" JSONB;

-- Data migration
UPDATE "documents"."documents"
SET "settlement_mode" = "transaction_type"::text::"documents"."SettlementMode"
WHERE "transaction_type" IS NOT NULL;

UPDATE "documents"."documents"
SET "party_snapshot" = jsonb_build_object(
    'role', 'customer',
    'name', "customer_name_snapshot",
    'phone', "customer_phone_snapshot",
    'address', "customer_address_snapshot",
    'taxId', "customer_tax_id_snapshot"
)
WHERE "customer_name_snapshot" IS NOT NULL
   OR "customer_phone_snapshot" IS NOT NULL
   OR "customer_address_snapshot" IS NOT NULL
   OR "customer_tax_id_snapshot" IS NOT NULL;

-- AlterTable
ALTER TABLE "documents"."documents"
DROP COLUMN "transaction_type",
DROP COLUMN "customer_name_snapshot",
DROP COLUMN "customer_phone_snapshot",
DROP COLUMN "customer_address_snapshot",
DROP COLUMN "customer_tax_id_snapshot";

-- DropEnum
DROP TYPE "documents"."SalesTransactionType";
