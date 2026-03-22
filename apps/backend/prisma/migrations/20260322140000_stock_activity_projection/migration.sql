CREATE TYPE "reporting"."StockActivitySourceType" AS ENUM (
  'STOCK_ADJUSTMENT',
  'GOODS_RECEIPT_NOTE',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'DELIVERY_CHALLAN',
  'SALES_INVOICE',
  'SALES_RETURN'
);

CREATE TABLE "reporting"."stock_activity" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "location_name" TEXT NOT NULL,
  "item_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "item_name" TEXT NOT NULL,
  "variant_name" TEXT,
  "sku" TEXT,
  "unit" VARCHAR(16) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "quantity_delta" DECIMAL(14,3) NOT NULL,
  "quantity_on_hand_after" DECIMAL(14,3) NOT NULL,
  "source_type" "reporting"."StockActivitySourceType" NOT NULL,
  "source_document_id" UUID,
  "source_document_number" TEXT,
  "source_action" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_activity_business_location_occurred_id_idx"
  ON "reporting"."stock_activity"("business_id", "location_id", "occurred_at" DESC, "id" DESC);

CREATE INDEX "stock_activity_variant_occurred_id_idx"
  ON "reporting"."stock_activity"("variant_id", "occurred_at" DESC, "id" DESC);

CREATE INDEX "stock_activity_business_source_occurred_id_idx"
  ON "reporting"."stock_activity"("business_id", "source_type", "occurred_at" DESC, "id" DESC);
