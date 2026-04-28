import { apiFetch } from "../../lib/api";

type ApiErrorShape = {
  message?: string;
};

export class FinancialApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FinancialApiError";
    this.status = status;
  }
}

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as ApiErrorShape | null;
  return new FinancialApiError(payload?.message ?? fallback, response.status);
};

export type FinancialAccountRow = {
  id: string;
  name: string;
  accountType: "CASH" | "BANK" | "UPI" | "CREDIT_CARD" | "OTHER";
  currency: string;
  openingBalance: number;
  currentBalance: number;
  locationId: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ExpenseCategoryRow = {
  id: string;
  name: string;
  isActive: boolean;
  systemKey: string | null;
};

export type MoneyMovementRow = {
  id: string;
  direction: "INFLOW" | "OUTFLOW";
  status: "POSTED" | "VOIDED";
  sourceKind: "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "MANUAL";
  sourceDocumentType: string | null;
  sourceDocumentId: string | null;
  sourceDocumentNumber: string | null;
  occurredAt: string;
  amount: number;
  currency: string;
  accountId: string;
  accountName: string;
  partyId: string | null;
  partyName: string | null;
  locationId: string | null;
  referenceNo: string;
  notes: string;
  allocatedAmount: number;
  unallocatedAmount: number;
};

export type PaymentAllocationRow = {
  id: string;
  documentType: FinancialDocumentType;
  documentId: string;
  documentNumber: string | null;
  allocatedAmount: number;
  status: "ACTIVE" | "REVERSED";
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  createdAt: string;
};

export type ExpenseRow = {
  id: string;
  occurredAt: string;
  amount: number;
  currency: string;
  status: "POSTED" | "VOIDED";
  payeeName: string;
  categoryId: string;
  categoryName: string;
  accountId: string;
  accountName: string;
  referenceNo: string;
  notes: string;
  locationId: string | null;
  moneyMovementId: string;
};

export type FinancialDocumentBalanceRow = {
  id: string;
  documentType: "SALES_INVOICE" | "SALES_RETURN" | "PURCHASE_INVOICE" | "PURCHASE_RETURN";
  billNumber: string;
  partyId: string | null;
  partyName: string;
  locationId: string | null;
  grossDocumentAmount: number;
  paidAmount: number;
  appliedReturnAmount: number;
  netOutstandingAmount: number;
  outstandingAmount: number;
  settlementStatus: "N_A" | "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
  paymentStatus: "N_A" | "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
  postedAt: string | null;
  lastPaymentAt: string | null;
  fullySettledAt: string | null;
};

type FinancialDocumentType =
  | "SALES_INVOICE"
  | "SALES_RETURN"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN";

export type FinancialOverview = {
  receivableTotal: number;
  customerCreditTotal: number;
  payableTotal: number;
  vendorCreditTotal: number;
  thisMonthInflow: number;
  thisMonthOutflow: number;
  thisMonthExpenseTotal: number;
  accountBalances: FinancialAccountRow[];
  recentMovements: MoneyMovementRow[];
  expenseByCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
  }>;
};

export type PartyBalanceRow = {
  partyId: string;
  partyName: string;
  receivableOutstanding: number;
  payableOutstanding: number;
  receivableDocumentCount: number;
  payableDocumentCount: number;
  customerCreditAmount: number;
  vendorCreditAmount: number;
  lastActivityAt: string | null;
};

export type PartyFinancialSummary = {
  partyId: string;
  flow: "RECEIVABLE" | "PAYABLE";
  totalOutstanding: number;
  openDocumentCount: number;
  unappliedAmount: number;
  documentCreditAmount: number;
  recentMovements: MoneyMovementRow[];
};

export type InvoiceSettlementSummary = Pick<
  FinancialDocumentBalanceRow,
  | "grossDocumentAmount"
  | "paidAmount"
  | "appliedReturnAmount"
  | "netOutstandingAmount"
  | "outstandingAmount"
  | "settlementStatus"
  | "paymentStatus"
  | "lastPaymentAt"
  | "fullySettledAt"
>;

