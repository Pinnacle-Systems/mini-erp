import { z } from "zod";

export const itemActivitySourceTypeSchema = z.enum([
  "POS_SALE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
  "SALES_RETURN",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "STOCK_COUNT",
]);

export const itemActivityStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);

// Cross-module projection contract for item-360 timeline rows.
export const itemActivityProjectionInputSchema = z.object({
  businessId: z.uuid(),
  sourceSchema: z.string().trim().min(1),
  sourceType: itemActivitySourceTypeSchema,
  sourceRef: z.string().trim().min(1),
  sourceId: z.uuid(),
  sourceLineId: z.string().trim().min(1).optional(),
  sourceNumber: z.string().trim().min(1).optional(),
  sourceStatus: itemActivityStatusSchema.default("DRAFT"),
  itemId: z.uuid().optional(),
  variantId: z.uuid().optional(),
  partyId: z.uuid().optional(),
  occurredAt: z.date(),
  signedQty: z.number(),
  uom: z.string().trim().min(1).max(16),
  netAmount: z.number().optional(),
  taxAmount: z.number().optional(),
  grossAmount: z.number().optional(),
  currency: z.string().trim().length(3).optional(),
  sourceUpdatedAt: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ItemActivitySourceType = z.infer<typeof itemActivitySourceTypeSchema>;
export type ItemActivityStatus = z.infer<typeof itemActivityStatusSchema>;
export type ItemActivityProjectionInput = z.infer<typeof itemActivityProjectionInputSchema>;

export const toProjectionRow = (input: ItemActivityProjectionInput) =>
  ({
    business_id: input.businessId,
    source_schema: input.sourceSchema,
    source_type: input.sourceType,
    source_ref: input.sourceRef,
    source_id: input.sourceId,
    source_line_id: input.sourceLineId ?? null,
    source_number: input.sourceNumber ?? null,
    source_status: input.sourceStatus,
    item_id: input.itemId ?? null,
    variant_id: input.variantId ?? null,
    party_id: input.partyId ?? null,
    occurred_at: input.occurredAt,
    signed_qty: input.signedQty,
    uom: input.uom,
    net_amount: input.netAmount ?? null,
    tax_amount: input.taxAmount ?? null,
    gross_amount: input.grossAmount ?? null,
    currency: input.currency?.toUpperCase() ?? null,
    source_updated_at: input.sourceUpdatedAt ?? null,
    metadata: input.metadata ?? null,
  }) as const;
