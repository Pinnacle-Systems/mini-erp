import { ConnectivityError, apiFetch } from "../../lib/api";
import { listEntities } from "../../features/sync/db";
import type { InvoiceSettlementSummary } from "../finance/financial-api";

export type PurchaseDocumentType =
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT_NOTE"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN";

export type PurchaseDocumentAction = "CANCEL" | "VOID" | "REOPEN";
export type PurchaseDocumentCancelReason =
  | "CUSTOMER_DECLINED"
  | "INTERNAL_DROP"
  | "OTHER";

export type PurchaseDocumentHistoryEventType =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "CONVERSION_LINKED";

export type PurchaseDocumentLineDraft = {
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

export type PurchaseDocumentPostInput = {
  financialAccountId?: string;
  paymentReference?: string;
  paymentDate?: string;
};

export type PurchaseDocumentDraft = {
  id: string;
  documentType: PurchaseDocumentType;
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
    | "CANCELLED"
    | "VOID";
  cancelReason?: PurchaseDocumentCancelReason | null;
  postedAt?: string | null;
  grandTotal?: number;
  settlement?: InvoiceSettlementSummary | null;
  billNumber: string;
  settlementMode: "CASH" | "CREDIT";
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  supplierTaxId: string;
  notes: string;
  savedAt: string;
  lines: PurchaseDocumentLineDraft[];
};

export type PurchaseDocumentHistoryEntry = {
  id: string;
  eventType: PurchaseDocumentHistoryEventType;
  actorUserId: string | null;
  actorName: string | null;
  fromStatus: PurchaseDocumentDraft["status"] | null;
  toStatus: PurchaseDocumentDraft["status"] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type PurchaseConversionBalanceLine = {
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

export type PurchaseConversionBalance = {
  lines: PurchaseConversionBalanceLine[];
};

export type PurchaseDocumentApiErrorDetails = {
  requested?: string;
  suggested?: string;
};

export class PurchaseDocumentApiError extends Error {
  status: number;
  reasonCode?: string;
  details?: PurchaseDocumentApiErrorDetails;

  constructor(
    message: string,
    options: {
      status: number;
      reasonCode?: string;
      details?: PurchaseDocumentApiErrorDetails;
    },
  ) {
    super(message);
    this.name = "PurchaseDocumentApiError";
    this.status = options.status;
    this.reasonCode = options.reasonCode;
    this.details = options.details;
  }
}

type PurchaseDocumentDraftInput = {
  tenantId: string;
  documentType: PurchaseDocumentType;
  parentId?: string | null;
  locationId?: string | null;
  billNumber: string;
  settlementMode: "CASH" | "CREDIT";
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  supplierTaxId: string;
  notes: string;
  lines: PurchaseDocumentLineDraft[];
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        reasonCode?: string;
        details?: PurchaseDocumentApiErrorDetails;
      }
    | null;

  return new PurchaseDocumentApiError(payload?.message ?? fallback, {
    status: response.status,
    reasonCode: payload?.reasonCode,
    details: payload?.details,
  });
};

export const listPurchaseDocuments = async (
  tenantId: string,
  documentType: PurchaseDocumentType,
  limit = 50,
): Promise<PurchaseDocumentDraft[]> => {
  const query = new URLSearchParams({
    tenantId,
    documentType,
    limit: String(limit),
  });
  try {
    const response = await apiFetch(`/api/purchases/documents?${query.toString()}`, {
      method: "GET",
    });

    if (response.status === 401 || response.status === 403) {
      throw await parseError(response, "Access denied");
    }

    if (!response.ok) {
      throw await parseError(response, "Unable to load purchase documents");
    }

    const payload = (await response.json()) as { documents?: PurchaseDocumentDraft[] };
    return payload.documents ?? [];
  } catch (error) {
    if (
      error instanceof PurchaseDocumentApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    if (error instanceof ConnectivityError || error instanceof PurchaseDocumentApiError) {
      return listLocalPurchaseDocuments(tenantId, documentType, limit);
    }
    throw error;
  }
};

export const listLocalPurchaseDocuments = async (
  tenantId: string,
  documentType: PurchaseDocumentType,
  limit = 50,
): Promise<PurchaseDocumentDraft[]> => {
  const records = await listEntities(tenantId, "purchase_document_read_model");
  return records
    .filter((record) => {
      const data = record.data as Record<string, unknown>;
      return data.isActive === true && data.documentType === documentType;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit)
    .map((record) => {
      const data = record.data as Record<string, unknown>;
      return {
        id: record.entityId,
        documentType: data.documentType as PurchaseDocumentType,
        billNumber: String(data.documentNumber ?? ""),
        status: data.status as PurchaseDocumentDraft["status"],
        postedAt: typeof data.postedAt === "string" ? data.postedAt : null,
        grandTotal: typeof data.grandTotal === "number" ? data.grandTotal : 0,
        settlement: null,
        settlementMode: "CASH",
        supplierId: typeof data.supplierId === "string" ? data.supplierId : null,
        supplierName: String(data.supplierName ?? ""),
        supplierPhone: "",
        supplierAddress: "",
        supplierTaxId: "",
        locationId: typeof data.locationId === "string" ? data.locationId : null,
        locationName: typeof data.locationName === "string" ? data.locationName : "",
        notes: "",
        savedAt: record.updatedAt,
        lines: [],
      };
    });
};

export const getPurchaseDocumentHistory = async (
  documentId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
): Promise<PurchaseDocumentHistoryEntry[]> => {
  const query = new URLSearchParams({
    tenantId,
    documentType,
  });
  const response = await apiFetch(
    `/api/purchases/documents/${encodeURIComponent(documentId)}/history?${query.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw await parseError(response, "Unable to load purchase document history");
  }

  const payload = (await response.json()) as { history?: PurchaseDocumentHistoryEntry[] };
  return payload.history ?? [];
};

export const getPurchaseConversionBalance = async (
  documentId: string,
  tenantId: string,
): Promise<PurchaseConversionBalance> => {
  const query = new URLSearchParams({ tenantId });
  const response = await apiFetch(
    `/api/purchases/conversion-balance/${encodeURIComponent(documentId)}?${query.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw await parseError(response, "Unable to load purchase conversion balance");
  }

  return (await response.json()) as PurchaseConversionBalance;
};

export const createPurchaseDocumentDraft = async (
  input: PurchaseDocumentDraftInput,
): Promise<PurchaseDocumentDraft> => {
  const response = await apiFetch("/api/purchases/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to save purchase draft");
  }

  const payload = (await response.json()) as { document: PurchaseDocumentDraft };
  return payload.document;
};

export const updatePurchaseDocumentDraft = async (
  documentId: string,
  input: PurchaseDocumentDraftInput,
): Promise<PurchaseDocumentDraft> => {
  const response = await apiFetch(`/api/purchases/documents/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to update purchase draft");
  }

  const payload = (await response.json()) as { document: PurchaseDocumentDraft };
  return payload.document;
};

export const postPurchaseDocumentDraft = async (
  documentId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
  input: PurchaseDocumentPostInput = {},
): Promise<PurchaseDocumentDraft> => {
  const response = await apiFetch(`/api/purchases/documents/${encodeURIComponent(documentId)}/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType, ...input }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to post purchase document");
  }

  const payload = (await response.json()) as { document: PurchaseDocumentDraft };
  return payload.document;
};

export const deletePurchaseDocumentDraft = async (
  documentId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
): Promise<void> => {
  const response = await apiFetch(`/api/purchases/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to delete purchase draft");
  }
};

export const transitionPurchaseDocument = async (
  documentId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
  action: PurchaseDocumentAction,
  cancelReason?: PurchaseDocumentCancelReason | null,
): Promise<PurchaseDocumentDraft> => {
  const response = await apiFetch(`/api/purchases/documents/${encodeURIComponent(documentId)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, documentType, action, cancelReason }),
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to update purchase document status");
  }

  const payload = (await response.json()) as { document: PurchaseDocumentDraft };
  return payload.document;
};
