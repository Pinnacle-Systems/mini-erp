import { prisma } from "../../lib/prisma.js";
import {
  STOCK_ACTIVITY_AUDIT_START_DATE,
  decodeStockActivityCursor,
  encodeStockActivityCursor,
  type StockActivitySourceAction,
  type StockActivitySourceType,
} from "./stock-activity.shared.js";

const prismaAny = prisma as any;

type StockActivityListInput = {
  tenantId: string;
  locationId?: string;
  variantId?: string;
  sourceType?: StockActivitySourceType;
  sourceAction?: StockActivitySourceAction;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  cursor?: string;
  limit: number;
};

const mapRow = (row: any) => ({
  id: String(row.id),
  businessId: String(row.business_id),
  locationId: String(row.location_id),
  locationName: String(row.location_name),
  itemId: String(row.item_id),
  variantId: String(row.variant_id),
  itemName: String(row.item_name),
  variantName: typeof row.variant_name === "string" ? row.variant_name : null,
  sku: typeof row.sku === "string" ? row.sku : null,
  unit: String(row.unit),
  occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
  quantityDelta: Number(row.quantity_delta),
  quantityOnHandAfter: Number(row.quantity_on_hand_after),
  sourceType: row.source_type as StockActivitySourceType,
  sourceDocumentId:
    typeof row.source_document_id === "string" ? row.source_document_id : null,
  sourceDocumentNumber:
    typeof row.source_document_number === "string" ? row.source_document_number : null,
  sourceAction: row.source_action as StockActivitySourceAction,
});

const toCursorWhereClause = (cursor?: string) => {
  if (!cursor) {
    return undefined;
  }

  const parsed = decodeStockActivityCursor(cursor);
  const occurredAt = new Date(parsed.occurredAt);
  return {
    OR: [
      { occurred_at: { lt: occurredAt } },
      {
        AND: [{ occurred_at: occurredAt }, { id: { lt: parsed.id } }],
      },
    ],
  };
};

const toSearchClause = (q?: string) => {
  const normalized = q?.trim();
  if (!normalized) {
    return undefined;
  }

  return {
    OR: [
      { item_name: { contains: normalized, mode: "insensitive" } },
      { variant_name: { contains: normalized, mode: "insensitive" } },
      { sku: { contains: normalized, mode: "insensitive" } },
      { source_document_number: { contains: normalized, mode: "insensitive" } },
    ],
  };
};

const getStockActivity = async (input: StockActivityListInput) => {
  const rows = await prismaAny.stockActivity.findMany({
    where: {
      business_id: input.tenantId,
      ...(input.locationId ? { location_id: input.locationId } : {}),
      ...(input.variantId ? { variant_id: input.variantId } : {}),
      ...(input.sourceType ? { source_type: input.sourceType } : {}),
      ...(input.sourceAction ? { source_action: input.sourceAction } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            occurred_at: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
            },
          }
        : {}),
      ...(toSearchClause(input.q) ?? {}),
      ...(toCursorWhereClause(input.cursor) ?? {}),
    },
    orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    take: input.limit + 1,
  });

  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit).map(mapRow);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    rows: pageRows,
    nextCursor:
      hasMore && lastRow
        ? encodeStockActivityCursor({
            occurredAt: lastRow.occurredAt,
            id: lastRow.id,
          })
        : null,
    hasMore,
    auditStartDate: STOCK_ACTIVITY_AUDIT_START_DATE,
  };
};

export default {
  getStockActivity,
};
