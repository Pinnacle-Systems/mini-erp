import { prisma } from "../../lib/prisma.js";

export type SalesDocumentType =
  | "SALES_ESTIMATE"
  | "SALES_ORDER"
  | "DELIVERY_CHALLAN"
  | "SALES_INVOICE"
  | "SALES_RETURN";

export type SalesDocumentAction = "CANCEL" | "VOID" | "REOPEN";
export type SalesDocumentCancelReason = "CUSTOMER_DECLINED" | "INTERNAL_DROP" | "OTHER";

export type SalesLineInput = {
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

export type SalesDocumentInput = {
  tenantId: string;
  documentType: SalesDocumentType;
  parentId?: string | null;
  locationId?: string | null;
  billNumber: string;
  transactionType?: "CASH" | "CREDIT" | null;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  validUntil: string;
  dispatchDate: string;
  dispatchCarrier: string;
  dispatchReference: string;
  notes: string;
  lines: SalesLineInput[];
};

export type SalesTransactionClient = Parameters<typeof prisma.$transaction>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
