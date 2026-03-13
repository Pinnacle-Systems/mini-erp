-- CreateEnum
CREATE TYPE "documents"."DocumentLineLinkType" AS ENUM ('FULFILLMENT', 'RETURN');

-- AlterTable
ALTER TABLE "inventory"."stock_ledger"
ADD COLUMN "location_id" UUID;

-- CreateTable
CREATE TABLE "documents"."document_line_links" (
    "id" UUID NOT NULL,
    "source_line_id" UUID NOT NULL,
    "target_line_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "type" "documents"."DocumentLineLinkType" NOT NULL,

    CONSTRAINT "document_line_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_line_links_source_line_id_idx" ON "documents"."document_line_links"("source_line_id");

-- CreateIndex
CREATE INDEX "document_line_links_target_line_id_idx" ON "documents"."document_line_links"("target_line_id");

-- CreateIndex
CREATE INDEX "document_line_links_source_line_id_type_idx" ON "documents"."document_line_links"("source_line_id", "type");

-- CreateIndex
CREATE INDEX "stock_ledger_business_id_location_id_variant_id_idx" ON "inventory"."stock_ledger"("business_id", "location_id", "variant_id");

-- AddForeignKey
ALTER TABLE "documents"."document_line_links"
ADD CONSTRAINT "document_line_links_source_line_id_fkey"
FOREIGN KEY ("source_line_id") REFERENCES "documents"."line_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."document_line_links"
ADD CONSTRAINT "document_line_links_target_line_id_fkey"
FOREIGN KEY ("target_line_id") REFERENCES "documents"."line_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
