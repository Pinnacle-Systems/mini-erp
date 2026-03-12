import { apiFetch } from "../../lib/api";

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
  const response = await apiFetch(`/api/sales/documents?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await parseError(response, "Unable to load documents");
  }

  const payload = (await response.json()) as { documents?: SalesDocumentDraft[] };
  return payload.documents ?? [];
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
