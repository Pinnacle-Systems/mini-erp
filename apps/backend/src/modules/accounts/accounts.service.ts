import { prisma } from "../../lib/prisma.js";
import { BadRequestError, NotFoundError } from "../../shared/utils/errors.js";

const prismaAny = prisma as any;

const DEFAULT_FINANCIAL_ACCOUNTS = [
  { name: "Cash on Hand", accountType: "CASH" },
  { name: "Bank Account", accountType: "BANK" },
  { name: "UPI", accountType: "UPI" },
  { name: "Credit Card", accountType: "CREDIT_CARD" },
] as const;

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Software", systemKey: "SOFTWARE" },
  { name: "Travel", systemKey: "TRAVEL" },
  { name: "Rent", systemKey: "RENT" },
  { name: "Office Supplies", systemKey: "OFFICE_SUPPLIES" },
  { name: "Utilities", systemKey: "UTILITIES" },
  { name: "Marketing", systemKey: "MARKETING" },
  { name: "Miscellaneous", systemKey: "MISC" },
] as const;
const SYSTEM_CURRENCY = "INR";
const SETTLEMENT_EPSILON = 0.01;

const RECEIVABLE_DOCUMENT_TYPES = ["SALES_INVOICE"] as const;
const PAYABLE_DOCUMENT_TYPES = ["PURCHASE_INVOICE"] as const;

type FinancialDocumentType = (typeof RECEIVABLE_DOCUMENT_TYPES)[number] | (typeof PAYABLE_DOCUMENT_TYPES)[number];
type DocumentFlow = "RECEIVABLE" | "PAYABLE";
type SettlementStatus = "N_A" | "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
type SettlementDocumentStatus = "DRAFT" | "OPEN" | "PARTIAL" | "COMPLETED" | "EXPIRED" | "CANCELLED" | "VOID";
type SettlementSourceDocument = {
  id: string;
  documentType: FinancialDocumentType;
  status: SettlementDocumentStatus | string | null | undefined;
  grandTotal: number;
};
type SettlementSummary = {
  grossDocumentAmount: number;
  paidAmount: number;
  appliedReturnAmount: number;
  netOutstandingAmount: number;
  outstandingAmount: number;
  settlementStatus: SettlementStatus;
  paymentStatus: SettlementStatus;
  lastPaymentAt: string | null;
  fullySettledAt: string | null;
};
type OpenFinancialDocumentSummary = {
  id: string;
  documentType: FinancialDocumentType;
  billNumber: string;
  partyId: string | null;
  partyName: string;
  locationId: string | null;
  grossDocumentAmount: number;
  paidAmount: number;
  appliedReturnAmount: number;
  netOutstandingAmount: number;
  outstandingAmount: number;
  settlementStatus: SettlementStatus;
  paymentStatus: SettlementStatus;
  postedAt: string | null;
  lastPaymentAt: string | null;
  fullySettledAt: string | null;
};

type PartyFinancialSummary = {
  partyId: string;
  flow: DocumentFlow;
  totalOutstanding: number;
  openDocumentCount: number;
  unappliedAmount: number;
  documentCreditAmount: number;
  recentMovements: Array<{
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
    partyName: string;
    locationId: string | null;
    referenceNo: string;
    notes: string;
  }>;
};

type MoneyMovementListRow = PartyFinancialSummary["recentMovements"][number];

const ensureDefaults = async (tenantId: string) => {
  const [accountCount, categoryCount] = await Promise.all([
    prismaAny.financialAccount.count({
      where: { business_id: tenantId },
    }),
    prismaAny.expenseCategory.count({
      where: { business_id: tenantId },
    }),
  ]);

  if (accountCount === 0) {
    await prismaAny.financialAccount.createMany({
      data: DEFAULT_FINANCIAL_ACCOUNTS.map((account) => ({
        business_id: tenantId,
        name: account.name,
        account_type: account.accountType,
        currency: "INR",
        opening_balance: 0,
        is_active: true,
      })),
      skipDuplicates: true,
    });
  }

  if (categoryCount === 0) {
    await prismaAny.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
        business_id: tenantId,
        name: category.name,
        system_key: category.systemKey,
        is_active: true,
      })),
      skipDuplicates: true,
    });
  }
};

const parsePartySnapshotName = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" ? name.trim() : "";
};

const normalizeCurrency = (value: string | null | undefined) =>
  value?.trim().toUpperCase() || SYSTEM_CURRENCY;

const assertSystemCurrency = (currency: string | null | undefined) => {
  const normalized = normalizeCurrency(currency);
  if (normalized !== SYSTEM_CURRENCY) {
    throw new BadRequestError(`Only ${SYSTEM_CURRENCY} currency is supported in this phase`);
  }
  return normalized;
};

const deriveSettlementStatus = (
  status: SettlementSourceDocument["status"],
  grossAmount: number,
  totalReduction: number,
): SettlementStatus => {
  if (status === "CANCELLED" || status === "VOID") {
    return "N_A";
  }

  const netOutstanding = grossAmount - totalReduction;
  if (Math.abs(netOutstanding) <= SETTLEMENT_EPSILON) {
    return "PAID";
  }
  if (netOutstanding < -SETTLEMENT_EPSILON) {
    return "OVERPAID";
  }
  if (totalReduction <= SETTLEMENT_EPSILON) {
    return "UNPAID";
  }
  return "PARTIAL";
};

