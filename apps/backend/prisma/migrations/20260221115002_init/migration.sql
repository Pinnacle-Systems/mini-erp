-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounts";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "documents";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "parties";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sync";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenants";

-- CreateEnum
CREATE TYPE "accounts"."AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "auth"."SystemRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "documents"."DocumentType" AS ENUM ('SALES_ESTIMATE', 'PROFORMA_INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "documents"."DocumentStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "inventory"."UnitType" AS ENUM ('PCS', 'KG', 'M', 'BOX');

-- CreateEnum
CREATE TYPE "inventory"."ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "parties"."PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "sync"."SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "tenants"."StoreRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');

-- CreateTable
CREATE TABLE "accounts"."accounts" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "accounts"."AccountType" NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."journal_entries" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."ledger_entries" (
    "id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."identities" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "system_role" "auth"."SystemRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."sessions" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."documents" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "type" "documents"."DocumentType" NOT NULL,
    "status" "documents"."DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "doc_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL,
    "party_id" UUID NOT NULL,
    "parent_id" UUID,
    "sub_total" DECIMAL(12,2) NOT NULL,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "shipping_addr" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."line_items" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."items" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "item_type" "inventory"."ItemType" NOT NULL DEFAULT 'PRODUCT',
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" "inventory"."UnitType" NOT NULL DEFAULT 'PCS',

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."locations" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."stock_ledger" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties"."parties" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "type" "parties"."PartyType" NOT NULL DEFAULT 'CUSTOMER',
    "account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync"."mutation_log" (
    "id" UUID NOT NULL,
    "mutation_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" "sync"."SyncOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "base_version" INTEGER,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync"."change_log" (
    "id" UUID NOT NULL,
    "cursor" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" "sync"."SyncOperation" NOT NULL,
    "data" JSONB NOT NULL,
    "server_version" INTEGER NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."store_members" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "role" "tenants"."StoreRole" NOT NULL DEFAULT 'CASHIER',

    CONSTRAINT "store_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_store_id_code_key" ON "accounts"."accounts"("store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "identities_phone_key" ON "auth"."identities"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "identities_email_key" ON "auth"."identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "auth"."sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "documents_store_id_type_doc_number_key" ON "documents"."documents"("store_id", "type", "doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "items_store_id_sku_key" ON "inventory"."items"("store_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "mutation_log_mutation_id_key" ON "sync"."mutation_log"("mutation_id");

-- CreateIndex
CREATE INDEX "mutation_log_tenant_id_server_timestamp_idx" ON "sync"."mutation_log"("tenant_id", "server_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "change_log_cursor_key" ON "sync"."change_log"("cursor");

-- CreateIndex
CREATE INDEX "change_log_tenant_id_cursor_idx" ON "sync"."change_log"("tenant_id", "cursor");

-- CreateIndex
CREATE INDEX "change_log_tenant_id_entity_entity_id_server_version_idx" ON "sync"."change_log"("tenant_id", "entity", "entity_id", "server_version");

-- CreateIndex
CREATE UNIQUE INDEX "store_members_store_id_identity_id_key" ON "tenants"."store_members"("store_id", "identity_id");

-- AddForeignKey
ALTER TABLE "accounts"."ledger_entries" ADD CONSTRAINT "ledger_entries_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "accounts"."journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "auth"."identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "documents"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."line_items" ADD CONSTRAINT "line_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."stock_ledger" ADD CONSTRAINT "stock_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."stock_ledger" ADD CONSTRAINT "stock_ledger_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants"."store_members" ADD CONSTRAINT "store_members_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "tenants"."stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