export const getFinancialOverview = async (tenantId: string): Promise<FinancialOverview> => {
  const query = new URLSearchParams({ tenantId });
  const response = await apiFetch(`/api/accounts/overview?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load financial overview");
  return (await response.json()) as FinancialOverview;
};

export const listPartyBalances = async (tenantId: string): Promise<PartyBalanceRow[]> => {
  const query = new URLSearchParams({ tenantId });
  const response = await apiFetch(`/api/accounts/party-balances?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) throw await parseError(response, "Unable to load party balances");
  const payload = (await response.json()) as { balances?: PartyBalanceRow[] };
  return payload.balances ?? [];
};

export const getPartyFinancialSummary = async (
  tenantId: string,
  partyId: string,
  flow: "RECEIVABLE" | "PAYABLE",
): Promise<PartyFinancialSummary> => {
  const query = new URLSearchParams({ tenantId, partyId, flow });
  const response = await apiFetch(`/api/accounts/party-summary?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) throw await parseError(response, "Unable to load party financial summary");
  const payload = (await response.json()) as { summary?: PartyFinancialSummary };
  if (!payload.summary) {
    throw new FinancialApiError("Unable to load party financial summary", response.status);
  }
  return payload.summary;
};

export const listFinancialAccounts = async (
  tenantId: string,
  includeInactive = false,
): Promise<FinancialAccountRow[]> => {
  const query = new URLSearchParams({ tenantId, includeInactive: String(includeInactive) });
  const response = await apiFetch(`/api/accounts/financial-accounts?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load financial accounts");
  const payload = (await response.json()) as { accounts?: FinancialAccountRow[] };
  return payload.accounts ?? [];
};

export const createFinancialAccount = async (
  input: {
    tenantId: string;
    name: string;
    accountType: FinancialAccountRow["accountType"];
    openingBalance: number;
    currency?: string;
    locationId?: string | null;
  },
): Promise<FinancialAccountRow> => {
  const response = await apiFetch("/api/accounts/financial-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Unable to create financial account");
  const payload = (await response.json()) as { account: FinancialAccountRow };
  return payload.account;
};

export const archiveFinancialAccount = async (tenantId: string, accountId: string) => {
  const response = await apiFetch(`/api/accounts/financial-accounts/${encodeURIComponent(accountId)}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });
  if (!response.ok) throw await parseError(response, "Unable to archive financial account");
};

export const listExpenseCategories = async (
  tenantId: string,
): Promise<ExpenseCategoryRow[]> => {
  const query = new URLSearchParams({ tenantId });
  const response = await apiFetch(`/api/accounts/expense-categories?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load expense categories");
  const payload = (await response.json()) as { categories?: ExpenseCategoryRow[] };
  return payload.categories ?? [];
};

export const listMoneyMovements = async (
  tenantId: string,
  options: { sourceKind?: MoneyMovementRow["sourceKind"]; limit?: number } = {},
): Promise<MoneyMovementRow[]> => {
  const query = new URLSearchParams({ tenantId, limit: String(options.limit ?? 50) });
  if (options.sourceKind) query.set("sourceKind", options.sourceKind);
  const response = await apiFetch(`/api/accounts/money-movements?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load money movements");
  const payload = (await response.json()) as { movements?: MoneyMovementRow[] };
  return payload.movements ?? [];
};

export const voidMoneyMovement = async (
  tenantId: string,
  movementId: string,
): Promise<MoneyMovementRow> => {
  const response = await apiFetch(
    `/api/accounts/money-movements/${encodeURIComponent(movementId)}/void`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    },
  );
  if (!response.ok) throw await parseError(response, "Unable to void money movement");
  const payload = (await response.json()) as { movement?: MoneyMovementRow };
  if (!payload.movement) {
    throw new FinancialApiError("Unable to void money movement", response.status);
  }
  return payload.movement;
};

export const listExpenses = async (
  tenantId: string,
): Promise<ExpenseRow[]> => {
  const query = new URLSearchParams({ tenantId, limit: "50" });
  const response = await apiFetch(`/api/accounts/expenses?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load expenses");
  const payload = (await response.json()) as { expenses?: ExpenseRow[] };
  return payload.expenses ?? [];
};

export const listOpenDocuments = async (
  tenantId: string,
  flow: "RECEIVABLE" | "PAYABLE",
  partyId?: string,
): Promise<FinancialDocumentBalanceRow[]> => {
  const query = new URLSearchParams({ tenantId, flow, limit: "50" });
  if (partyId) query.set("partyId", partyId);
  const response = await apiFetch(`/api/accounts/open-documents?${query.toString()}`, { method: "GET" });
  if (!response.ok) throw await parseError(response, "Unable to load open documents");
  const payload = (await response.json()) as { documents?: FinancialDocumentBalanceRow[] };
  return payload.documents ?? [];
};

export const getFinancialDocumentBalance = async (
  tenantId: string,
  documentType: FinancialDocumentType,
  documentId: string,
): Promise<FinancialDocumentBalanceRow> => {
  const query = new URLSearchParams({
    tenantId,
    documentType,
    documentId,
  });
  const response = await apiFetch(`/api/accounts/document-balance?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) throw await parseError(response, "Unable to load document balance");
  const payload = (await response.json()) as { balance?: FinancialDocumentBalanceRow };
  if (!payload.balance) {
    throw new FinancialApiError("Unable to load document balance", response.status);
  }
  return payload.balance;
};

export const recordReceivedPayment = async (input: {
  tenantId: string;
  occurredAt: string;
  amount: number;
  financialAccountId: string;
  partyId: string;
  referenceNo?: string;
  notes?: string;
  allocations?: Array<{
    documentType: FinancialDocumentBalanceRow["documentType"];
    documentId: string;
    allocatedAmount: number;
  }>;
}) => {
  const response = await apiFetch("/api/accounts/payments/received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Unable to record payment received");
};

export const recordMadePayment = async (input: {
  tenantId: string;
  occurredAt: string;
  amount: number;
  financialAccountId: string;
  partyId: string;
  referenceNo?: string;
  notes?: string;
  allocations?: Array<{
    documentType: FinancialDocumentBalanceRow["documentType"];
    documentId: string;
    allocatedAmount: number;
  }>;
}) => {
  const response = await apiFetch("/api/accounts/payments/made", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Unable to record payment made");
};

export const allocatePayment = async (input: {
  movementId: string;
  allocations: Array<{
    documentType: FinancialDocumentBalanceRow["documentType"];
    documentId: string;
    allocatedAmount: number;
  }>;
}) => {
  const response = await apiFetch(
    `/api/accounts/payments/${encodeURIComponent(input.movementId)}/allocate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations: input.allocations }),
    },
  );
  if (!response.ok) throw await parseError(response, "Unable to apply payment");
};

