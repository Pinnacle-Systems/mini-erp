export const STOCK_ACTIVITY_SOURCE_TYPES = [
  "STOCK_ADJUSTMENT",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
  "DELIVERY_CHALLAN",
  "SALES_INVOICE",
  "SALES_RETURN",
] as const;

export type StockActivitySourceType = (typeof STOCK_ACTIVITY_SOURCE_TYPES)[number];

export const STOCK_ACTIVITY_SOURCE_ACTIONS = [
  "ADJUSTED",
  "POSTED",
  "CANCELLED",
  "REOPENED",
] as const;

export type StockActivitySourceAction = (typeof STOCK_ACTIVITY_SOURCE_ACTIONS)[number];

export type StockActivitySnapshot = {
  businessId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string | null;
  sku: string | null;
  unit: string;
  quantityOnHandAfter: number;
};

export type StockActivityRecordInput = {
  snapshot: StockActivitySnapshot;
  occurredAt?: Date;
  quantityDelta: number;
  sourceType: StockActivitySourceType;
  sourceAction: StockActivitySourceAction;
  sourceDocumentId?: string | null;
  sourceDocumentNumber?: string | null;
};

export const STOCK_ACTIVITY_RECENT_LIMIT = 50;
export const STOCK_ACTIVITY_DEFAULT_PAGE_LIMIT = 50;
export const STOCK_ACTIVITY_INITIAL_DISPLAY_LIMIT = 10;
export const STOCK_ACTIVITY_AUDIT_START_DATE =
  process.env.STOCK_ACTIVITY_AUDIT_START_DATE?.trim() || "2026-03-22T00:00:00.000Z";

export const encodeStockActivityCursor = (input: { occurredAt: string; id: string }) =>
  Buffer.from(`${input.occurredAt}|${input.id}`, "utf8").toString("base64url");

export const decodeStockActivityCursor = (cursor: string) => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separatorIndex = decoded.lastIndexOf("|");
  if (separatorIndex <= 0 || separatorIndex >= decoded.length - 1) {
    throw new Error("Invalid stock activity cursor");
  }

  return {
    occurredAt: decoded.slice(0, separatorIndex),
    id: decoded.slice(separatorIndex + 1),
  };
};
