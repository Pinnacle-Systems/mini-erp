import { apiFetch } from "../../lib/api";
import type { InvoiceSettlementSummary } from "../finance/financial-api";
import { listEntities } from "../../features/sync/db";

export type SalesDocumentType =
  | "SALES_ESTIMATE"
  | "SALES_ORDER"
  | "DELIVERY_CHALLAN"
  | "SALES_INVOICE"
  | "SALES_RETURN";

export type SalesDocumentAction = "CANCEL" | "VOID" | "REOPEN";
export type SalesDocumentCancelReason =
  | "CUSTOMER_DECLINED"
  | "INTERNAL_DROP"
  | "OTHER";

export type SalesDocumentHistoryEventType =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "CONVERSION_LINKED";

export type SalesDocumentHistoryEntry = {
  id: string;
  eventType: SalesDocumentHistoryEventType;
  actorUserId: string | null;
  actorName: string | null;
  fromStatus: SalesDocumentDraft["status"] | null;
  toStatus: SalesDocumentDraft["status"] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type SalesDocumentLineDraft = {
  id: string;
  sourceLineId?: string | null;
  variantId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
  stockOnHand?: number | null;
};

export type SalesDocumentDraft = {
  id: string;
  documentType: SalesDocumentType;
  parentId?: string | null;
  parentDocumentNumber?: string | null;
  locationId?: string | null;
  locationName?: string;
  childIds?: string[];
  status?:
    | "DRAFT"
    | "OPEN"
    | "PARTIAL"
    | "COMPLETED"
    | "EXPIRED"
    | "CANCELLED"
    | "VOID";
  cancelReason?: SalesDocumentCancelReason | null;
  postedAt?: string | null;
  grandTotal?: number;
  settlement?: InvoiceSettlementSummary | null;
  returnProgress?: {
    status: "PARTIAL_RETURNED" | "RETURNED_IN_FULL";
    label: string;
  } | null;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  validUntil: string;
  dispatchDate: string;
  dispatchCarrier: string;
  dispatchReference: string;
  notes: string;
  savedAt: string;
  lines: SalesDocumentLineDraft[];
};

export type SalesDocumentApiErrorDetails = {
  requested?: string;
  suggested?: string;
};

export type SalesConversionBalanceLine = {
  sourceLineId: string;
  itemId: string;
  variantId: string | null;
  description: string;
  unitPrice: string;
  taxRate: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
  originalQuantity: string;
  remainingQuantity: string;
};

export type SalesConversionBalance = {
  documentId: string;
  documentType: SalesDocumentType;
  documentNumber: string;
  lines: SalesConversionBalanceLine[];
};

export type SalesAttentionReason =
  | "ESTIMATE_EXPIRED"
  | "ESTIMATE_EXPIRING_SOON"
  | "PENDING_ADVANCE"
  | "ORDER_PENDING_DELIVERY"
  | "ORDER_PARTIALLY_DELIVERED";

export interface NeedsAttentionItem {
  id: string;
  documentType: string;
  documentNo: string;
  customerName: string;
  status: string;
  amount: number | null;
  documentDate: string | null;
  dueDate: string | null;
  reasonCode: SalesAttentionReason;
  reasonLabel: string;
}

export interface RecentSalesActivityItem {
  id: string;
  documentType: string;
  documentNo: string;
  customerName: string;
  documentDate: string | null;
  status: string;
  amount: number | null;
  updatedAt: string;
}

export interface SalesOverview {
  generatedAt: string;
  kpis: {
    todaySalesAmount: number;
    todaySalesDocumentCount: number;
    openEstimateCount: number;
    pendingOrderCount: number;
    todayDeliveryCount: number;
  };
  needsAttention: NeedsAttentionItem[];
  recentActivity: RecentSalesActivityItem[];
}

export class SalesDocumentApiError extends Error {
  status: number;
  reasonCode?: string;
  details?: SalesDocumentApiErrorDetails;

  constructor(
    message: string,
    options: {
      status: number;
      reasonCode?: string;
      details?: SalesDocumentApiErrorDetails;
    },
  ) {
    super(message);
    this.name = "SalesDocumentApiError";
    this.status = options.status;
    this.reasonCode = options.reasonCode;
    this.details = options.details;
  }
}

type SalesDocumentDraftInput = {
  tenantId: string;
  documentType: SalesDocumentType;
  parentId?: string | null;
  locationId?: string | null;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  validUntil: string;
  dispatchDate: string;
  dispatchCarrier: string;
  dispatchReference: string;
  notes: string;
  lines: SalesDocumentLineDraft[];
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        reasonCode?: string;
        details?: SalesDocumentApiErrorDetails;
      }
    | null;

  return new SalesDocumentApiError(payload?.message ?? fallback, {
    status: response.status,
    reasonCode: payload?.reasonCode,
    details: payload?.details,
  });
};

