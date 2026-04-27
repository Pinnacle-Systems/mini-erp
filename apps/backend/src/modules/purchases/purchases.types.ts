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

export type PurchaseAttentionReason =
  | "PURCHASE_ORDER_PENDING_RECEIPT"
  | "PURCHASE_ORDER_PARTIALLY_RECEIVED"
  | "GOODS_RECEIPT_PENDING_INVOICE"
  | "GOODS_RECEIPT_PARTIALLY_INVOICED"
  | "PURCHASE_INVOICE_UNPAID"
  | "PURCHASE_INVOICE_PARTIALLY_PAID";

export interface PurchaseNeedsAttentionItem {
  id: string;
  documentType: string;
  documentNo: string;
  supplierName: string;
  status: string;
  amount: number | null;
  documentDate: string | null;
  dueDate: string | null;
  reasonCode: PurchaseAttentionReason;
  reasonLabel: string;
}

export interface RecentPurchaseActivityItem {
  id: string;
  documentType: string;
  documentNo: string;
  supplierName: string;
  documentDate: string | null;
  status: string;
  amount: number | null;
  updatedAt: string;
}

export interface PurchaseOverview {
  generatedAt: string;
  kpis: {
    todayPurchaseAmount: number;
    todayPurchaseDocumentCount: number;
    openOrderCount: number;
    pendingGoodsReceiptCount: number;
    todayGoodsReceiptCount: number;
  };
  needsAttention: PurchaseNeedsAttentionItem[];
  recentActivity: RecentPurchaseActivityItem[];
}
