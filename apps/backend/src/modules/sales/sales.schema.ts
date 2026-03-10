import { z } from "zod";

const salesTransactionTypeSchema = z.enum(["CASH", "CREDIT"]);
const salesInvoiceTaxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);

const salesInvoiceLineSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  description: z.string().trim().min(1).max(240),
  quantity: z.string().trim().min(1).max(32),
  unitPrice: z.string().trim().min(1).max(32),
  taxRate: z.string().trim().min(1).max(16),
  taxMode: salesInvoiceTaxModeSchema,
  unit: z.string().trim().min(1).max(16),
});

const salesInvoiceBodySchema = z.object({
  tenantId: z.uuid(),
  billNumber: z.string().trim().min(1).max(64),
  transactionType: salesTransactionTypeSchema,
  customerId: z.uuid().nullable().optional(),
  customerName: z.string().trim().max(160).default(""),
  customerPhone: z.string().trim().max(40).default(""),
  customerAddress: z.string().trim().max(500).default(""),
  customerGstNo: z.string().trim().max(32).default(""),
  notes: z.string().trim().max(2000).default(""),
  lines: z.array(salesInvoiceLineSchema).min(1).max(200),
});

export const listSalesInvoicesSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const createSalesInvoiceSchema = z.object({
  body: salesInvoiceBodySchema,
});

export const updateSalesInvoiceSchema = z.object({
  params: z.object({
    invoiceId: z.uuid(),
  }),
  body: salesInvoiceBodySchema,
});

export const deleteSalesInvoiceSchema = z.object({
  params: z.object({
    invoiceId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
  }),
});

export const postSalesInvoiceSchema = z.object({
  params: z.object({
    invoiceId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
  }),
});
