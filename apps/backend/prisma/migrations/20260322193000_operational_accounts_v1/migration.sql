CREATE TYPE "accounts"."FinancialAccountType" AS ENUM ('CASH', 'BANK', 'UPI', 'CREDIT_CARD', 'OTHER');
CREATE TYPE "accounts"."MoneyMovementDirection" AS ENUM ('INFLOW', 'OUTFLOW');
CREATE TYPE "accounts"."MoneyMovementStatus" AS ENUM ('POSTED', 'VOIDED');
CREATE TYPE "accounts"."MoneyMovementSourceKind" AS ENUM ('PAYMENT_RECEIVED', 'PAYMENT_MADE', 'EXPENSE', 'MANUAL');
CREATE TYPE "accounts"."FinancialDocumentType" AS ENUM ('SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_INVOICE', 'PURCHASE_RETURN');

CREATE TABLE "accounts"."financial_accounts" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "location_id" UUID,
  "name" TEXT NOT NULL,
  "account_type" "accounts"."FinancialAccountType" NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts"."money_movements" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "direction" "accounts"."MoneyMovementDirection" NOT NULL,
  "status" "accounts"."MoneyMovementStatus" NOT NULL DEFAULT 'POSTED',
  "source_kind" "accounts"."MoneyMovementSourceKind" NOT NULL,
  "source_document_type" "accounts"."FinancialDocumentType",
  "source_document_id" UUID,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "financial_account_id" UUID NOT NULL,
  "party_id" UUID,
  "party_name_snapshot" TEXT,
  "location_id" UUID,
  "reference_no" TEXT,
  "notes" TEXT,
  "reversed_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "money_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts"."money_movement_allocations" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "money_movement_id" UUID NOT NULL,
  "document_type" "accounts"."FinancialDocumentType" NOT NULL,
  "document_id" UUID NOT NULL,
  "allocated_amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "money_movement_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts"."expense_categories" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "system_key" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts"."expenses" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "payee_name" TEXT NOT NULL,
  "party_id" UUID,
  "expense_category_id" UUID NOT NULL,
  "location_id" UUID,
  "financial_account_id" UUID NOT NULL,
  "reference_no" TEXT,
  "notes" TEXT,
  "money_movement_id" UUID NOT NULL,
  "external_reference_url" TEXT,
  "attachment_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_accounts_business_id_name_key" ON "accounts"."financial_accounts"("business_id", "name");
CREATE INDEX "financial_accounts_business_id_is_active_idx" ON "accounts"."financial_accounts"("business_id", "is_active");

CREATE INDEX "money_movements_business_id_occurred_at_idx" ON "accounts"."money_movements"("business_id", "occurred_at" DESC);
CREATE INDEX "money_movements_business_id_direction_occurred_at_idx" ON "accounts"."money_movements"("business_id", "direction", "occurred_at" DESC);
CREATE INDEX "money_movements_business_id_source_document_type_source_document_id_idx" ON "accounts"."money_movements"("business_id", "source_document_type", "source_document_id");
CREATE INDEX "money_movements_financial_account_id_occurred_at_idx" ON "accounts"."money_movements"("financial_account_id", "occurred_at" DESC);

CREATE INDEX "money_movement_allocations_business_id_document_type_document_id_idx" ON "accounts"."money_movement_allocations"("business_id", "document_type", "document_id");
CREATE INDEX "money_movement_allocations_money_movement_id_idx" ON "accounts"."money_movement_allocations"("money_movement_id");

CREATE UNIQUE INDEX "expense_categories_business_id_name_key" ON "accounts"."expense_categories"("business_id", "name");
CREATE UNIQUE INDEX "expense_categories_business_id_system_key_key" ON "accounts"."expense_categories"("business_id", "system_key");
CREATE INDEX "expense_categories_business_id_is_active_idx" ON "accounts"."expense_categories"("business_id", "is_active");

CREATE UNIQUE INDEX "expenses_money_movement_id_key" ON "accounts"."expenses"("money_movement_id");
CREATE INDEX "expenses_business_id_occurred_at_idx" ON "accounts"."expenses"("business_id", "occurred_at" DESC);
CREATE INDEX "expenses_business_id_expense_category_id_occurred_at_idx" ON "accounts"."expenses"("business_id", "expense_category_id", "occurred_at" DESC);
