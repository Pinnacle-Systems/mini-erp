import { z } from "zod";

export const salesDocumentTypeSchema = z.enum([
  "SALES_ESTIMATE",
  "SALES_ORDER",
  "DELIVERY_CHALLAN",
  "SALES_INVOICE",
  "SALES_RETURN",
]);

const salesDocumentActionSchema = z.enum(["CANCEL", "VOID", "REOPEN"]);
const salesDocumentCancelReasonSchema = z.enum([
  "CUSTOMER_DECLINED",
  "INTERNAL_DROP",
  "OTHER",
]);

const salesTransactionTypeSchema = z.enum(["CASH", "CREDIT"]);
const salesDocumentTaxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);

const salesDocumentLineSchema = z.object({
  id: z.uuid(),
  sourceLineId: z.uuid().nullable().optional(),
  variantId: z.uuid(),
  description: z.string().trim().min(1).max(240),
  quantity: z.string().trim().min(1).max(32),
  unitPrice: z.string().trim().min(1).max(32),
  taxRate: z.string().trim().min(1).max(16),
  taxMode: salesDocumentTaxModeSchema,
  unit: z.string().trim().min(1).max(16),
});

const salesDocumentBodySchema = z.object({
  tenantId: z.uuid(),
  documentType: salesDocumentTypeSchema,
  parentId: z.uuid().nullable().optional(),
  locationId: z.uuid().nullable().optional(),
  billNumber: z.string().trim().min(1).max(64),
  transactionType: salesTransactionTypeSchema.nullable().optional(),
  customerId: z.uuid().nullable().optional(),
  customerName: z.string().trim().max(160).default(""),
  customerPhone: z.string().trim().max(40).default(""),
  customerAddress: z.string().trim().max(500).default(""),
  customerGstNo: z.string().trim().max(32).default(""),
  validUntil: z.string().trim().max(10).default(""),
  dispatchDate: z.string().trim().max(10).default(""),
  dispatchCarrier: z.string().trim().max(120).default(""),
  dispatchReference: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(2000).default(""),
  lines: z.array(salesDocumentLineSchema).max(200),
});

export const listSalesDocumentsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    documentType: salesDocumentTypeSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const getSalesDocumentHistorySchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  query: z.object({
    tenantId: z.uuid(),
    documentType: salesDocumentTypeSchema,
  }),
});

export const getSalesConversionBalanceSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  query: z.object({
    tenantId: z.uuid(),
  }),
});

export const createSalesDocumentSchema = z.object({
  body: salesDocumentBodySchema,
});

export const updateSalesDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: salesDocumentBodySchema,
});

export const deleteSalesDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: salesDocumentTypeSchema,
  }),
});

export const postSalesDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: salesDocumentTypeSchema,
  }),
});

export const transitionSalesDocumentSchema = z.object({
  params: z.object({
    documentId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    documentType: salesDocumentTypeSchema,
    action: salesDocumentActionSchema,
    cancelReason: salesDocumentCancelReasonSchema.nullable().optional(),
  }),
});

export const getSalesOverviewSchema = z.object({
  query: z.object({
    locationId: z.uuid().optional(),
  }),
});

