import type { prisma } from "../../lib/prisma.js";
import type {
  StockActivityRecordInput,
  StockActivitySnapshot,
} from "./stock-activity.shared.js";

type StockActivityTransactionClient = Parameters<typeof prisma.$transaction>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

export type StockActivityRow = {
  id: string;
  businessId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string | null;
  sku: string | null;
  unit: string;
  occurredAt: string;
  quantityDelta: number;
  quantityOnHandAfter: number;
  sourceType: StockActivityRecordInput["sourceType"];
  sourceDocumentId: string | null;
  sourceDocumentNumber: string | null;
  sourceAction: StockActivityRecordInput["sourceAction"];
};

const toStockActivityRow = (
  input: StockActivityRecordInput,
  rowId: string,
): StockActivityRow => ({
  id: rowId,
  businessId: input.snapshot.businessId,
  locationId: input.snapshot.locationId,
  locationName: input.snapshot.locationName,
  itemId: input.snapshot.itemId,
  variantId: input.snapshot.variantId,
  itemName: input.snapshot.itemName,
  variantName: input.snapshot.variantName,
  sku: input.snapshot.sku,
  unit: input.snapshot.unit,
  occurredAt: (input.occurredAt ?? new Date()).toISOString(),
  quantityDelta: input.quantityDelta,
  quantityOnHandAfter: input.snapshot.quantityOnHandAfter,
  sourceType: input.sourceType,
  sourceDocumentId: input.sourceDocumentId ?? null,
  sourceDocumentNumber: input.sourceDocumentNumber ?? null,
  sourceAction: input.sourceAction,
});

const toPrismaData = (input: StockActivityRow) => ({
  id: input.id,
  business_id: input.businessId,
  location_id: input.locationId,
  location_name: input.locationName,
  item_id: input.itemId,
  variant_id: input.variantId,
  item_name: input.itemName,
  variant_name: input.variantName,
  sku: input.sku,
  unit: input.unit,
  occurred_at: new Date(input.occurredAt),
  quantity_delta: input.quantityDelta,
  quantity_on_hand_after: input.quantityOnHandAfter,
  source_type: input.sourceType,
  source_document_id: input.sourceDocumentId,
  source_document_number: input.sourceDocumentNumber,
  source_action: input.sourceAction,
});

class StockActivityRecorder {
  async record(
    tx: StockActivityTransactionClient,
    input: StockActivityRecordInput,
  ): Promise<StockActivityRow> {
    const row = toStockActivityRow(input, crypto.randomUUID());
    const txAny = tx as any;
    await txAny.stockActivity.create({
      data: toPrismaData(row),
    });
    return row;
  }

  toSyncPayload(row: StockActivityRow) {
    return {
      id: row.id,
      businessId: row.businessId,
      locationId: row.locationId,
      locationName: row.locationName,
      itemId: row.itemId,
      variantId: row.variantId,
      itemName: row.itemName,
      variantName: row.variantName,
      sku: row.sku,
      unit: row.unit,
      occurredAt: row.occurredAt,
      quantityDelta: row.quantityDelta,
      quantityOnHandAfter: row.quantityOnHandAfter,
      sourceType: row.sourceType,
      sourceDocumentId: row.sourceDocumentId,
      sourceDocumentNumber: row.sourceDocumentNumber,
      sourceAction: row.sourceAction,
    };
  }

  withQuantityOnHandAfter(
    snapshot: Omit<StockActivitySnapshot, "quantityOnHandAfter">,
    quantityOnHandAfter: number,
  ): StockActivitySnapshot {
    return {
      ...snapshot,
      quantityOnHandAfter,
    };
  }
}

export const stockActivityRecorder = new StockActivityRecorder();