export const listPaymentAllocations = async (
  movementId: string,
): Promise<PaymentAllocationRow[]> => {
  const response = await apiFetch(
    `/api/accounts/payments/${encodeURIComponent(movementId)}/allocations`,
    {
      method: "GET",
    },
  );
  if (!response.ok) throw await parseError(response, "Unable to load payment allocations");
  const payload = (await response.json()) as { allocations?: PaymentAllocationRow[] };
  return payload.allocations ?? [];
};

export const reversePaymentAllocation = async (input: {
  movementId: string;
  allocationId: string;
  reason?: string;
}): Promise<{
  movement: MoneyMovementRow;
  allocations: PaymentAllocationRow[];
  reversedAllocation: PaymentAllocationRow;
  documentBalance: FinancialDocumentBalanceRow;
}> => {
  const response = await apiFetch(
    `/api/accounts/payments/${encodeURIComponent(input.movementId)}/allocations/${encodeURIComponent(
      input.allocationId,
    )}/reverse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason?.trim() || undefined }),
    },
  );
  if (!response.ok) throw await parseError(response, "Unable to reverse payment allocation");
  return (await response.json()) as {
    movement: MoneyMovementRow;
    allocations: PaymentAllocationRow[];
    reversedAllocation: PaymentAllocationRow;
    documentBalance: FinancialDocumentBalanceRow;
  };
};

export const createExpense = async (input: {
  tenantId: string;
  occurredAt: string;
  amount: number;
  expenseCategoryId: string;
  financialAccountId: string;
  payeeName: string;
  referenceNo?: string;
  notes?: string;
  locationId?: string | null;
}) => {
  const response = await apiFetch("/api/accounts/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Unable to create expense");
};
