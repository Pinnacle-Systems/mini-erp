-- DropIndex
DROP INDEX "accounts"."expenses_business_id_expense_category_id_occurred_at_idx";

-- DropIndex
DROP INDEX "accounts"."expenses_business_id_occurred_at_idx";

-- DropIndex
DROP INDEX "accounts"."money_movements_business_id_direction_occurred_at_idx";

-- DropIndex
DROP INDEX "accounts"."money_movements_business_id_occurred_at_idx";

-- DropIndex
DROP INDEX "accounts"."money_movements_financial_account_id_occurred_at_idx";

-- AlterTable
ALTER TABLE "accounts"."expense_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accounts"."expenses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accounts"."financial_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accounts"."money_movements" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "expenses_business_id_occurred_at_idx" ON "accounts"."expenses"("business_id", "occurred_at");

-- CreateIndex
CREATE INDEX "expenses_business_id_expense_category_id_occurred_at_idx" ON "accounts"."expenses"("business_id", "expense_category_id", "occurred_at");

-- CreateIndex
CREATE INDEX "money_movements_business_id_occurred_at_idx" ON "accounts"."money_movements"("business_id", "occurred_at");

-- CreateIndex
CREATE INDEX "money_movements_business_id_direction_occurred_at_idx" ON "accounts"."money_movements"("business_id", "direction", "occurred_at");

-- CreateIndex
CREATE INDEX "money_movements_financial_account_id_occurred_at_idx" ON "accounts"."money_movements"("financial_account_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "accounts"."money_movements" ADD CONSTRAINT "money_movements_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "accounts"."financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."money_movement_allocations" ADD CONSTRAINT "money_movement_allocations_money_movement_id_fkey" FOREIGN KEY ("money_movement_id") REFERENCES "accounts"."money_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."expenses" ADD CONSTRAINT "expenses_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "accounts"."expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."expenses" ADD CONSTRAINT "expenses_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "accounts"."financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."expenses" ADD CONSTRAINT "expenses_money_movement_id_fkey" FOREIGN KEY ("money_movement_id") REFERENCES "accounts"."money_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "accounts"."money_movement_allocations_business_id_document_type_document_i" RENAME TO "money_movement_allocations_business_id_document_type_docume_idx";

-- RenameIndex
ALTER INDEX "accounts"."money_movements_business_id_source_document_type_source_documen" RENAME TO "money_movements_business_id_source_document_type_source_doc_idx";

-- RenameIndex
ALTER INDEX "reporting"."stock_activity_business_location_occurred_id_idx" RENAME TO "stock_activity_business_id_location_id_occurred_at_id_idx";

-- RenameIndex
ALTER INDEX "reporting"."stock_activity_business_source_occurred_id_idx" RENAME TO "stock_activity_business_id_source_type_occurred_at_id_idx";

-- RenameIndex
ALTER INDEX "reporting"."stock_activity_variant_occurred_id_idx" RENAME TO "stock_activity_variant_id_occurred_at_id_idx";
