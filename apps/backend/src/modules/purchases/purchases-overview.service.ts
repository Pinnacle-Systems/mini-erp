import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import accountsService from "../accounts/accounts.service.js";
import type {
  PurchaseNeedsAttentionItem,
  PurchaseOverview,
  RecentPurchaseActivityItem,
} from "./purchases.types.js";

export const getPurchaseOverview = async (
  tenantId: string,
  locationId?: string,
): Promise<PurchaseOverview> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const locationFilter = locationId ? { location_id: locationId } : {};
  const baseWhere = { business_id: tenantId, deleted_at: null, ...locationFilter };

  const todayPurchasesResult = await prisma.document.aggregate({
    _sum: { grand_total: true },
    _count: { id: true },
    where: {
      ...baseWhere,
      type: "PURCHASE_INVOICE",
      status: { in: ["COMPLETED", "OPEN"] },
      OR: [
        { posted_at: { gte: startOfDay, lt: endOfDay } },
        { posted_at: null, created_at: { gte: startOfDay, lt: endOfDay } },
      ],
    },
  });

  const openOrderCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "PURCHASE_ORDER",
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });

  const pendingGoodsReceiptCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "GOODS_RECEIPT_NOTE",
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });

  const todayGoodsReceiptCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "GOODS_RECEIPT_NOTE",
      status: { in: ["COMPLETED", "OPEN"] },
      OR: [
        { posted_at: { gte: startOfDay, lt: endOfDay } },
        { posted_at: null, created_at: { gte: startOfDay, lt: endOfDay } },
      ],
    },
  });

  const needsAttention: PurchaseNeedsAttentionItem[] = [];

  const orders = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: "PURCHASE_ORDER",
      status: { in: ["OPEN", "PARTIAL"] },
    },
    take: 5,
    orderBy: { created_at: "asc" },
  });

  for (const order of orders) {
    needsAttention.push({
      id: order.id,
      documentType: order.type,
      documentNo: order.doc_number,
      supplierName: extractSupplierName(order.party_snapshot),
      status: order.status,
      amount: Number(order.grand_total),
      documentDate: order.created_at.toISOString(),
      dueDate: order.dispatch_date?.toISOString() ?? null,
      reasonCode:
        order.status === "PARTIAL"
          ? "PURCHASE_ORDER_PARTIALLY_RECEIVED"
          : "PURCHASE_ORDER_PENDING_RECEIPT",
      reasonLabel:
        order.status === "PARTIAL" ? "Order partially received" : "Order pending receipt",
    });
  }

  const goodsReceipts = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: "GOODS_RECEIPT_NOTE",
      status: { in: ["OPEN", "PARTIAL"] },
    },
    take: 5,
    orderBy: { created_at: "asc" },
  });

  for (const receipt of goodsReceipts) {
    needsAttention.push({
      id: receipt.id,
      documentType: receipt.type,
      documentNo: receipt.doc_number,
      supplierName: extractSupplierName(receipt.party_snapshot),
      status: receipt.status,
      amount: Number(receipt.grand_total),
      documentDate: receipt.created_at.toISOString(),
      dueDate: receipt.updated_at.toISOString(),
      reasonCode:
        receipt.status === "PARTIAL"
          ? "GOODS_RECEIPT_PARTIALLY_INVOICED"
          : "GOODS_RECEIPT_PENDING_INVOICE",
      reasonLabel:
        receipt.status === "PARTIAL" ? "Receipt partially invoiced" : "Receipt pending invoice",
    });
  }

  const openPurchaseInvoices = (
    await accountsService.listOpenDocuments(tenantId, "PAYABLE")
  )
    .filter((invoice) => !locationId || invoice.locationId === locationId)
    .slice(0, 5);

  for (const invoice of openPurchaseInvoices) {
    const isPartial = invoice.paymentStatus === "PARTIAL";
    needsAttention.push({
      id: invoice.id,
      documentType: invoice.documentType,
      documentNo: invoice.billNumber,
      supplierName: invoice.partyName || "Unknown Supplier",
      status: invoice.paymentStatus,
      amount: invoice.outstandingAmount,
      documentDate: invoice.postedAt,
      dueDate: invoice.postedAt,
      reasonCode: isPartial ? "PURCHASE_INVOICE_PARTIALLY_PAID" : "PURCHASE_INVOICE_UNPAID",
      reasonLabel: isPartial ? "Invoice partially paid" : "Invoice unpaid",
    });
  }

  needsAttention.sort((left, right) => (left.dueDate || "9999") > (right.dueDate || "9999") ? 1 : -1);

  const recentDocs = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: {
        in: ["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE", "PURCHASE_RETURN"],
      },
    },
    take: 10,
    orderBy: { updated_at: "desc" },
  });

  const recentActivity: RecentPurchaseActivityItem[] = recentDocs.map((document) => ({
    id: document.id,
    documentType: document.type,
    documentNo: document.doc_number,
    supplierName: extractSupplierName(document.party_snapshot),
    documentDate: document.created_at.toISOString(),
    status: document.status,
    amount: Number(document.grand_total),
    updatedAt: document.updated_at.toISOString(),
  }));

  return {
    generatedAt: now.toISOString(),
    kpis: {
      todayPurchaseAmount: Number(todayPurchasesResult._sum.grand_total || 0),
      todayPurchaseDocumentCount: todayPurchasesResult._count.id || 0,
      openOrderCount,
      pendingGoodsReceiptCount,
      todayGoodsReceiptCount,
    },
    needsAttention: needsAttention.slice(0, 10),
    recentActivity,
  };
};

function extractSupplierName(partySnapshot: Prisma.JsonValue): string {
  if (partySnapshot && typeof partySnapshot === "object" && !Array.isArray(partySnapshot)) {
    return (partySnapshot as { name?: string }).name || "Unknown Supplier";
  }
  return "Unknown Supplier";
}
