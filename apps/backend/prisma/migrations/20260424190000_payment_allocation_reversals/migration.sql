CREATE TYPE "accounts"."MoneyMovementAllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');

ALTER TABLE "accounts"."money_movement_allocations"
  ADD COLUMN "status" "accounts"."MoneyMovementAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "reversed_at" TIMESTAMP(3),
  ADD COLUMN "reversed_by_id" UUID,
  ADD COLUMN "reversal_reason" TEXT;

CREATE INDEX "money_movement_allocations_business_id_status_idx"
  ON "accounts"."money_movement_allocations"("business_id", "status");

CREATE INDEX "money_movement_allocations_money_movement_id_status_idx"
  ON "accounts"."money_movement_allocations"("money_movement_id", "status");
