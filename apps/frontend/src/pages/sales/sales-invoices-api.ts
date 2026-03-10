import { apiFetch } from "../../lib/api";

export type SalesInvoiceLineDraft = {
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

export type SalesInvoiceDraft = {
  id: string;
  status?: "DRAFT" | "OPEN" | "PARTIAL" | "COMPLETED" | "CANCELLED";
  postedAt?: string | null;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  notes: string;
  savedAt: string;
  lines: SalesInvoiceLineDraft[];
};

type SalesInvoiceDraftInput = {
  tenantId: string;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  notes: string;
  lines: SalesInvoiceLineDraft[];
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

export const listSalesInvoiceDrafts = async (
  tenantId: string,
  limit = 50,
): Promise<SalesInvoiceDraft[]> => {
  const query = new URLSearchParams({
    tenantId,
    limit: String(limit),
  });
  const response = await apiFetch(`/api/sales/invoices?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load invoice drafts"));
  }

  const payload = (await response.json()) as { invoices?: SalesInvoiceDraft[] };
  return payload.invoices ?? [];
};

export const createSalesInvoiceDraft = async (
  input: SalesInvoiceDraftInput,
): Promise<SalesInvoiceDraft> => {
  const response = await apiFetch("/api/sales/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to save invoice draft"));
  }

  const payload = (await response.json()) as { invoice: SalesInvoiceDraft };
  return payload.invoice;
};

export const updateSalesInvoiceDraft = async (
  invoiceId: string,
  input: SalesInvoiceDraftInput,
): Promise<SalesInvoiceDraft> => {
  const response = await apiFetch(`/api/sales/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to update invoice draft"));
  }

  const payload = (await response.json()) as { invoice: SalesInvoiceDraft };
  return payload.invoice;
};

export const postSalesInvoiceDraft = async (
  invoiceId: string,
  tenantId: string,
): Promise<SalesInvoiceDraft> => {
  const response = await apiFetch(
    `/api/sales/invoices/${encodeURIComponent(invoiceId)}/post`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to post invoice"));
  }

  const payload = (await response.json()) as { invoice: SalesInvoiceDraft };
  return payload.invoice;
};

export const deleteSalesInvoiceDraft = async (
  invoiceId: string,
  tenantId: string,
): Promise<void> => {
  const response = await apiFetch(`/api/sales/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to delete invoice draft"));
  }
};
