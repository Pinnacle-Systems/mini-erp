-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounts";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "documents";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "parties";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pricing";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reporting";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sync";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenants";

-- CreateEnum
CREATE TYPE "accounts"."AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "auth"."SystemRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "catalog"."UnitType" AS ENUM ('PCS', 'KG', 'M', 'BOX');

-- CreateEnum
CREATE TYPE "catalog"."ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "documents"."DocumentType" AS ENUM ('SALES_ESTIMATE', 'PROFORMA_INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "documents"."DocumentStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "parties"."PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "pricing"."DiscountRuleType" AS ENUM ('VOLUME', 'BUNDLE', 'DISCOUNT_CODE');

-- CreateEnum
CREATE TYPE "pricing"."DiscountValueType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "reporting"."ItemActivitySourceType" AS ENUM ('POS_SALE', 'SALES_QUOTATION', 'SALES_ORDER', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'PURCHASE_RETURN', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'STOCK_COUNT');

-- CreateEnum
CREATE TYPE "reporting"."ItemActivityStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "sync"."SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "tenants"."BusinessLicenseLimitType" AS ENUM ('MAX_USERS', 'MAX_CONCURRENT_USERS');

-- CreateEnum
CREATE TYPE "tenants"."BusinessLicenseStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "tenants"."BusinessRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "tenants"."BusinessBundleKey" AS ENUM ('SALES_LITE', 'SALES_STOCK_OUT', 'TRADING', 'SERVICE_BILLING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "tenants"."BusinessCapabilityKey" AS ENUM ('ITEM_PRODUCTS', 'ITEM_SERVICES', 'PARTIES_CUSTOMERS', 'PARTIES_SUPPLIERS', 'TXN_SALE_CREATE', 'TXN_SALE_RETURN', 'TXN_PURCHASE_CREATE', 'TXN_PURCHASE_RETURN', 'INV_STOCK_OUT', 'INV_STOCK_IN', 'INV_ADJUSTMENT', 'INV_TRANSFER', 'FINANCE_RECEIVABLES', 'FINANCE_PAYABLES');

-- CreateTable
CREATE TABLE "accounts"."accounts" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "accounts"."AccountType" NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."journal_entries" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
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
    "selected_business_id" UUID,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."items" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "item_type" "catalog"."ItemType" NOT NULL DEFAULT 'PRODUCT',
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" "catalog"."UnitType" NOT NULL DEFAULT 'PCS',

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_categories" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_collections" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_collection_items" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,

    CONSTRAINT "item_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_variants" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_options" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_option_values" (
    "id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."item_variant_option_values" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "option_value_id" UUID NOT NULL,

    CONSTRAINT "item_variant_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."documents" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
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
CREATE TABLE "inventory"."locations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."stock_ledger" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
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
    "business_id" UUID NOT NULL,
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
CREATE TABLE "parties"."customer_groups" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties"."customer_group_members" (
    "id" UUID NOT NULL,
    "customer_group_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."price_books" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "default_currency" VARCHAR(3) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."price_book_customer_groups" (
    "id" UUID NOT NULL,
    "price_book_id" UUID NOT NULL,
    "customer_group_id" UUID NOT NULL,

    CONSTRAINT "price_book_customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."item_prices" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "price_book_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "customer_group_id" UUID,
    "min_qty" INTEGER NOT NULL DEFAULT 1,
    "max_qty" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."discount_rules" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule_type" "pricing"."DiscountRuleType" NOT NULL,
    "value_type" "pricing"."DiscountValueType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "code" TEXT,
    "customer_group_id" UUID,
    "min_qty" INTEGER,
    "max_qty" INTEGER,
    "max_discount" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."discount_rule_variants" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,

    CONSTRAINT "discount_rule_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."discount_rule_items" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,

    CONSTRAINT "discount_rule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."discount_rule_price_books" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "price_book_id" UUID NOT NULL,

    CONSTRAINT "discount_rule_price_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting"."item_activity_projection" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "source_schema" TEXT NOT NULL,
    "source_type" "reporting"."ItemActivitySourceType" NOT NULL,
    "source_ref" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "source_line_id" TEXT,
    "source_number" TEXT,
    "source_status" "reporting"."ItemActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "item_id" UUID,
    "variant_id" UUID,
    "party_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "signed_qty" DECIMAL(14,3) NOT NULL,
    "uom" VARCHAR(16) NOT NULL,
    "net_amount" DECIMAL(14,2),
    "tax_amount" DECIMAL(14,2),
    "gross_amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "source_updated_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_activity_projection_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "tenants"."businesses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "phone_number" TEXT,
    "gstin" TEXT,
    "email" TEXT,
    "business_type" TEXT,
    "business_category" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."business_licenses" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "tenants"."BusinessLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "begins_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "bundle_key" "tenants"."BusinessBundleKey" NOT NULL DEFAULT 'SALES_LITE',
    "add_on_capability_keys" "tenants"."BusinessCapabilityKey"[] DEFAULT ARRAY[]::"tenants"."BusinessCapabilityKey"[],
    "removed_capability_keys" "tenants"."BusinessCapabilityKey"[] DEFAULT ARRAY[]::"tenants"."BusinessCapabilityKey"[],
    "user_limit_type" "tenants"."BusinessLicenseLimitType",
    "user_limit_value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants"."business_members" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "role" "tenants"."BusinessRole" NOT NULL DEFAULT 'CASHIER',

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_business_id_code_key" ON "accounts"."accounts"("business_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "identities_phone_key" ON "auth"."identities"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "identities_email_key" ON "auth"."identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "auth"."sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_selected_business_id_expires_at_idx" ON "auth"."sessions"("selected_business_id", "expires_at");

-- CreateIndex
CREATE INDEX "item_categories_business_id_name_idx" ON "catalog"."item_categories"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_business_id_name_key" ON "catalog"."item_categories"("business_id", "name");

-- CreateIndex
CREATE INDEX "item_collections_business_id_name_idx" ON "catalog"."item_collections"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_collections_business_id_name_key" ON "catalog"."item_collections"("business_id", "name");

-- CreateIndex
CREATE INDEX "item_collection_items_business_id_collection_id_idx" ON "catalog"."item_collection_items"("business_id", "collection_id");

-- CreateIndex
CREATE INDEX "item_collection_items_business_id_item_id_idx" ON "catalog"."item_collection_items"("business_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_collection_items_collection_id_item_id_key" ON "catalog"."item_collection_items"("collection_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_variants_business_id_sku_key" ON "catalog"."item_variants"("business_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "item_options_item_id_name_key" ON "catalog"."item_options"("item_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_option_values_option_id_value_key" ON "catalog"."item_option_values"("option_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "item_variant_option_values_variant_id_option_value_id_key" ON "catalog"."item_variant_option_values"("variant_id", "option_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_business_id_type_doc_number_key" ON "documents"."documents"("business_id", "type", "doc_number");

-- CreateIndex
CREATE INDEX "stock_ledger_variant_id_idx" ON "inventory"."stock_ledger"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_business_id_code_key" ON "parties"."customer_groups"("business_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_members_customer_group_id_party_id_key" ON "parties"."customer_group_members"("customer_group_id", "party_id");

-- CreateIndex
CREATE INDEX "price_books_business_id_is_default_idx" ON "pricing"."price_books"("business_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "price_books_business_id_code_key" ON "pricing"."price_books"("business_id", "code");

-- CreateIndex
CREATE INDEX "price_book_customer_groups_customer_group_id_idx" ON "pricing"."price_book_customer_groups"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_book_customer_groups_price_book_id_customer_group_id_key" ON "pricing"."price_book_customer_groups"("price_book_id", "customer_group_id");

-- CreateIndex
CREATE INDEX "item_prices_business_id_variant_id_idx" ON "pricing"."item_prices"("business_id", "variant_id");

-- CreateIndex
CREATE INDEX "item_prices_customer_group_id_idx" ON "pricing"."item_prices"("customer_group_id");

-- CreateIndex
CREATE INDEX "item_prices_business_id_price_book_id_customer_group_id_idx" ON "pricing"."item_prices"("business_id", "price_book_id", "customer_group_id");

-- CreateIndex
CREATE INDEX "item_prices_business_id_is_active_starts_at_ends_at_idx" ON "pricing"."item_prices"("business_id", "is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "discount_rules_business_id_rule_type_idx" ON "pricing"."discount_rules"("business_id", "rule_type");

-- CreateIndex
CREATE INDEX "discount_rules_business_id_code_idx" ON "pricing"."discount_rules"("business_id", "code");

-- CreateIndex
CREATE INDEX "discount_rules_customer_group_id_idx" ON "pricing"."discount_rules"("customer_group_id");

-- CreateIndex
CREATE INDEX "discount_rules_business_id_is_active_starts_at_ends_at_idx" ON "pricing"."discount_rules"("business_id", "is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "discount_rule_variants_variant_id_idx" ON "pricing"."discount_rule_variants"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rule_variants_rule_id_variant_id_key" ON "pricing"."discount_rule_variants"("rule_id", "variant_id");

-- CreateIndex
CREATE INDEX "discount_rule_items_item_id_idx" ON "pricing"."discount_rule_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rule_items_rule_id_item_id_key" ON "pricing"."discount_rule_items"("rule_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rule_price_books_rule_id_price_book_id_key" ON "pricing"."discount_rule_price_books"("rule_id", "price_book_id");

-- CreateIndex
CREATE INDEX "item_activity_projection_business_id_item_id_occurred_at_idx" ON "reporting"."item_activity_projection"("business_id", "item_id", "occurred_at");

-- CreateIndex
CREATE INDEX "item_activity_projection_business_id_variant_id_occurred_at_idx" ON "reporting"."item_activity_projection"("business_id", "variant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "item_activity_projection_business_id_source_type_occurred_a_idx" ON "reporting"."item_activity_projection"("business_id", "source_type", "occurred_at");

-- CreateIndex
CREATE INDEX "item_activity_projection_business_id_source_status_idx" ON "reporting"."item_activity_projection"("business_id", "source_status");

-- CreateIndex
CREATE UNIQUE INDEX "item_activity_projection_business_id_source_ref_key" ON "reporting"."item_activity_projection"("business_id", "source_ref");

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
CREATE INDEX "business_licenses_business_id_status_version_idx" ON "tenants"."business_licenses"("business_id", "status", "version");

-- CreateIndex
CREATE INDEX "business_licenses_business_id_begins_at_ends_at_idx" ON "tenants"."business_licenses"("business_id", "begins_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_licenses_business_id_version_key" ON "tenants"."business_licenses"("business_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_business_id_identity_id_key" ON "tenants"."business_members"("business_id", "identity_id");

-- AddForeignKey
ALTER TABLE "accounts"."ledger_entries" ADD CONSTRAINT "ledger_entries_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "accounts"."journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "auth"."identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_selected_business_id_fkey" FOREIGN KEY ("selected_business_id") REFERENCES "tenants"."businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_collection_items" ADD CONSTRAINT "item_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "catalog"."item_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_collection_items" ADD CONSTRAINT "item_collection_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "catalog"."items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_variants" ADD CONSTRAINT "item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "catalog"."items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_options" ADD CONSTRAINT "item_options_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "catalog"."items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_option_values" ADD CONSTRAINT "item_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "catalog"."item_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_variant_option_values" ADD CONSTRAINT "item_variant_option_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "catalog"."item_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."item_variant_option_values" ADD CONSTRAINT "item_variant_option_values_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "catalog"."item_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "documents"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."line_items" ADD CONSTRAINT "line_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."stock_ledger" ADD CONSTRAINT "stock_ledger_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties"."customer_group_members" ADD CONSTRAINT "customer_group_members_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "parties"."customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties"."customer_group_members" ADD CONSTRAINT "customer_group_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"."parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."price_book_customer_groups" ADD CONSTRAINT "price_book_customer_groups_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "pricing"."price_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."item_prices" ADD CONSTRAINT "item_prices_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "pricing"."price_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."discount_rule_variants" ADD CONSTRAINT "discount_rule_variants_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "pricing"."discount_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."discount_rule_items" ADD CONSTRAINT "discount_rule_items_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "pricing"."discount_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."discount_rule_price_books" ADD CONSTRAINT "discount_rule_price_books_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "pricing"."discount_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."discount_rule_price_books" ADD CONSTRAINT "discount_rule_price_books_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "pricing"."price_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants"."business_licenses" ADD CONSTRAINT "business_licenses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "tenants"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants"."business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "tenants"."businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