// Reads the local Dexie projection only — no network call.
// Used when the app is known to be offline to skip the failed request entirely.
export const listLocalSalesDocuments = async (
  tenantId: string,
  documentType: SalesDocumentType,
  limit = 50,
): Promise<SalesDocumentDraft[]> => {
  const records = await listEntities(tenantId, "sales_document_read_model");
  return records
    .filter((r) => {
      const data = r.data as Record<string, unknown>;
      return data.isActive === true && data.documentType === documentType;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((r) => {
      const data = r.data as Record<string, unknown>;
      return {
        id: r.entityId,
        documentType: data.documentType as SalesDocumentType,
        billNumber: String(data.documentNumber ?? ""),
        status: data.status as SalesDocumentDraft["status"],
        postedAt: typeof data.postedAt === "string" ? data.postedAt : null,
        grandTotal: typeof data.grandTotal === "number" ? data.grandTotal : 0,
        customerId: typeof data.customerId === "string" ? data.customerId : null,
        customerName: String(data.customerName ?? ""),
        customerPhone: "",
        customerAddress: "",
        customerGstNo: "",
        transactionType: "CASH" as const,
        validUntil: "",
        dispatchDate: "",
        dispatchCarrier: "",
        dispatchReference: "",
        notes: "",
        savedAt: r.updatedAt,
        lines: [],
        settlement: null,
      };
    });
};

export const listSalesDocuments = async (
  tenantId: string,
  documentType: SalesDocumentType,
  limit = 50,
): Promise<SalesDocumentDraft[]> => {
  const query = new URLSearchParams({
    tenantId,
    documentType,
    limit: String(limit),
  });

  try {
    const response = await apiFetch(`/api/sales/documents?${query.toString()}`, {
      method: "GET",
    });

    // Auth errors must not silently fall back — surface them so the caller handles properly
    if (response.status === 401 || response.status === 403) {
      throw await parseError(response, "Access denied");
    }

    if (!response.ok) {
      throw await parseError(response, "Unable to load documents");
    }

    const payload = (await response.json()) as { documents?: SalesDocumentDraft[] };
    return payload.documents ?? [];
  } catch (err) {
    // Re-throw auth errors immediately — do not mask them with stale local data
    if (err instanceof SalesDocumentApiError && (err.status === 401 || err.status === 403)) {
      throw err;
    }

    // Network failure or server error: fall back to the local read model projection
    return listLocalSalesDocuments(tenantId, documentType, limit);
  }
};

export const getSalesOverview = async (
  locationId?: string,
): Promise<SalesOverview> => {
  const query = new URLSearchParams();
  if (locationId) {
    query.set("locationId", locationId);
  }

  const response = await apiFetch(`/api/sales/overview?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to load sales overview");
  }

  return (await response.json()) as SalesOverview;
};

export const getSalesDocumentHistory = async (
  documentId: string,
  tenantId: string,
  documentType: SalesDocumentType,
): Promise<SalesDocumentHistoryEntry[]> => {
  const query = new URLSearchParams({
    tenantId,
    documentType,
  });
  const response = await apiFetch(
    `/api/sales/documents/${encodeURIComponent(documentId)}/history?${query.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw await parseError(response, "Unable to load document history");
  }

  const payload = (await response.json()) as { history?: SalesDocumentHistoryEntry[] };
  return payload.history ?? [];
};

export const getSalesConversionBalance = async (
  documentId: string,
  tenantId: string,
): Promise<SalesConversionBalance> => {
  const query = new URLSearchParams({
    tenantId,
  });
  const response = await apiFetch(
    `/api/sales/conversion-balance/${encodeURIComponent(documentId)}?${query.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw await parseError(response, "Unable to load conversion balance");
  }

  return (await response.json()) as SalesConversionBalance;
};

export const createSalesDocumentDraft = async (
  input: SalesDocumentDraftInput,
): Promise<SalesDocumentDraft> => {
  const response = await apiFetch("/api/sales/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to save document draft");
  }

  const payload = (await response.json()) as { document: SalesDocumentDraft };
  return payload.document;
};

export const updateSalesDocumentDraft = async (
  documentId: string,
  input: SalesDocumentDraftInput,
): Promise<SalesDocumentDraft> => {
  const response = await apiFetch(`/api/sales/documents/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to update document draft");
  }

  const payload = (await response.json()) as { document: SalesDocumentDraft };
  return payload.document;
};

export const postSalesDocumentDraft = async (
  documentId: string,
  tenantId: string,
  documentType: SalesDocumentType,
): Promise<SalesDocumentDraft> => {
  const response = await apiFetch(`/api/sales/documents/${encodeURIComponent(documentId)}/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to post document");
  }

  const payload = (await response.json()) as { document: SalesDocumentDraft };
  return payload.document;
};

export const deleteSalesDocumentDraft = async (
  documentId: string,
  tenantId: string,
  documentType: SalesDocumentType,
): Promise<void> => {
  const response = await apiFetch(`/api/sales/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to delete document draft");
  }
};

export const transitionSalesDocument = async (
  documentId: string,
  tenantId: string,
  documentType: SalesDocumentType,
  action: SalesDocumentAction,
  cancelReason?: SalesDocumentCancelReason | null,
): Promise<SalesDocumentDraft> => {
  const response = await apiFetch(`/api/sales/documents/${encodeURIComponent(documentId)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType, action, cancelReason }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to update document status");
  }

  const payload = (await response.json()) as { document: SalesDocumentDraft };
  return payload.document;
};