const buildSettlementMap = async (
  tenantId: string,
  documents: SettlementSourceDocument[],
): Promise<Map<string, SettlementSummary>> => {
  const invoiceDocuments = documents.filter(
    (document) =>
      document.documentType === "SALES_INVOICE" || document.documentType === "PURCHASE_INVOICE",
  );

  const result = new Map<string, SettlementSummary>();
  for (const document of documents) {
    result.set(document.id, {
      grossDocumentAmount: document.grandTotal,
      paidAmount: 0,
      appliedReturnAmount: 0,
      netOutstandingAmount: document.grandTotal,
      outstandingAmount: document.grandTotal,
      settlementStatus:
        document.documentType === "SALES_INVOICE" || document.documentType === "PURCHASE_INVOICE"
          ? deriveSettlementStatus(document.status, document.grandTotal, 0)
          : "N_A",
      paymentStatus:
        document.documentType === "SALES_INVOICE" || document.documentType === "PURCHASE_INVOICE"
          ? deriveSettlementStatus(document.status, document.grandTotal, 0)
          : "N_A",
      lastPaymentAt: null,
      fullySettledAt: null,
    });
  }

  if (invoiceDocuments.length === 0) {
    return result;
  }

  const expectedDirectionByType = new Map<FinancialDocumentType, "INFLOW" | "OUTFLOW">([
    ["SALES_INVOICE", "INFLOW"],
    ["PURCHASE_INVOICE", "OUTFLOW"],
  ]);

  const allocationRows = await prismaAny.moneyMovementAllocation.findMany({
    where: {
      business_id: tenantId,
      document_id: {
        in: invoiceDocuments.map((document) => document.id),
      },
      document_type: {
        in: invoiceDocuments.map((document) => document.documentType),
      },
    },
    select: {
      document_id: true,
      document_type: true,
      allocated_amount: true,
      money_movement: {
        select: {
          direction: true,
          status: true,
          occurred_at: true,
        },
      },
    },
    orderBy: [
      {
        money_movement: {
          occurred_at: "asc",
        },
      },
      {
        document_id: "asc",
      },
    ],
  });

  const groupedRows = new Map<string, typeof allocationRows>();
  for (const row of allocationRows) {
    if (
      row.money_movement.status !== "POSTED" ||
      expectedDirectionByType.get(row.document_type as FinancialDocumentType) !== row.money_movement.direction
    ) {
      continue;
    }
    const current = groupedRows.get(row.document_id) ?? [];
    current.push(row);
    groupedRows.set(row.document_id, current);
  }

  const purchaseReturnRows = await prismaAny.document.findMany({
    where: {
      business_id: tenantId,
      type: "PURCHASE_RETURN",
      parent_id: {
        in: invoiceDocuments
          .filter((document) => document.documentType === "PURCHASE_INVOICE")
          .map((document) => document.id),
      },
      posted_at: {
        not: null,
      },
      deleted_at: null,
      status: {
        notIn: ["CANCELLED", "VOID"],
      },
    },
    select: {
      parent_id: true,
      grand_total: true,
      posted_at: true,
    },
    orderBy: [
      {
        posted_at: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  const groupedReturns = new Map<string, typeof purchaseReturnRows>();
  for (const row of purchaseReturnRows) {
    if (typeof row.parent_id !== "string") {
      continue;
    }
    const current = groupedReturns.get(row.parent_id) ?? [];
    current.push(row);
    groupedReturns.set(row.parent_id, current);
  }

  const salesReturnRows = await prismaAny.document.findMany({
    where: {
      business_id: tenantId,
      type: "SALES_RETURN",
      parent_id: {
        in: invoiceDocuments
          .filter((document) => document.documentType === "SALES_INVOICE")
          .map((document) => document.id),
      },
      posted_at: {
        not: null,
      },
      deleted_at: null,
      status: {
        notIn: ["CANCELLED", "VOID"],
      },
    },
    select: {
      parent_id: true,
      grand_total: true,
      posted_at: true,
    },
    orderBy: [
      {
        posted_at: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  const groupedSalesReturns = new Map<string, typeof salesReturnRows>();
  for (const row of salesReturnRows) {
    if (typeof row.parent_id !== "string") {
      continue;
    }
    const current = groupedSalesReturns.get(row.parent_id) ?? [];
    current.push(row);
    groupedSalesReturns.set(row.parent_id, current);
  }

  for (const document of invoiceDocuments) {
    const rows = groupedRows.get(document.id) ?? [];
    const purchaseReturnRowsForDocument =
      document.documentType === "PURCHASE_INVOICE" ? (groupedReturns.get(document.id) ?? []) : [];
    const salesReturnRowsForDocument =
      document.documentType === "SALES_INVOICE"
        ? (groupedSalesReturns.get(document.id) ?? [])
        : [];
    let paidAmount = 0;
    let appliedReturnAmount = 0;
    let lastPaymentAt: string | null = null;
    let fullySettledAt: string | null = null;

    const settlementEvents: Array<{ occurredAt: string; amount: number }> = [];

    for (const row of rows) {
      const occurredAt = row.money_movement.occurred_at.toISOString();
      const amount = Number(row.allocated_amount ?? 0);
      paidAmount += amount;
      lastPaymentAt = occurredAt;
      settlementEvents.push({ occurredAt, amount });
    }

    for (const row of [...purchaseReturnRowsForDocument, ...salesReturnRowsForDocument]) {
      const occurredAt = row.posted_at.toISOString();
      const amount = Number(row.grand_total ?? 0);
      appliedReturnAmount += amount;
      settlementEvents.push({ occurredAt, amount });
    }

    settlementEvents.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    let runningReduction = 0;
    for (const event of settlementEvents) {
      runningReduction += event.amount;
      if (!fullySettledAt && Math.abs(document.grandTotal - runningReduction) <= SETTLEMENT_EPSILON) {
        fullySettledAt = event.occurredAt;
      }
    }

    const totalReduction = paidAmount + appliedReturnAmount;
    const netOutstandingAmount = Number((document.grandTotal - totalReduction).toFixed(2));
    const outstandingAmount = Math.max(0, netOutstandingAmount);
    const settlementStatus = deriveSettlementStatus(
      document.status,
      document.grandTotal,
      totalReduction,
    );

    result.set(document.id, {
      grossDocumentAmount: document.grandTotal,
      paidAmount: Number(paidAmount.toFixed(2)),
      appliedReturnAmount: Number(appliedReturnAmount.toFixed(2)),
      netOutstandingAmount,
      outstandingAmount,
      settlementStatus,
      paymentStatus: settlementStatus,
      lastPaymentAt,
      fullySettledAt: settlementStatus === "PAID" ? fullySettledAt : null,
    });
  }

  return result;
};

const toOpenFinancialDocumentSummary = (
  document: {
    id: string;
    documentType: FinancialDocumentType;
    billNumber: string;
    partyId: string | null;
    partyName: string;
    locationId: string | null;
    status: SettlementSourceDocument["status"];
    grandTotal: number;
    postedAt: string | null;
  },
  settlement: SettlementSummary,
): OpenFinancialDocumentSummary => ({
  id: document.id,
  documentType: document.documentType,
  billNumber: document.billNumber,
  partyId: document.partyId,
  partyName: document.partyName,
  locationId: document.locationId,
  grossDocumentAmount: settlement.grossDocumentAmount,
  paidAmount: settlement.paidAmount,
  appliedReturnAmount: settlement.appliedReturnAmount,
  netOutstandingAmount: settlement.netOutstandingAmount,
  outstandingAmount: settlement.outstandingAmount,
  settlementStatus: settlement.settlementStatus,
  paymentStatus: settlement.paymentStatus,
  postedAt: document.postedAt,
  lastPaymentAt: settlement.lastPaymentAt,
  fullySettledAt: settlement.fullySettledAt,
});

const isAllowedDocumentType = (
  allowedTypes: readonly FinancialDocumentType[],
  documentType: FinancialDocumentType,
) => allowedTypes.includes(documentType);

const getPostedDocumentsForFlow = async (
  tenantId: string,
  flow: DocumentFlow,
  limit?: number,
): Promise<OpenFinancialDocumentSummary[]> => {
  const allowedTypes = flow === "RECEIVABLE" ? RECEIVABLE_DOCUMENT_TYPES : PAYABLE_DOCUMENT_TYPES;
  const rows = await prismaAny.document.findMany({
    where: {
      business_id: tenantId,
      type: {
        in: [...allowedTypes],
      },
      posted_at: {
        not: null,
      },
      deleted_at: null,
    },
    select: {
      id: true,
      type: true,
      doc_number: true,
      grand_total: true,
      posted_at: true,
      location_id: true,
      party_id: true,
      party_snapshot: true,
      status: true,
    },
    orderBy: {
      posted_at: "desc",
    },
    ...(typeof limit === "number" ? { take: limit } : {}),
  });

  const settlementById = await buildSettlementMap(
    tenantId,
    rows.map((row: any) => ({
      id: String(row.id),
      documentType: row.type as FinancialDocumentType,
      status: row.status as SettlementSourceDocument["status"],
      grandTotal: Number(row.grand_total ?? 0),
    })),
  );

  return rows
    .filter((row: any) => !["CANCELLED", "VOID"].includes(String(row.status ?? "")))
    .map((row: any): OpenFinancialDocumentSummary =>
      toOpenFinancialDocumentSummary(
        {
          id: String(row.id),
          documentType: row.type as FinancialDocumentType,
          billNumber: String(row.doc_number),
          partyId: typeof row.party_id === "string" ? row.party_id : null,
          partyName: parsePartySnapshotName(row.party_snapshot),
          locationId: typeof row.location_id === "string" ? row.location_id : null,
          status: row.status as SettlementSourceDocument["status"],
          grandTotal: Number(row.grand_total ?? 0),
          postedAt: row.posted_at instanceof Date ? row.posted_at.toISOString() : null,
        },
        settlementById.get(String(row.id)) ?? {
          grossDocumentAmount: Number(row.grand_total ?? 0),
          paidAmount: 0,
          appliedReturnAmount: 0,
          netOutstandingAmount: Number(row.grand_total ?? 0),
          outstandingAmount: Number(row.grand_total ?? 0),
          settlementStatus:
            row.type === "SALES_INVOICE" || row.type === "PURCHASE_INVOICE" ? "UNPAID" : "N_A",
          paymentStatus:
            row.type === "SALES_INVOICE" || row.type === "PURCHASE_INVOICE" ? "UNPAID" : "N_A",
          lastPaymentAt: null,
          fullySettledAt: null,
        },
      ),
    );
};

const getFinancialAccountOrThrow = async (tenantId: string, accountId: string) => {
  const account = await prismaAny.financialAccount.findFirst({
    where: {
      id: accountId,
      business_id: tenantId,
      archived_at: null,
      is_active: true,
    },
  });

  if (!account) {
    throw new NotFoundError("Financial account not found");
  }

  return account;
};

const getExpenseCategoryOrThrow = async (tenantId: string, categoryId: string) => {
  const category = await prismaAny.expenseCategory.findFirst({
    where: {
      id: categoryId,
      business_id: tenantId,
      archived_at: null,
      is_active: true,
    },
  });

  if (!category) {
    throw new NotFoundError("Expense category not found");
  }

  return category;
};

const validateAllocations = async (
  tenantId: string,
  flow: DocumentFlow,
  amount: number,
  allocations: Array<{ documentType: FinancialDocumentType; documentId: string; allocatedAmount: number }>,
) => {
  if (allocations.length === 0) {
    return {
      sourceDocumentType: null,
      sourceDocumentId: null,
      partyId: null,
      partyName: null,
      locationId: null,
    };
  }

  const allowedTypes = flow === "RECEIVABLE" ? RECEIVABLE_DOCUMENT_TYPES : PAYABLE_DOCUMENT_TYPES;
  const expectedAllocationTotal = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.allocatedAmount),
    0,
  );

  if (Math.abs(expectedAllocationTotal - amount) > 0.001) {
    throw new BadRequestError("Payment amount must match the allocated amount total");
  }

  const rows = await prismaAny.document.findMany({
    where: {
      id: {
        in: allocations.map((allocation) => allocation.documentId),
      },
      business_id: tenantId,
      type: {
        in: [...allowedTypes],
      },
      posted_at: {
        not: null,
      },
      deleted_at: null,
      status: {
        notIn: ["CANCELLED", "VOID"],
      },
    },
    select: {
      id: true,
      type: true,
      party_id: true,
      party_snapshot: true,
      location_id: true,
      grand_total: true,
      doc_number: true,
    },
  });

  if (rows.length !== allocations.length) {
    throw new BadRequestError("One or more selected documents cannot accept payment");
  }

  const openDocuments = await getPostedDocumentsForFlow(tenantId, flow);
  const openById = new Map(openDocuments.map((document) => [document.id, document]));
  const partyIds = new Set<string>();
  let sourceDocumentType: FinancialDocumentType | null = null;
  let sourceDocumentId: string | null = null;
  let partyName: string | null = null;
  let locationId: string | null = null;

  for (const allocation of allocations) {
    if (!isAllowedDocumentType(allowedTypes, allocation.documentType)) {
      throw new BadRequestError("Allocation document type does not match payment flow");
    }

    const openDocument = openById.get(allocation.documentId);
    if (!openDocument) {
      throw new BadRequestError("One or more selected documents are not open for payment");
    }

    if (allocation.allocatedAmount - openDocument.outstandingAmount > 0.001) {
      throw new BadRequestError(`Allocation exceeds outstanding balance for ${openDocument.billNumber}`);
    }

    if (openDocument.partyId) {
      partyIds.add(openDocument.partyId);
    }
    sourceDocumentType = sourceDocumentType ?? openDocument.documentType;
    sourceDocumentId = sourceDocumentId ?? openDocument.id;
    partyName = partyName ?? openDocument.partyName;
    locationId = locationId ?? openDocument.locationId;
  }

  if (partyIds.size > 1) {
    throw new BadRequestError("A single payment cannot span multiple parties in v1");
  }

  return {
    sourceDocumentType,
    sourceDocumentId,
    partyId: partyIds.size === 1 ? [...partyIds][0] : null,
    partyName,
    locationId,
  };
};

const listFinancialAccounts = async (tenantId: string, includeInactive = false) => {
  await ensureDefaults(tenantId);

  const [accounts, movements] = await Promise.all([
    prismaAny.financialAccount.findMany({
      where: {
        business_id: tenantId,
        ...(includeInactive ? {} : { archived_at: null, is_active: true }),
      },
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
    }),
    prismaAny.moneyMovement.findMany({
      where: {
        business_id: tenantId,
        status: "POSTED",
      },
      select: {
        financial_account_id: true,
        direction: true,
        amount: true,
      },
    }),
  ]);

  const deltaByAccountId = new Map<string, number>();
  for (const movement of movements) {
    const current = deltaByAccountId.get(movement.financial_account_id) ?? 0;
    const next =
      current +
      (movement.direction === "INFLOW" ? Number(movement.amount) : -Number(movement.amount));
    deltaByAccountId.set(movement.financial_account_id, next);
  }

  return accounts.map((account: any) => ({
    id: String(account.id),
    name: String(account.name),
    accountType: account.account_type,
    currency: String(account.currency),
    openingBalance: Number(account.opening_balance ?? 0),
    currentBalance: Number(account.opening_balance ?? 0) + (deltaByAccountId.get(account.id) ?? 0),
    locationId: typeof account.location_id === "string" ? account.location_id : null,
    isActive: Boolean(account.is_active) && !account.archived_at,
    createdAt: account.created_at.toISOString(),
  }));
};

const createFinancialAccount = async (
  tenantId: string,
  input: {
    name: string;
    accountType: "CASH" | "BANK" | "UPI" | "CREDIT_CARD" | "OTHER";
    currency: string;
    openingBalance: number;
    locationId?: string | null;
  },
) => {
  await ensureDefaults(tenantId);
  assertSystemCurrency(input.currency);
  const created = await prismaAny.financialAccount.create({
    data: {
      business_id: tenantId,
      name: input.name.trim(),
      account_type: input.accountType,
      currency: SYSTEM_CURRENCY,
      opening_balance: input.openingBalance,
      location_id: input.locationId ?? null,
      is_active: true,
    },
  });

  return {
    id: String(created.id),
    name: String(created.name),
    accountType: created.account_type,
    currency: String(created.currency),
    openingBalance: Number(created.opening_balance ?? 0),
    currentBalance: Number(created.opening_balance ?? 0),
    locationId: typeof created.location_id === "string" ? created.location_id : null,
    isActive: Boolean(created.is_active),
    createdAt: created.created_at.toISOString(),
  };
};

const archiveFinancialAccount = async (tenantId: string, accountId: string) => {
  await getFinancialAccountOrThrow(tenantId, accountId);
  await prismaAny.financialAccount.update({
    where: { id: accountId },
    data: {
      is_active: false,
      archived_at: new Date(),
    },
  });
};

const listExpenseCategories = async (tenantId: string, includeInactive = false) => {
  await ensureDefaults(tenantId);
  const rows = await prismaAny.expenseCategory.findMany({
    where: {
      business_id: tenantId,
      ...(includeInactive ? {} : { archived_at: null, is_active: true }),
    },
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
  });

  return rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name),
    isActive: Boolean(row.is_active) && !row.archived_at,
    systemKey: typeof row.system_key === "string" ? row.system_key : null,
  }));
};

const mapMoneyMovementRows = async (
  tenantId: string,
  rows: any[],
): Promise<MoneyMovementListRow[]> => {
  const sourceDocumentIds = rows
    .map((row: any) => row.source_document_id)
    .filter((value: unknown): value is string => typeof value === "string");
  const documents = sourceDocumentIds.length
    ? await prismaAny.document.findMany({
        where: {
          id: {
            in: sourceDocumentIds,
          },
          business_id: tenantId,
        },
        select: {
          id: true,
          doc_number: true,
        },
      })
    : [];
  const documentNumberById = new Map(
    documents.map((document: any) => [String(document.id), String(document.doc_number)] as const),
  );

  return rows.map((row: any): MoneyMovementListRow => ({
    id: String(row.id),
    direction: row.direction,
    status: row.status,
    sourceKind: row.source_kind,
    sourceDocumentType:
      typeof row.source_document_type === "string" ? row.source_document_type : null,
    sourceDocumentId:
      typeof row.source_document_id === "string" ? row.source_document_id : null,
    sourceDocumentNumber:
      typeof row.source_document_id === "string"
        ? ((documentNumberById.get(row.source_document_id) as string | undefined) ?? null)
        : null,
    occurredAt: row.occurred_at.toISOString(),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency),
    accountId: String(row.financial_account.id),
    accountName: String(row.financial_account.name),
    partyId: typeof row.party_id === "string" ? row.party_id : null,
    partyName:
      typeof row.party_name_snapshot === "string" ? row.party_name_snapshot : "",
    locationId: typeof row.location_id === "string" ? row.location_id : null,
    referenceNo: typeof row.reference_no === "string" ? row.reference_no : "",
    notes: typeof row.notes === "string" ? row.notes : "",
  }));
};

const listMoneyMovements = async (
  tenantId: string,
  input: {
    sourceKind?: "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "MANUAL";
    accountId?: string;
    limit: number;
  },
) => {
  await ensureDefaults(tenantId);
  const rows = await prismaAny.moneyMovement.findMany({
    where: {
      business_id: tenantId,
      ...(input.sourceKind ? { source_kind: input.sourceKind } : {}),
      ...(input.accountId ? { financial_account_id: input.accountId } : {}),
    },
    select: {
      id: true,
      direction: true,
      status: true,
      source_kind: true,
      source_document_type: true,
      source_document_id: true,
      occurred_at: true,
      amount: true,
      currency: true,
      party_id: true,
      party_name_snapshot: true,
      location_id: true,
      reference_no: true,
      notes: true,
      financial_account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      occurred_at: "desc",
    },
    take: input.limit,
  });

  return mapMoneyMovementRows(tenantId, rows);
};

const getPartyFinancialSummary = async (
  tenantId: string,
  partyId: string,
  flow: DocumentFlow,
): Promise<PartyFinancialSummary> => {
  await ensureDefaults(tenantId);

  const [documents, paymentRows] = await Promise.all([
    getPostedDocumentsForFlow(tenantId, flow),
    prismaAny.moneyMovement.findMany({
      where: {
        business_id: tenantId,
        party_id: partyId,
        status: "POSTED",
        direction: flow === "RECEIVABLE" ? "INFLOW" : "OUTFLOW",
        source_kind: flow === "RECEIVABLE" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE",
      },
      select: {
        id: true,
        direction: true,
        status: true,
        source_kind: true,
        source_document_type: true,
        source_document_id: true,
        occurred_at: true,
        amount: true,
        currency: true,
        party_id: true,
        party_name_snapshot: true,
        location_id: true,
        reference_no: true,
        notes: true,
        financial_account: {
          select: {
            id: true,
            name: true,
          },
        },
        allocations: {
          select: {
            allocated_amount: true,
          },
        },
      },
      orderBy: {
        occurred_at: "desc",
      },
      take: 10,
    }),
  ]);

  const partyDocuments = documents.filter((document) => document.partyId === partyId);
  const totalOutstanding = partyDocuments.reduce((sum, document) => sum + document.outstandingAmount, 0);
  const openDocumentCount = partyDocuments.filter(
    (document) => document.outstandingAmount > SETTLEMENT_EPSILON,
  ).length;
  const documentCreditAmount = partyDocuments.reduce((sum, document) => {
    if (document.netOutstandingAmount >= -SETTLEMENT_EPSILON) {
      return sum;
    }
    return sum + Math.abs(document.netOutstandingAmount);
  }, 0);

  const unappliedAmount = paymentRows.reduce((sum: number, row: any) => {
    const allocatedAmount = (row.allocations ?? []).reduce(
      (allocatedSum: number, allocation: any) =>
        allocatedSum + Number(allocation.allocated_amount ?? 0),
      0,
    );
    return sum + Math.max(0, Number(row.amount ?? 0) - allocatedAmount);
  }, 0);

  return {
    partyId,
    flow,
    totalOutstanding: Number(totalOutstanding.toFixed(2)),
    openDocumentCount,
    unappliedAmount: Number(unappliedAmount.toFixed(2)),
    documentCreditAmount: Number(documentCreditAmount.toFixed(2)),
    recentMovements: await mapMoneyMovementRows(tenantId, paymentRows),
  };
};

const voidMoneyMovement = async (tenantId: string, movementId: string) => {
  const movement = await prismaAny.moneyMovement.findFirst({
    where: {
      id: movementId,
      business_id: tenantId,
    },
    select: {
      id: true,
      status: true,
      source_kind: true,
      source_document_type: true,
      source_document_id: true,
      occurred_at: true,
      amount: true,
      currency: true,
      party_id: true,
      party_name_snapshot: true,
      location_id: true,
      reference_no: true,
      notes: true,
      financial_account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!movement) {
    throw new NotFoundError("Money movement not found");
  }
  if (movement.status === "VOIDED") {
    throw new BadRequestError("Money movement is already voided");
  }
  if (!["PAYMENT_RECEIVED", "PAYMENT_MADE", "MANUAL"].includes(String(movement.source_kind))) {
    throw new BadRequestError("Only payment or manual money movements can be voided in this phase");
  }

  const updated = await prismaAny.moneyMovement.update({
    where: {
      id: movementId,
    },
    data: {
      status: "VOIDED",
    },
    select: {
      id: true,
      direction: true,
      status: true,
      source_kind: true,
      source_document_type: true,
      source_document_id: true,
      occurred_at: true,
      amount: true,
      currency: true,
      party_id: true,
      party_name_snapshot: true,
      location_id: true,
      reference_no: true,
      notes: true,
      financial_account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const documentNumberById =
    typeof updated.source_document_id === "string"
      ? new Map(
          (
            await prismaAny.document.findMany({
              where: {
                id: updated.source_document_id,
                business_id: tenantId,
              },
              select: {
                id: true,
                doc_number: true,
              },
            })
          ).map((document: any) => [String(document.id), String(document.doc_number)] as const),
        )
      : new Map<string, string>();

  return {
    id: String(updated.id),
    direction: updated.direction,
    status: updated.status,
    sourceKind: updated.source_kind,
    sourceDocumentType:
      typeof updated.source_document_type === "string" ? updated.source_document_type : null,
    sourceDocumentId:
      typeof updated.source_document_id === "string" ? updated.source_document_id : null,
    sourceDocumentNumber:
      typeof updated.source_document_id === "string"
        ? (documentNumberById.get(updated.source_document_id) ?? null)
        : null,
    occurredAt: updated.occurred_at.toISOString(),
    amount: Number(updated.amount ?? 0),
    currency: String(updated.currency),
    accountId: String(updated.financial_account.id),
    accountName: String(updated.financial_account.name),
    partyId: typeof updated.party_id === "string" ? updated.party_id : null,
    partyName:
      typeof updated.party_name_snapshot === "string" ? updated.party_name_snapshot : "",
    locationId: typeof updated.location_id === "string" ? updated.location_id : null,
    referenceNo: typeof updated.reference_no === "string" ? updated.reference_no : "",
    notes: typeof updated.notes === "string" ? updated.notes : "",
  };
};

const recordPayment = async (
  tenantId: string,
  flow: DocumentFlow,
  input: {
    occurredAt: string;
    amount: number;
    financialAccountId: string;
    referenceNo?: string;
    notes?: string;
    allocations: Array<{ documentType: FinancialDocumentType; documentId: string; allocatedAmount: number }>;
  },
) => {
  await ensureDefaults(tenantId);
  await getFinancialAccountOrThrow(tenantId, input.financialAccountId);
  const allocationContext = await validateAllocations(tenantId, flow, input.amount, input.allocations);

  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const movement = await txAny.moneyMovement.create({
      data: {
        business_id: tenantId,
        direction: flow === "RECEIVABLE" ? "INFLOW" : "OUTFLOW",
        status: "POSTED",
        source_kind: flow === "RECEIVABLE" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE",
        source_document_type: allocationContext.sourceDocumentType,
        source_document_id: allocationContext.sourceDocumentId,
        occurred_at: new Date(input.occurredAt),
        amount: input.amount,
        currency: SYSTEM_CURRENCY,
        financial_account_id: input.financialAccountId,
        party_id: allocationContext.partyId,
        party_name_snapshot: allocationContext.partyName,
        location_id: allocationContext.locationId,
        reference_no: input.referenceNo?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    if (input.allocations.length > 0) {
      await txAny.moneyMovementAllocation.createMany({
        data: input.allocations.map((allocation) => ({
          business_id: tenantId,
          money_movement_id: movement.id,
          document_type: allocation.documentType,
          document_id: allocation.documentId,
          allocated_amount: allocation.allocatedAmount,
        })),
      });
    }

    return movement;
  });
};

const createExpense = async (
  tenantId: string,
  input: {
    occurredAt: string;
    amount: number;
    expenseCategoryId: string;
    financialAccountId: string;
    payeeName: string;
    referenceNo?: string;
    notes?: string;
    locationId?: string | null;
    partyId?: string | null;
  },
) => {
  await ensureDefaults(tenantId);
  await Promise.all([
    getExpenseCategoryOrThrow(tenantId, input.expenseCategoryId),
    getFinancialAccountOrThrow(tenantId, input.financialAccountId),
  ]);

  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const movement = await txAny.moneyMovement.create({
      data: {
        business_id: tenantId,
        direction: "OUTFLOW",
        status: "POSTED",
        source_kind: "EXPENSE",
        occurred_at: new Date(input.occurredAt),
        amount: input.amount,
        currency: SYSTEM_CURRENCY,
        financial_account_id: input.financialAccountId,
        party_id: input.partyId ?? null,
        party_name_snapshot: input.payeeName.trim(),
        location_id: input.locationId ?? null,
        reference_no: input.referenceNo?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    const expense = await txAny.expense.create({
      data: {
        business_id: tenantId,
        occurred_at: new Date(input.occurredAt),
        amount: input.amount,
        currency: "INR",
        payee_name: input.payeeName.trim(),
        party_id: input.partyId ?? null,
        expense_category_id: input.expenseCategoryId,
        location_id: input.locationId ?? null,
        financial_account_id: input.financialAccountId,
        reference_no: input.referenceNo?.trim() || null,
        notes: input.notes?.trim() || null,
        money_movement_id: movement.id,
      },
      include: {
        expense_category: {
          select: {
            name: true,
          },
        },
        financial_account: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: String(expense.id),
      occurredAt: expense.occurred_at.toISOString(),
      amount: Number(expense.amount ?? 0),
      currency: String(expense.currency),
      payeeName: String(expense.payee_name),
      categoryId: String(expense.expense_category_id),
      categoryName: String(expense.expense_category.name),
      accountId: String(expense.financial_account_id),
      accountName: String(expense.financial_account.name),
      referenceNo: typeof expense.reference_no === "string" ? expense.reference_no : "",
      notes: typeof expense.notes === "string" ? expense.notes : "",
      locationId: typeof expense.location_id === "string" ? expense.location_id : null,
      moneyMovementId: String(expense.money_movement_id),
    };
  });
};

const listExpenses = async (
  tenantId: string,
  input: {
    categoryId?: string;
    accountId?: string;
    limit: number;
  },
) => {
  await ensureDefaults(tenantId);
  const rows = await prismaAny.expense.findMany({
    where: {
      business_id: tenantId,
      ...(input.categoryId ? { expense_category_id: input.categoryId } : {}),
      ...(input.accountId ? { financial_account_id: input.accountId } : {}),
    },
    include: {
      expense_category: {
        select: {
          name: true,
        },
      },
      financial_account: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      occurred_at: "desc",
    },
    take: input.limit,
  });

  return rows.map((row: any) => ({
    id: String(row.id),
    occurredAt: row.occurred_at.toISOString(),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency),
    payeeName: String(row.payee_name),
    categoryId: String(row.expense_category_id),
    categoryName: String(row.expense_category.name),
    accountId: String(row.financial_account_id),
    accountName: String(row.financial_account.name),
    referenceNo: typeof row.reference_no === "string" ? row.reference_no : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    locationId: typeof row.location_id === "string" ? row.location_id : null,
    moneyMovementId: String(row.money_movement_id),
  }));
};

const getOverview = async (tenantId: string) => {
  await ensureDefaults(tenantId);

  const [receivables, payables, accounts, recentMovements, expenseRows] = await Promise.all([
    getPostedDocumentsForFlow(tenantId, "RECEIVABLE"),
    getPostedDocumentsForFlow(tenantId, "PAYABLE"),
    listFinancialAccounts(tenantId, false),
    listMoneyMovements(tenantId, { limit: 10 }),
    prismaAny.expense.findMany({
      where: {
        business_id: tenantId,
      },
      select: {
        amount: true,
        occurred_at: true,
        expense_category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let thisMonthInflow = 0;
  let thisMonthOutflow = 0;
  for (const movement of recentMovements) {
    if (new Date(movement.occurredAt) < monthStart) {
      continue;
    }
    if (movement.direction === "INFLOW") {
      thisMonthInflow += movement.amount;
    } else {
      thisMonthOutflow += movement.amount;
    }
  }

  const expenseByCategoryMap = new Map<string, { categoryId: string; categoryName: string; amount: number }>();
  let thisMonthExpenseTotal = 0;
  for (const row of expenseRows) {
    if (row.occurred_at >= monthStart) {
      thisMonthExpenseTotal += Number(row.amount ?? 0);
    }
    const current = expenseByCategoryMap.get(row.expense_category.id) ?? {
      categoryId: String(row.expense_category.id),
      categoryName: String(row.expense_category.name),
      amount: 0,
    };
    current.amount += Number(row.amount ?? 0);
    expenseByCategoryMap.set(row.expense_category.id, current);
  }

  return {
    receivableTotal: receivables.reduce((sum, row) => sum + row.outstandingAmount, 0),
    payableTotal: payables.reduce((sum, row) => sum + row.outstandingAmount, 0),
    vendorCreditTotal: payables.reduce((sum, row) => {
      if (row.documentType !== "PURCHASE_INVOICE" || row.netOutstandingAmount >= -SETTLEMENT_EPSILON) {
        return sum;
      }
      return sum + Math.abs(row.netOutstandingAmount);
    }, 0),
    thisMonthInflow,
    thisMonthOutflow,
    thisMonthExpenseTotal,
    accountBalances: accounts,
    recentMovements,
    expenseByCategory: [...expenseByCategoryMap.values()].sort((left, right) => right.amount - left.amount),
  };
};

const getDocumentBalance = async (
  tenantId: string,
  documentType: FinancialDocumentType,
  documentId: string,
) => {
  const document = await prismaAny.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      type: documentType,
      posted_at: {
        not: null,
      },
      deleted_at: null,
    },
    select: {
      id: true,
      type: true,
      status: true,
      doc_number: true,
      grand_total: true,
      posted_at: true,
      location_id: true,
      party_id: true,
      party_snapshot: true,
    },
  });

  if (!document) {
    throw new NotFoundError("Financial document not found");
  }

  const settlement = (
    await buildSettlementMap(tenantId, [
      {
        id: String(document.id),
        documentType: document.type as FinancialDocumentType,
        status: document.status as SettlementSourceDocument["status"],
        grandTotal: Number(document.grand_total ?? 0),
      },
    ])
  ).get(String(document.id));

  return toOpenFinancialDocumentSummary(
    {
      id: String(document.id),
      documentType: document.type as FinancialDocumentType,
      billNumber: String(document.doc_number),
      partyId: typeof document.party_id === "string" ? document.party_id : null,
      partyName: parsePartySnapshotName(document.party_snapshot),
      locationId: typeof document.location_id === "string" ? document.location_id : null,
      status: document.status as SettlementSourceDocument["status"],
      grandTotal: Number(document.grand_total ?? 0),
      postedAt: document.posted_at instanceof Date ? document.posted_at.toISOString() : null,
    },
    settlement ?? {
      grossDocumentAmount: Number(document.grand_total ?? 0),
      paidAmount: 0,
      appliedReturnAmount: 0,
      netOutstandingAmount: Number(document.grand_total ?? 0),
      outstandingAmount: Number(document.grand_total ?? 0),
      settlementStatus:
        document.type === "SALES_INVOICE" || document.type === "PURCHASE_INVOICE" ? "UNPAID" : "N_A",
      paymentStatus:
        document.type === "SALES_INVOICE" || document.type === "PURCHASE_INVOICE" ? "UNPAID" : "N_A",
      lastPaymentAt: null,
      fullySettledAt: null,
    },
  );
};

export default {
  ensureDefaults,
  listFinancialAccounts,
  createFinancialAccount,
  archiveFinancialAccount,
  listExpenseCategories,
  listMoneyMovements,
  voidMoneyMovement,
  listExpenses,
  listOpenDocuments: async (tenantId: string, flow: DocumentFlow, limit?: number) =>
    (await getPostedDocumentsForFlow(tenantId, flow, limit)).filter(
      (document) => document.outstandingAmount > SETTLEMENT_EPSILON,
    ),
  createReceivedPayment: (
    tenantId: string,
    input: Parameters<typeof recordPayment>[2],
  ) => recordPayment(tenantId, "RECEIVABLE", input),
  createMadePayment: (
    tenantId: string,
    input: Parameters<typeof recordPayment>[2],
  ) => recordPayment(tenantId, "PAYABLE", input),
  createExpense,
  getOverview,
  getDocumentBalance,
  getPartyFinancialSummary,
  buildSettlementMap,
};
