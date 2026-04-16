import type { prisma } from "../../lib/prisma.js";

export type PurchaseDocumentType =
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT_NOTE"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN";

export type PurchaseDocumentAction = "CANCEL" | "VOID" | "REOPEN";
export type PurchaseDocumentCancelReason = "CUSTOMER_DECLINED" | "INTERNAL_DROP" | "OTHER";

export type PurchaseLineInput = {
  id: string;
  sourceLineId?: string | null;
  variantId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
};

export type PurchaseDocumentInput = {
  tenantId: string;
  documentType: PurchaseDocumentType;
  parentId?: string | null;
  locationId?: string | null;
  billNumber: string;
  settlementMode?: "CASH" | "CREDIT" | null;
  supplierId?: string | null;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  supplierTaxId: string;
  notes: string;
  lines: PurchaseLineInput[];
};

export type PurchaseDocumentPostInput = {
  tenantId: string;
  documentType: PurchaseDocumentType;
  financialAccountId?: string;
  paymentReference?: string;
  paymentDate?: string;
};

export type PurchaseTransactionClient = Parameters<typeof prisma.$transaction>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
