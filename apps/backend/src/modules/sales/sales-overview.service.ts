import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { NeedsAttentionItem, RecentSalesActivityItem, SalesAttentionReason, SalesOverview } from "./sales.types.js";

export const getSalesOverview = async (
  tenantId: string,
  locationId?: string,
): Promise<SalesOverview> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // We filter on business_id (tenantId). If a locationId is provided, we only apply
  // it to document types where we know location_id is reliably stored at the document level.
  // For now, documents table has location_id.
  const locationFilter = locationId ? { location_id: locationId } : {};
  const baseWhere = { business_id: tenantId, deleted_at: null, ...locationFilter };

  // 1. KPI: Today's Sales (using SALES_INVOICE as the billable document)
  const todaySalesResult = await prisma.document.aggregate({
    _sum: { grand_total: true },
    _count: { id: true },
    where: {
      ...baseWhere,
      type: "SALES_INVOICE",
      status: { in: ["COMPLETED", "OPEN"] }, // Depending on if posted means completed
      OR: [
        { posted_at: { gte: startOfDay, lt: endOfDay } },
        { posted_at: null, created_at: { gte: startOfDay, lt: endOfDay } }
      ]
    },
  });

  const todaySalesAmount = Number(todaySalesResult._sum.grand_total || 0);
  const todaySalesDocumentCount = todaySalesResult._count.id || 0;

  // 2. KPI: Open Estimates
  const openEstimateCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "SALES_ESTIMATE",
      status: "OPEN",
    },
  });

  // 3. KPI: Pending Orders
  const pendingOrderCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "SALES_ORDER",
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });

  // 4. KPI: Deliveries Today
  const todayDeliveryCount = await prisma.document.count({
    where: {
      ...baseWhere,
      type: "DELIVERY_CHALLAN",
      status: { in: ["COMPLETED", "OPEN"] },
      OR: [
        { posted_at: { gte: startOfDay, lt: endOfDay } },
        { posted_at: null, created_at: { gte: startOfDay, lt: endOfDay } }
      ]
    },
  });

  // 5. Needs Attention Items
  const needsAttention: NeedsAttentionItem[] = [];

  // 5a. Expiring Estimates
  const expiringDateThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // Next 3 days
  const estimates = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: "SALES_ESTIMATE",
      status: "OPEN",
      valid_until: { not: null, lte: expiringDateThreshold }
    },
    take: 5,
    orderBy: { valid_until: 'asc' }
  });

  for (const est of estimates) {
    const isExpired = est.valid_until! < now;
    needsAttention.push({
      id: est.id,
      documentType: est.type,
      documentNo: est.doc_number,
      customerName: extractCustomerName(est.party_snapshot),
      status: est.status,
      amount: Number(est.grand_total),
      documentDate: est.created_at.toISOString(),
      dueDate: est.valid_until!.toISOString(),
      reasonCode: isExpired ? "ESTIMATE_EXPIRED" : "ESTIMATE_EXPIRING_SOON",
      reasonLabel: isExpired ? "Estimate expired" : "Estimate expiring soon",
    });
  }

  // 5b. Pending Orders
  const orders = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: "SALES_ORDER",
      status: { in: ["OPEN", "PARTIAL"] },
    },
    take: 5,
    orderBy: { created_at: 'asc' } // Oldest first for attention
  });

  for (const ord of orders) {
    needsAttention.push({
      id: ord.id,
      documentType: ord.type,
      documentNo: ord.doc_number,
      customerName: extractCustomerName(ord.party_snapshot),
      status: ord.status,
      amount: Number(ord.grand_total),
      documentDate: ord.created_at.toISOString(),
      dueDate: ord.dispatch_date?.toISOString() || null,
      reasonCode: ord.status === "PARTIAL" ? "ORDER_PARTIALLY_DELIVERED" : "ORDER_PENDING_DELIVERY",
      reasonLabel: ord.status === "PARTIAL" ? "Order partially delivered" : "Order pending delivery",
    });
  }

  // Sort needs attention logically, cap at 10
  needsAttention.sort((a, b) => {
    // Put expired first, then partials, etc. Or just by date.
    return (a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1;
  });

  // 6. Recent Activity
  const recentDocs = await prisma.document.findMany({
    where: {
      ...baseWhere,
      type: {
        in: [
          "SALES_ESTIMATE",
          "SALES_ORDER",
          "DELIVERY_CHALLAN",
          "SALES_INVOICE",
          "SALES_RETURN"
        ]
      }
    },
    take: 10,
    orderBy: { updated_at: 'desc' }
  });

  const recentActivity: RecentSalesActivityItem[] = recentDocs.map(doc => ({
    id: doc.id,
    documentType: doc.type,
    documentNo: doc.doc_number,
    customerName: extractCustomerName(doc.party_snapshot),
    documentDate: doc.created_at.toISOString(),
    status: doc.status,
    amount: Number(doc.grand_total),
    updatedAt: doc.updated_at.toISOString(),
  }));

  return {
    generatedAt: now.toISOString(),
    kpis: {
      todaySalesAmount,
      todaySalesDocumentCount,
      openEstimateCount,
      pendingOrderCount,
      todayDeliveryCount,
    },
    needsAttention: needsAttention.slice(0, 10),
    recentActivity,
  };
};

function extractCustomerName(partySnapshot: Prisma.JsonValue): string {
  if (partySnapshot && typeof partySnapshot === "object" && !Array.isArray(partySnapshot)) {
    return (partySnapshot as { name?: string }).name || "Unknown Customer";
  }
  return "Unknown Customer";
}
