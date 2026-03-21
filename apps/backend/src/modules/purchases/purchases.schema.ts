import { z } from "zod";

export const purchaseDocumentTypeSchema = z.enum([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
]);

const purchaseDocumentActionSchema = z.enum(["CANCEL", "VOID", "REOPEN"]);
const purchaseDocumentCancelReasonSchema = z.enum([
  "CUSTOMER_DECLINED",
  "INTERNAL_DROP",
  "OTHER",
]);
const purchaseSettlementModeSchema = z.enum(["CASH", "CREDIT"]);
const purchaseDocumentTaxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);

const purchaseDocumentLineSchema = z.object({
  id: z.uuid(),
  sourceLineId: z.uuid().nullable().optional(),
  variantId: z.uuid(),
  description: z.string().trim().min(1).max(240),
  quantity: z.string().trim().min(1).max(32),
  unitPrice: z.string().trim().min(1).max(32),
  taxRate: z.string().trim().min(1).max(16),
  taxMode: purchaseDocumentTaxModeSchema,
  unit: z.string().trim().min(1).max(16),
});

const purchaseDocumentBodySchema = z.object({
  tenantId: z.uuid(),
  documentType: purchaseDocumentTypeSchema,
  parentId: z.uuid().nullable().optional(),
  locationId: z.uuid().nullable().optional(),
  billNumber: z.string().trim().min(1).max(64),
  settlementMode: purchaseSettlementModeSchema.nullable().optional(),
  supplierId: z.uuid().nullable().optional(),
  supplierName: z.string().trim().max(160).default(""),
  supplierPhone: z.string().trim().max(40).default(""),
  supplierAddress: z.string().trim().max(500).default(""),
  supplierTaxId: z.string().trim().max(32).default(""),
  notes: z.string().trim().max(2000).default(""),
  lines: z.array(purchaseDocumentLineSchema).max(200),
});

export const listPurchaseDocumentsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    documentType: purchaseDocumentTypeSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const getPurchaseDocumentHistorySchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  query: z.object({
    tenantId: z.uuid(),
    documentType: purchaseDocumentTypeSchema,
  }),
});

export const getPurchaseConversionBalanceSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  query: z.object({
    tenantId: z.uuid(),
  }),
});

export const createPurchaseDocumentSchema = z.object({
  body: purchaseDocumentBodySchema,
});

export const updatePurchaseDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: purchaseDocumentBodySchema,
});

export const deletePurchaseDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: purchaseDocumentTypeSchema,
  }),
});

export const postPurchaseDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: purchaseDocumentTypeSchema,
  }),
});

export const transitionPurchaseDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: purchaseDocumentTypeSchema,
    action: purchaseDocumentActionSchema,
    cancelReason: purchaseDocumentCancelReasonSchema.nullable().optional(),
  }),
});
