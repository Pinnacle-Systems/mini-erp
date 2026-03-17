import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Copy,
  Eye,
  FileOutput,
  History,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionReasonDialog } from "../../design-system/organisms/ActionReasonDialog";
import { DocumentHistoryDialog } from "../../design-system/organisms/DocumentHistoryDialog";
import { type DraftReviewAlert } from "../../design-system/organisms/DraftReviewPanel";
import { type FloatingActionMenuItem } from "../../design-system/organisms/FloatingActionMenu";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalCustomers,
  getLocalItemPricingRowsForDisplay,
  getLocalStockLevels,
  getLocalStockVariantOptions,
  queueCustomerCreate,
  syncOnce,
  type CustomerRow,
  type ItemPricingRow,
  type StockLevelRow,
  type StockVariantOption,
} from "../../features/sync/engine";
import { useToast } from "../../features/toast/useToast";
import { formatGstSlabLabel, normalizeGstSlab } from "../../lib/gst-slabs";
import {
  createSalesDocumentDraft,
  deleteSalesDocumentDraft,
  getSalesConversionBalance,
  getSalesDocumentHistory,
  listSalesDocuments,
  postSalesDocumentDraft,
  SalesDocumentApiError,
  transitionSalesDocument,
  updateSalesDocumentDraft,
  type SalesDocumentAction,
  type SalesDocumentCancelReason,
  type SalesDocumentDraft,
  type SalesDocumentHistoryEntry,
  type SalesDocumentType,
} from "./sales-invoices-api";

type LinkedSourceBalance = {
  sourceLineId: string;
  sourceDocumentNumber: string;
  remainingQuantity: string;
};

const SAME_ITEM_MIXED_ORIGIN_HINT =
  "Parent quantity is still available for this item. Increase the linked row to use source balance; keep this row for extra local quantity.";

export type BillLine = {
  id: string;
  sourceLineId?: string | null;
  variantId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
  stockOnHand: number | null;
};

type SavedBillDraft = Omit<SalesDocumentDraft, "lines"> & {
  lines: BillLine[];
  duplicateMeta?: EstimateDuplicateMeta | null;
};

export type SalesItemOption = StockVariantOption & {
  description: string;
  priceAmount: number | null;
  currency: string;
  gstLabel: string;
  taxRate: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  quantityOnHand: number | null;
};

export type SalesDocumentPageConfig = {
  documentType: SalesDocumentType;
  routePath: string;
  listTitle: string;
  createTitle: string;
  singularLabel: string;
  pluralLabel: string;
  listEmptyMessage: string;
  createActionLabel: string;
  postActionLabel: string;
  routeAppDraftLabel: string;
  numberPrefix: string;
  storageKeyPrefix: string;
  workspaceVariant?: "standard" | "pos";
  defaultTransactionType?: "CASH" | "CREDIT";
  openEditorByDefault?: boolean;
};

type SalesDocumentConversionConfig = {
  targetDocumentType: SalesDocumentType;
  targetRoutePath: string;
  actionLabel: string;
};

type BillingRouteState = {
  returnTo?: string;
  invoiceDraft?: Partial<SavedBillDraft>;
  draftSource?: "local" | "server";
  createdCustomer?: Partial<CustomerRow>;
  customerMessage?: string;
  customerPrefill?: {
    name?: string;
    phone?: string;
  };
};

type NumberConflictState = {
  requested: string;
  suggested: string;
};

type DraftSource = "local" | "server";

export type SalesLineFieldKey =
  | "description"
  | "quantity"
  | "unitPrice"
  | "taxRate"
  | "taxMode";

type PostDraftOptions = {
  notesOverride?: string;
};

export type PostDraftResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export const getSalesLineDescriptionInputId = (lineId: string) =>
  `sales-line-desktop-description-${lineId}`;

type EstimateDuplicateMeta = {
  sourceBillNumber: string;
  lineSourceVariantIds: Record<string, string>;
};

type EstimateDuplicateWarnings = {
  missingItems: Array<{
    lineId: string;
    description: string;
  }>;
  priceDiscrepancies: Array<{
    lineId: string;
    description: string;
    currentPrice: number;
    draftPrice: number;
  }>;
};

export type InvoiceListRow =
  | {
      source: "local";
      id: string;
      billNumber: string;
      customerName: string;
      status: "DRAFT";
      lines: BillLine[];
      total: number;
      timestamp: string;
      postedAt: string | null;
      draft: SavedBillDraft;
    }
  | {
      source: "server";
      id: string;
      billNumber: string;
      customerName: string;
      status: SalesDocumentDraft["status"];
      lines: SalesDocumentDraft["lines"];
      total: number;
      timestamp: string;
      postedAt: string | null;
      invoice: SalesDocumentDraft;
    };

export type RowMenuAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

const CANCEL_REASON_LABELS: Record<SalesDocumentCancelReason, string> = {
  CUSTOMER_DECLINED: "Customer declined",
  INTERNAL_DROP: "Internal drop",
  OTHER: "Other",
};

const createLine = (): BillLine => ({
  id: crypto.randomUUID(),
  variantId: "",
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: "0%",
  taxMode: "EXCLUSIVE",
  unit: "PCS",
  stockOnHand: null,
});

const INVOICE_NUMBER_DIGITS = 4;

const formatInvoiceNumber = (prefix: string, sequence: number) =>
  `${prefix}${String(sequence).padStart(INVOICE_NUMBER_DIGITS, "0")}`;

const parseInvoiceNumberSequence = (
  value: string | null | undefined,
  prefix: string,
) => {
  if (!value) return null;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(
    value.trim().toUpperCase(),
  );
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNextBillNumber = (
  prefix: string,
  syncedInvoices: Array<Pick<SalesDocumentDraft, "billNumber">>,
  localDrafts: Array<Pick<SavedBillDraft, "billNumber">>,
) => {
  const highestSequence = [...syncedInvoices, ...localDrafts].reduce(
    (max, invoice) => {
      const parsed = parseInvoiceNumberSequence(invoice.billNumber, prefix);
      return parsed && parsed > max ? parsed : max;
    },
    0,
  );

  return formatInvoiceNumber(prefix, highestSequence + 1);
};

export const usesTransactionType = (documentType: SalesDocumentType) =>
  documentType === "SALES_INVOICE";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toTaxRateNumber = (value: string) => {
  if (!value || value === "EXEMPT") return 0;
  const parsed = Number(value.replace("%", ""));
  return Math.max(0, Number.isFinite(parsed) ? parsed : 0);
};

export const getLineTotals = (
  line: Pick<BillLine, "quantity" | "unitPrice" | "taxRate" | "taxMode">,
) => {
  const quantity = Math.max(0, toNumber(line.quantity));
  const unitPrice = Math.max(0, toNumber(line.unitPrice));
  const taxRate = toTaxRateNumber(line.taxRate);
  const grossAmount = quantity * unitPrice;

  if (line.taxMode === "INCLUSIVE" && taxRate > 0) {
    const subTotal = grossAmount / (1 + taxRate / 100);
    const taxTotal = grossAmount - subTotal;
    return {
      subTotal,
      taxTotal,
      total: grossAmount,
    };
  }

  const subTotal = grossAmount;
  const taxTotal = subTotal * (taxRate / 100);
  return {
    subTotal,
    taxTotal,
    total: subTotal + taxTotal,
  };
};

const getDraftGrandTotal = (
  lines: Array<
    Pick<BillLine, "quantity" | "unitPrice" | "taxRate" | "taxMode">
  >,
) => lines.reduce((sum, line) => sum + getLineTotals(line).total, 0);

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
};

const formatQuantity = (value: number) => {
  if (!Number.isFinite(value)) return "1";
  const normalized = Math.max(0, value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : String(Number(normalized.toFixed(3)));
};

const sortCustomers = (rows: CustomerRow[]) =>
  [...rows].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;
    return left.entityId.localeCompare(right.entityId);
  });

const normalizePhoneCandidate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized.replace(/\D/g, "").length >= 7 ? normalized : "";
};

const getScrollContainer = (element: HTMLElement) => {
  let current = element.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const isElementVisible = (element: HTMLElement) => {
  const container = getScrollContainer(element);
  const elementRect = element.getBoundingClientRect();
  if (!container) {
    return elementRect.top >= 0 && elementRect.bottom <= window.innerHeight;
  }

  const containerRect = container.getBoundingClientRect();
  return (
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom
  );
};

const parseGstRate = (value: string | null | undefined) => {
  if (!value || value === "EXEMPT") return 0;
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasLineContent = (line: BillLine) =>
  Boolean(
    line.description.trim() ||
    line.unitPrice.trim() ||
    line.variantId.trim() ||
    (line.quantity.trim() && line.quantity.trim() !== "0"),
  );

export const normalizeLines = (lines: BillLine[]) => {
  const meaningfulLines = lines.filter(hasLineContent);
  return meaningfulLines.length > 0
    ? meaningfulLines.map((line) => ({
        ...line,
        description: line.description.trim(),
        quantity: line.quantity.trim() || "1",
        unitPrice: line.unitPrice.trim() || "0",
        taxRate: normalizeGstSlab(line.taxRate) ?? "0%",
        unit: line.unit.trim() || "PCS",
      }))
    : [];
};

const getPostValidationMessage = (input: {
  documentType: SalesDocumentType;
  activeStore: string | null;
  isOnline: boolean;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  activeCustomer: CustomerRow | null;
  customerName: string;
  lines: BillLine[];
  singularLabel: string;
  pluralLabel: string;
}) => {
  if (!input.activeStore) {
    return `Select a business before posting a ${input.singularLabel}.`;
  }
  if (!input.isOnline) {
    return `You are offline. Reconnect to post this ${input.singularLabel}.`;
  }
  if (!input.billNumber.trim()) {
    return `${input.singularLabel[0].toUpperCase()}${input.singularLabel.slice(1)} number is required before posting.`;
  }
  if (
    usesTransactionType(input.documentType) &&
    input.transactionType === "CREDIT" &&
    !input.activeCustomer
  ) {
    return `Credit ${input.pluralLabel} require an existing customer.`;
  }
  if (!usesTransactionType(input.documentType) && !input.customerName.trim()) {
    return `Customer details are required before posting this ${input.singularLabel}.`;
  }

  const normalizedLines = normalizeLines(input.lines);
  if (normalizedLines.length === 0) {
    return `Add at least one ${input.singularLabel} line before posting.`;
  }

  for (const [index, line] of normalizedLines.entries()) {
    if (!line.variantId.trim()) {
      return `Line ${index + 1}: Select an item before posting.`;
    }

    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return `Line ${index + 1}: Quantity must be greater than 0.`;
    }

    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return `Line ${index + 1}: Rate must be 0 or greater.`;
    }
  }

  return null;
};

const normalizeStoredLine = (rawLine: unknown): BillLine => {
  const line =
    rawLine && typeof rawLine === "object"
      ? (rawLine as Record<string, unknown>)
      : {};

  return {
    id:
      typeof line.id === "string" && line.id.trim()
        ? line.id
        : crypto.randomUUID(),
    sourceLineId:
      typeof line.sourceLineId === "string" && line.sourceLineId.trim()
        ? line.sourceLineId
        : null,
    variantId: typeof line.variantId === "string" ? line.variantId : "",
    description: typeof line.description === "string" ? line.description : "",
    quantity: typeof line.quantity === "string" ? line.quantity : "1",
    unitPrice: typeof line.unitPrice === "string" ? line.unitPrice : "",
    taxRate:
      typeof line.taxRate === "string"
        ? (normalizeGstSlab(line.taxRate) ?? "0%")
        : "0%",
    taxMode: line.taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
    unit: typeof line.unit === "string" && line.unit.trim() ? line.unit : "PCS",
    stockOnHand:
      typeof line.stockOnHand === "number" && Number.isFinite(line.stockOnHand)
        ? line.stockOnHand
        : null,
  };
};

const normalizeEstimateDuplicateMeta = (
  rawValue: unknown,
): EstimateDuplicateMeta | null => {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const value = rawValue as Record<string, unknown>;
  const sourceBillNumber =
    typeof value.sourceBillNumber === "string" ? value.sourceBillNumber.trim() : "";
  const lineSourceVariantIds =
    value.lineSourceVariantIds && typeof value.lineSourceVariantIds === "object"
      ? Object.entries(value.lineSourceVariantIds as Record<string, unknown>).reduce<
          Record<string, string>
        >((accumulator, [lineId, variantId]) => {
          if (
            lineId.trim().length > 0 &&
            typeof variantId === "string" &&
            variantId.trim().length > 0
          ) {
            accumulator[lineId] = variantId;
          }
          return accumulator;
        }, {})
      : {};

  if (!sourceBillNumber) {
    return null;
  }

  return {
    sourceBillNumber,
    lineSourceVariantIds,
  };
};

const formatPriceInput = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const buildDuplicateEstimateWarnings = (
  lines: BillLine[],
  itemOptionsByVariantId: Map<string, SalesItemOption>,
  duplicateMeta: EstimateDuplicateMeta | null,
): EstimateDuplicateWarnings => {
  if (!duplicateMeta) {
    return {
      missingItems: [],
      priceDiscrepancies: [],
    };
  }

  const missingItems: EstimateDuplicateWarnings["missingItems"] = [];
  const priceDiscrepancies: EstimateDuplicateWarnings["priceDiscrepancies"] = [];

  for (const line of lines) {
    const sourceVariantId = duplicateMeta.lineSourceVariantIds[line.id];
    const option = line.variantId ? itemOptionsByVariantId.get(line.variantId) : null;

    if (sourceVariantId && !option) {
      missingItems.push({
        lineId: line.id,
        description: line.description || "Unnamed item",
      });
      continue;
    }

    if (!option || option.priceAmount === null) {
      continue;
    }

    const draftPrice = toNumber(line.unitPrice);
    if (Math.abs(draftPrice - option.priceAmount) < 0.01) {
      continue;
    }

    priceDiscrepancies.push({
      lineId: line.id,
      description: line.description || "Unnamed item",
      draftPrice,
      currentPrice: option.priceAmount,
    });
  }

  return {
    missingItems,
    priceDiscrepancies,
  };
};

const loadStoredDrafts = (
  activeStore: string | null,
  config: SalesDocumentPageConfig,
) => {
  if (!activeStore || typeof window === "undefined") {
    return [] as SavedBillDraft[];
  }

  try {
    const storedValue = window.localStorage.getItem(
      `${config.storageKeyPrefix}:${activeStore}`,
    );
    const parsed = storedValue ? (JSON.parse(storedValue) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry, index) => {
      const draft =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const lines = Array.isArray(draft.lines)
        ? draft.lines.map(normalizeStoredLine)
        : [];
      return {
        id:
          typeof draft.id === "string" && draft.id.trim()
            ? draft.id
            : `draft-${index + 1}`,
        billNumber:
          typeof draft.billNumber === "string" && draft.billNumber.trim()
            ? draft.billNumber
            : formatInvoiceNumber(config.numberPrefix, index + 1),
        documentType: config.documentType,
        transactionType: draft.transactionType === "CREDIT" ? "CREDIT" : "CASH",
        customerId:
          typeof draft.customerId === "string" ? draft.customerId : null,
        customerName:
          typeof draft.customerName === "string" ? draft.customerName : "",
        customerPhone:
          typeof draft.customerPhone === "string" ? draft.customerPhone : "",
        customerAddress:
          typeof draft.customerAddress === "string"
            ? draft.customerAddress
            : "",
        customerGstNo:
          typeof draft.customerGstNo === "string" ? draft.customerGstNo : "",
        validUntil:
          typeof draft.validUntil === "string" ? draft.validUntil : "",
        dispatchDate:
          typeof draft.dispatchDate === "string" ? draft.dispatchDate : "",
        dispatchCarrier:
          typeof draft.dispatchCarrier === "string"
            ? draft.dispatchCarrier
            : "",
        dispatchReference:
          typeof draft.dispatchReference === "string"
            ? draft.dispatchReference
            : "",
        notes: typeof draft.notes === "string" ? draft.notes : "",
        savedAt:
          typeof draft.savedAt === "string" && draft.savedAt.trim()
            ? draft.savedAt
            : new Date().toISOString(),
        lines: lines.length > 0 ? lines : [createLine()],
        duplicateMeta: normalizeEstimateDuplicateMeta(draft.duplicateMeta),
      } satisfies SavedBillDraft;
    });
  } catch {
    return [];
  }
};

type UseSalesDocumentWorkspaceProps = {
  activeStore: string | null;
  activeLocationId: string | null;
  config: SalesDocumentPageConfig;
  conversionConfig: Partial<Record<SalesDocumentType, SalesDocumentConversionConfig[]>>;
};

export function useSalesDocumentWorkspace({
  activeStore,
  activeLocationId,
  config,
  conversionConfig,
}: UseSalesDocumentWorkspaceProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const { showToast } = useToast();
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const activeBusinessName = activeBusiness?.name ?? "No business selected";
  const [initialDrafts] = useState<SavedBillDraft[]>(() =>
    loadStoredDrafts(activeStore, config),
  );
  const [drafts, setDrafts] = useState<SavedBillDraft[]>(initialDrafts);
  const isPosMode = config.workspaceVariant === "pos";
  const [viewMode, setViewMode] = useState<"list" | "editor">(
    config.openEditorByDefault ? "editor" : "list",
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftSource, setActiveDraftSource] =
    useState<DraftSource | null>(null);
  const [billNumber, setBillNumber] = useState(() =>
    getNextBillNumber(config.numberPrefix, [], initialDrafts),
  );
  const [transactionType, setTransactionType] = useState<"CASH" | "CREDIT">(
    config.defaultTransactionType ?? "CREDIT",
  );
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstNo, setCustomerGstNo] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [documentLocationId, setDocumentLocationId] = useState<string | null>(
    activeLocationId ?? null,
  );
  const [validUntil, setValidUntil] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [dispatchCarrier, setDispatchCarrier] = useState("");
  const [dispatchReference, setDispatchReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([createLine()]);
  const [saveMessage, setSaveMessage] = useState<string | null>(
    activeStore ? null : `Select a business to start a ${config.singularLabel}.`,
  );
  const [lineHighlightRequest, setLineHighlightRequest] = useState<{
    lineId: string;
    nonce: number;
  } | null>(null);
  const [quickAddItemQuery, setQuickAddItemQuery] = useState("");
  const pendingAppendedLineIdRef = useRef<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [itemOptions, setItemOptions] = useState<SalesItemOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [draftMutationLoading, setDraftMutationLoading] = useState(false);
  const [serverActionDocumentId, setServerActionDocumentId] = useState<string | null>(null);
  const [pendingCancelDocument, setPendingCancelDocument] =
    useState<SalesDocumentDraft | null>(null);
  const [historyDocument, setHistoryDocument] = useState<SalesDocumentDraft | null>(null);
  const [historyEntries, setHistoryEntries] = useState<SalesDocumentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] =
    useState<SalesDocumentCancelReason>("INTERNAL_DROP");
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [openRowMenuAnchorRect, setOpenRowMenuAnchorRect] = useState<DOMRect | null>(null);
  const [numberConflict, setNumberConflict] =
    useState<NumberConflictState | null>(null);
  const [duplicateMeta, setDuplicateMeta] = useState<EstimateDuplicateMeta | null>(null);
  const [serverInvoices, setServerInvoices] = useState<SalesDocumentDraft[]>([]);
  const [serverInvoicesLoading, setServerInvoicesLoading] = useState(false);
  const [serverInvoicesError, setServerInvoicesError] = useState<string | null>(null);
  const [linkedSourceBalances, setLinkedSourceBalances] = useState<
    Record<string, LinkedSourceBalance>
  >({});
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const storageKey = activeStore
    ? `${config.storageKeyPrefix}:${activeStore}`
    : null;

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLookupLoading(true);
      setLookupError(null);
    });

    void Promise.all([
      getLocalCustomers(activeStore),
      getLocalStockVariantOptions(activeStore),
      getLocalItemPricingRowsForDisplay(activeStore, undefined, false, "SALES"),
      getLocalStockLevels(activeStore),
    ])
      .then(([nextCustomers, stockOptions, pricingRows, stockLevels]) => {
        if (cancelled) return;

        const pricingByVariantId = new Map(
          pricingRows.map((row) => [row.variantId, row] as const),
        );
        const stockLevelByVariantId = new Map(
          stockLevels.map((row) => [row.variantId, row] as const),
        );

        setCustomers(
          sortCustomers(nextCustomers.filter((customer) => customer.isActive)),
        );
        setItemOptions(
          buildSalesItemOptions(
            stockOptions,
            pricingByVariantId,
            stockLevelByVariantId,
          ),
        );
      })
      .catch((error: unknown) => {
        console.error(error);
        if (cancelled) return;
        setCustomers([]);
        setItemOptions([]);
        setLookupError("Unable to load customers or item lookups right now.");
      })
      .finally(() => {
        if (cancelled) return;
        setLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  useEffect(() => {
    if (!activeStore) {
      setServerInvoices([]);
      setServerInvoicesLoading(false);
      setServerInvoicesError(null);
      return;
    }

    if (!isOnline) {
      setServerInvoicesLoading(false);
      setServerInvoicesError(null);
      return;
    }

    let cancelled = false;
    setServerInvoicesLoading(true);
    setServerInvoicesError(null);

    void listSalesDocuments(activeStore, config.documentType)
      .then((invoices) => {
        if (cancelled) return;
        setServerInvoices(invoices);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (cancelled) return;
        setServerInvoices([]);
        setServerInvoicesError(
          `Unable to load recent ${config.pluralLabel} right now.`,
        );
      })
      .finally(() => {
        if (cancelled) return;
        setServerInvoicesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, config.documentType, config.pluralLabel, isOnline]);

  const itemOptionsByVariantId = useMemo(
    () => new Map(itemOptions.map((option) => [option.variantId, option] as const)),
    [itemOptions],
  );

  const activeCustomer = useMemo(() => {
    if (customerId) {
      return customers.find((customer) => customer.entityId === customerId) ?? null;
    }
    const normalizedName = customerName.trim().toLowerCase();
    const normalizedPhone = normalizePhoneCandidate(customerName);
    if (!normalizedName && !normalizedPhone) return null;
    return (
      customers.find((customer) => {
        const nameMatches =
          normalizedName.length > 0 &&
          customer.name.trim().toLowerCase() === normalizedName;
        const phoneMatches =
          normalizedPhone.length > 0 &&
          normalizePhoneCandidate(customer.phone) === normalizedPhone;
        return nameMatches || phoneMatches;
      }) ?? null
    );
  }, [customerId, customerName, customers]);

  const duplicateWarnings = useMemo(
    () => buildDuplicateEstimateWarnings(lines, itemOptionsByVariantId, duplicateMeta),
    [duplicateMeta, itemOptionsByVariantId, lines],
  );
  const duplicateWarningAlerts = useMemo<DraftReviewAlert[]>(() => {
    const missingAlerts = duplicateWarnings.missingItems.map((warning) => ({
      id: `missing:${warning.lineId}`,
      title: `${warning.description} is no longer available`,
      description: "Select a replacement item before saving or posting this duplicate.",
    }));
    const priceAlerts = duplicateWarnings.priceDiscrepancies.map((warning) => ({
      id: `price:${warning.lineId}`,
      title: `${warning.description} price differs from the current sales price`,
      description: `Draft price ${formatCurrency(warning.draftPrice)}. Current price ${formatCurrency(warning.currentPrice)}.`,
    }));

    return [...missingAlerts, ...priceAlerts];
  }, [duplicateWarnings]);
  const nextBillNumber = useMemo(
    () => getNextBillNumber(config.numberPrefix, serverInvoices, drafts),
    [config.numberPrefix, drafts, serverInvoices],
  );
  const invoiceRows = useMemo<InvoiceListRow[]>(() => {
    const localRows: InvoiceListRow[] = drafts.map((draft) => ({
      source: "local",
      id: draft.id,
      billNumber: draft.billNumber,
      customerName: draft.customerName || "Walk-in customer",
      status: "DRAFT",
      lines: draft.lines,
      total: getDraftGrandTotal(draft.lines),
      timestamp: draft.savedAt,
      postedAt: null,
      draft,
    }));
    const serverRows: InvoiceListRow[] = serverInvoices.map((invoice) => ({
      source: "server",
      id: invoice.id,
      billNumber: invoice.billNumber,
      customerName: invoice.customerName || "Walk-in customer",
      status: invoice.status ?? "OPEN",
      lines: invoice.lines,
      total: getDraftGrandTotal(invoice.lines),
      timestamp: invoice.postedAt ?? invoice.savedAt,
      postedAt: invoice.postedAt ?? null,
      invoice,
    }));

    return [...localRows, ...serverRows].sort(
      (left, right) =>
        new Date(right.timestamp).valueOf() -
        new Date(left.timestamp).valueOf(),
    );
  }, [drafts, serverInvoices]);
  const getServerDocumentActions = (
    document: SalesDocumentDraft,
  ): SalesDocumentAction[] => {
    if (document.status === "OPEN" || document.status === "PARTIAL") {
      return ["CANCEL"];
    }
    if (document.status === "CANCELLED") {
      return ["REOPEN"];
    }
    return [];
  };

  const getServerDocumentConversions = (
    document: SalesDocumentDraft,
  ): SalesDocumentConversionConfig[] => {
    if (!["OPEN", "PARTIAL"].includes(document.status ?? "OPEN")) {
      return [];
    }

    return conversionConfig[document.documentType] ?? [];
  };

  const duplicateEstimateDraft = (source: SavedBillDraft | SalesDocumentDraft) => {
    const sourceLines = source.lines.map(normalizeStoredLine);
    const lineSourceVariantIds: Record<string, string> = {};
    const duplicatedLines = sourceLines.map((line) => {
      const nextLineId = crypto.randomUUID();
      const sourceVariantId = line.variantId.trim();
      if (sourceVariantId) {
        lineSourceVariantIds[nextLineId] = sourceVariantId;
      }

      const currentOption = sourceVariantId
        ? itemOptionsByVariantId.get(sourceVariantId)
        : null;

      return {
        ...line,
        id: nextLineId,
        variantId: currentOption ? sourceVariantId : "",
        stockOnHand: currentOption?.quantityOnHand ?? null,
      };
    });

    const duplicatedDraft: SavedBillDraft = {
      id: crypto.randomUUID(),
      documentType: "SALES_ESTIMATE",
      parentId: null,
      billNumber: nextBillNumber,
      transactionType: source.transactionType === "CREDIT" ? "CREDIT" : "CASH",
      customerId: source.customerId,
      customerName: source.customerName,
      customerPhone: source.customerPhone,
      customerAddress: source.customerAddress,
      customerGstNo: source.customerGstNo,
      validUntil: source.validUntil,
      dispatchDate: "",
      dispatchCarrier: "",
      dispatchReference: "",
      notes: source.notes,
      savedAt: new Date().toISOString(),
      status: "DRAFT",
      postedAt: null,
      lines: duplicatedLines,
      duplicateMeta: {
        sourceBillNumber: source.billNumber,
        lineSourceVariantIds,
      },
    };

    persistDrafts([duplicatedDraft, ...drafts]);
    loadDraft(duplicatedDraft);
    setSaveMessage(
      `Estimate ${source.billNumber} duplicated into draft ${duplicatedDraft.billNumber}. Original prices were preserved.`,
    );
  };

  const refreshDuplicatePricesToCurrent = () => {
    setLines((currentLines) =>
      currentLines.map((line) => {
        const matchingWarning = duplicateWarnings.priceDiscrepancies.find(
          (warning) => warning.lineId === line.id,
        );
        if (!matchingWarning) {
          return line;
        }

        return {
          ...line,
          unitPrice: formatPriceInput(matchingWarning.currentPrice),
        };
      }),
    );
  };

  const toggleRowMenu = (
    rowId: string,
    triggerElement: HTMLButtonElement,
  ) => {
    setOpenRowMenuId((current) => {
      if (current === rowId) {
        setOpenRowMenuAnchorRect(null);
        return null;
      }

      setOpenRowMenuAnchorRect(triggerElement.getBoundingClientRect());
      return rowId;
    });
  };

  const startDocumentConversion = async (
    document: SalesDocumentDraft,
    conversion: SalesDocumentConversionConfig,
  ) => {
    if (!activeStore) {
      return;
    }

    try {
      const balance = await getSalesConversionBalance(document.id, activeStore);
      const sourceLineById = new Map(document.lines.map((line) => [line.id, line]));
      const convertedLines = balance.lines
        .filter((line) => Number(line.remainingQuantity) > 0)
        .map((line) => {
          const sourceLine = sourceLineById.get(line.sourceLineId);
          return {
            id: crypto.randomUUID(),
            sourceLineId: line.sourceLineId,
            variantId: sourceLine?.variantId ?? line.variantId ?? "",
            description: sourceLine?.description ?? line.description,
            quantity: line.remainingQuantity,
            unitPrice: sourceLine?.unitPrice ?? line.unitPrice,
            taxRate: sourceLine?.taxRate ?? line.taxRate,
            taxMode: sourceLine?.taxMode ?? line.taxMode,
            unit: sourceLine?.unit ?? line.unit,
            stockOnHand: sourceLine?.stockOnHand ?? null,
          };
        });

      if (convertedLines.length === 0) {
        setSaveMessage(
          `No quantity is currently available to convert from ${document.billNumber}.`,
        );
        return;
      }

      navigate(conversion.targetRoutePath, {
        state: {
          returnTo: config.routePath,
          draftSource: "local",
          invoiceDraft: {
            documentType: conversion.targetDocumentType,
            parentId: document.id,
            locationId: document.locationId ?? activeLocationId ?? null,
            billNumber: "",
            transactionType: document.transactionType,
            customerId: document.customerId,
            customerName: document.customerName,
            customerPhone: document.customerPhone,
            customerAddress: document.customerAddress,
            customerGstNo: document.customerGstNo,
            validUntil: document.validUntil,
            dispatchDate: document.dispatchDate,
            dispatchCarrier: document.dispatchCarrier,
            dispatchReference: document.dispatchReference,
            notes: document.notes,
            lines: convertedLines,
          },
        } satisfies BillingRouteState,
      });
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Unable to start document conversion.",
      );
    }
  };

  const getRowMenuActions = (row: InvoiceListRow): RowMenuAction[] => {
    if (row.status === "DRAFT") {
      const actions: RowMenuAction[] = [
        {
          key: "open",
          label: "Open",
          icon: Eye,
          onSelect: () => {
            if (row.source === "local") {
              loadDraft(row.draft);
              return;
            }
            loadServerDraft(row.invoice);
          },
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: draftMutationLoading,
          onSelect: () => {
            void removeDraft(row.id, row.source, row.billNumber);
          },
        },
      ];

      if (config.documentType === "SALES_ESTIMATE") {
        actions.splice(1, 0, {
          key: "duplicate",
          label: "Duplicate",
          icon: Copy,
          onSelect: () => {
            duplicateEstimateDraft(row.source === "local" ? row.draft : row.invoice);
          },
        });
      }

      return actions;
    }

    if (row.source !== "server") {
      return [];
    }

    const actions: RowMenuAction[] = [];
    actions.push({
      key: "open",
      label: "Open",
      icon: Eye,
      onSelect: () => {
        loadServerDraft(row.invoice);
      },
    });
    actions.push({
      key: "history",
      label: "View History",
      icon: History,
      onSelect: () => {
        void openDocumentHistory(row.invoice);
      },
    });
    if (config.documentType === "SALES_ESTIMATE") {
      actions.push({
        key: "duplicate",
        label: "Duplicate",
        icon: Copy,
        onSelect: () => {
          duplicateEstimateDraft(row.invoice);
        },
      });
    }
    const conversions = getServerDocumentConversions(row.invoice);
    for (const conversion of conversions) {
      actions.push({
        key: `convert-${conversion.targetDocumentType}`,
        label: conversion.actionLabel,
        icon: FileOutput,
        onSelect: () => {
          startDocumentConversion(row.invoice, conversion);
        },
      });
    }

    for (const action of getServerDocumentActions(row.invoice)) {
      actions.push({
        key: action,
        label: action === "CANCEL" ? "Cancel" : "Reopen",
        icon: action === "REOPEN" ? RotateCcw : XCircle,
        tone: "default",
        disabled: serverActionDocumentId === row.id,
        onSelect: () => {
          if (action === "CANCEL") {
            setCancelReasonDraft(
              row.invoice.documentType === "SALES_ESTIMATE"
                ? "CUSTOMER_DECLINED"
                : "INTERNAL_DROP",
            );
            setPendingCancelDocument(row.invoice);
            return;
          }
          void applyServerDocumentAction(row.invoice, action);
        },
      });
    }

    return actions;
  };

  const openRowMenuItems: FloatingActionMenuItem[] = (() => {
    if (!openRowMenuId) {
      return [];
    }

    const targetRow = invoiceRows.find((row) => row.id === openRowMenuId);
    return targetRow ? getRowMenuActions(targetRow) : [];
  })();

  const routeState =
    location.state && typeof location.state === "object"
      ? (location.state as BillingRouteState)
      : null;

  useEffect(() => {
    if (!routeState) {
      return;
    }

    const draft = routeState.invoiceDraft;
    if (draft) {
      setViewMode("editor");
      setActiveDraftId(typeof draft.id === "string" ? draft.id : null);
      setActiveDraftSource(routeState.draftSource ?? "local");
      setParentId(typeof draft.parentId === "string" ? draft.parentId : null);
      setDocumentLocationId(
        typeof draft.locationId === "string" ? draft.locationId : activeLocationId ?? null,
      );
      setBillNumber(
        typeof draft.billNumber === "string" && draft.billNumber.trim()
          ? draft.billNumber
          : nextBillNumber,
      );
      setTransactionType(
        usesTransactionType(config.documentType) &&
          draft.transactionType === "CREDIT"
          ? "CREDIT"
          : "CASH",
      );
      setCustomerId(typeof draft.customerId === "string" ? draft.customerId : null);
      setCustomerName(typeof draft.customerName === "string" ? draft.customerName : "");
      setCustomerPhone(
        typeof draft.customerPhone === "string" ? draft.customerPhone : "",
      );
      setCustomerAddress(
        typeof draft.customerAddress === "string" ? draft.customerAddress : "",
      );
      setCustomerGstNo(
        typeof draft.customerGstNo === "string" ? draft.customerGstNo : "",
      );
      setValidUntil(typeof draft.validUntil === "string" ? draft.validUntil : "");
      setDispatchDate(
        typeof draft.dispatchDate === "string" ? draft.dispatchDate : "",
      );
      setDispatchCarrier(
        typeof draft.dispatchCarrier === "string" ? draft.dispatchCarrier : "",
      );
      setDispatchReference(
        typeof draft.dispatchReference === "string" ? draft.dispatchReference : "",
      );
      setNotes(typeof draft.notes === "string" ? draft.notes : "");
      setDuplicateMeta(normalizeEstimateDuplicateMeta(draft.duplicateMeta));
      setLines(
        Array.isArray(draft.lines) && draft.lines.length > 0
          ? draft.lines.map(normalizeStoredLine)
          : [createLine()],
      );
      if (!routeState.createdCustomer && !routeState.customerMessage) {
        setSaveMessage(
          `Returned to ${config.routeAppDraftLabel}. The draft was restored.`,
        );
      }
    }

    const createdCustomer = routeState.createdCustomer;
    if (createdCustomer) {
      const hydratedCustomer: CustomerRow = {
        entityId:
          typeof createdCustomer.entityId === "string" &&
          createdCustomer.entityId.trim()
            ? createdCustomer.entityId
            : crypto.randomUUID(),
        name: typeof createdCustomer.name === "string" ? createdCustomer.name : "",
        phone: typeof createdCustomer.phone === "string" ? createdCustomer.phone : "",
        email: typeof createdCustomer.email === "string" ? createdCustomer.email : "",
        address:
          typeof createdCustomer.address === "string" ? createdCustomer.address : "",
        gstNo: typeof createdCustomer.gstNo === "string" ? createdCustomer.gstNo : "",
        isActive: true,
        deletedAt: null,
        serverVersion:
          typeof createdCustomer.serverVersion === "number"
            ? createdCustomer.serverVersion
            : 0,
        pending: Boolean(createdCustomer.pending),
      };
      setCustomers((current) =>
        sortCustomers([
          ...current.filter(
            (customer) => customer.entityId !== hydratedCustomer.entityId,
          ),
          hydratedCustomer,
        ]),
      );
      applyCustomerSnapshot(
        hydratedCustomer,
        setCustomerId,
        setCustomerName,
        setCustomerPhone,
        setCustomerAddress,
        setCustomerGstNo,
      );
    }

    if (routeState.customerMessage) {
      setSaveMessage(routeState.customerMessage);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [
    activeLocationId,
    config.documentType,
    config.routeAppDraftLabel,
    location.pathname,
    navigate,
    nextBillNumber,
    routeState,
  ]);

  useEffect(() => {
    if (!openRowMenuId) {
      return;
    }

    const handlePointerDown = () => {
      setOpenRowMenuId(null);
      setOpenRowMenuAnchorRect(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openRowMenuId]);

  useEffect(() => {
    if (!activeStore || !parentId) {
      setLinkedSourceBalances({});
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const balance = await getSalesConversionBalance(parentId, activeStore);
        if (cancelled) {
          return;
        }

        setLinkedSourceBalances(
          Object.fromEntries(
            balance.lines.map((line) => [
              line.sourceLineId,
              {
                sourceLineId: line.sourceLineId,
                sourceDocumentNumber: balance.documentNumber,
                remainingQuantity: line.remainingQuantity,
              } satisfies LinkedSourceBalance,
            ]),
          ),
        );
      } catch {
        if (!cancelled) {
          setLinkedSourceBalances({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDraftId, activeDraftSource, activeStore, parentId, serverInvoices]);

  useEffect(() => {
    if (!lineHighlightRequest || typeof document === "undefined") {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-bill-line-id="${lineHighlightRequest.lineId}"]`,
      );
      if (!target) {
        return;
      }

      if (!isElementVisible(target)) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      target.classList.remove("row-flash");
      void target.getBoundingClientRect();
      target.classList.add("row-flash");
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [lineHighlightRequest]);

  useEffect(() => {
    if (!pendingAppendedLineIdRef.current || typeof document === "undefined") {
      return;
    }

    const lineId = pendingAppendedLineIdRef.current;
    const animationFrameId = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `#${getSalesLineDescriptionInputId(lineId)}`,
      );
      if (target) {
        target.focus();
      }
      setLineHighlightRequest((current) => ({
        lineId,
        nonce: (current?.nonce ?? 0) + 1,
      }));
      pendingAppendedLineIdRef.current = null;
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [lines]);

  const phoneCandidate = useMemo(
    () => normalizePhoneCandidate(customerName),
    [customerName],
  );
  const canQuickCreateFromPhone =
    usesTransactionType(config.documentType) &&
    transactionType === "CASH" &&
    phoneCandidate.length > 0 &&
    !activeCustomer &&
    Boolean(activeStore) &&
    Boolean(identityId);

  const totals = lines.reduce(
    (summary, line) => {
      const lineTotals = getLineTotals(line);
      summary.subTotal += lineTotals.subTotal;
      summary.taxTotal += lineTotals.taxTotal;
      summary.grandTotal += lineTotals.total;
      return summary;
    },
    { subTotal: 0, taxTotal: 0, grandTotal: 0 },
  );
  const postValidationMessage = useMemo(
    () =>
      getPostValidationMessage({
        documentType: config.documentType,
        activeStore,
        isOnline,
        billNumber,
        transactionType,
        activeCustomer,
        customerName,
        lines,
        singularLabel: config.singularLabel,
        pluralLabel: config.pluralLabel,
      }),
    [
      activeStore,
      isOnline,
      billNumber,
      transactionType,
      activeCustomer,
      customerName,
      lines,
      config.documentType,
      config.pluralLabel,
      config.singularLabel,
    ],
  );
  const getLinkedLineBalance = (line: BillLine) =>
    line.sourceLineId ? linkedSourceBalances[line.sourceLineId] ?? null : null;
  const getLinkedLineCap = (line: BillLine) => {
    const linkedBalance = getLinkedLineBalance(line);
    return linkedBalance ? Math.max(0, toNumber(linkedBalance.remainingQuantity)) : null;
  };
  const getLineOriginTitle = (line: BillLine) => {
    const linkedBalance = getLinkedLineBalance(line);
    if (!linkedBalance) {
      return null;
    }

    if (isViewingPostedDocument) {
      return `Linked to ${linkedBalance.sourceDocumentNumber}`;
    }

    const linkedCap = getLinkedLineCap(line);
    return `Linked to ${linkedBalance.sourceDocumentNumber}${linkedCap !== null ? ` • Cap ${formatQuantity(linkedCap)}` : ""}`;
  };
  const getSameItemMixedOriginHint = (line: BillLine) => {
    if (isViewingPostedDocument || line.sourceLineId || !line.variantId) {
      return null;
    }

    const firstAdHocRowForVariant = lines.find(
      (candidate) => candidate.variantId === line.variantId && !candidate.sourceLineId,
    );
    if (firstAdHocRowForVariant?.id !== line.id) {
      return null;
    }

    const hasLinkedRowBelowCap = lines.some((candidate) => {
      if (candidate.variantId !== line.variantId || !candidate.sourceLineId) {
        return false;
      }

      const linkedCap = getLinkedLineCap(candidate);
      if (linkedCap === null) {
        return false;
      }

      return toNumber(candidate.quantity) < linkedCap;
    });

    return hasLinkedRowBelowCap ? SAME_ITEM_MIXED_ORIGIN_HINT : null;
  };
  const shouldShowOriginBadges = Boolean(parentId);
  const getOriginBadgeClassName = (line: BillLine) =>
    line.sourceLineId
      ? "bg-sky-100 text-sky-800"
      : "bg-slate-100 text-slate-700";
  const activeServerDocument = useMemo(
    () =>
      activeDraftSource === "server" && activeDraftId
        ? serverInvoices.find((document) => document.id === activeDraftId) ?? null
        : null,
    [activeDraftId, activeDraftSource, serverInvoices],
  );
  const isViewingPostedDocument =
    activeDraftSource === "server" &&
    activeServerDocument !== null &&
    activeServerDocument.status !== "DRAFT";

  const persistDrafts = (nextDrafts: SavedBillDraft[]) => {
    setDrafts(nextDrafts);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
    }
  };

  const resetEditor = (options?: { focusFirstLine?: boolean }) => {
    const nextLine = createLine();
    setActiveDraftId(null);
    setActiveDraftSource(null);
    setBillNumber(nextBillNumber);
    setTransactionType(config.defaultTransactionType ?? "CASH");
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerGstNo("");
    setParentId(null);
    setDocumentLocationId(activeLocationId ?? null);
    setValidUntil("");
    setDispatchDate("");
    setDispatchCarrier("");
    setDispatchReference("");
    setNotes("");
    setLines([nextLine]);
    setQuickAddItemQuery("");
    setNumberConflict(null);
    setDuplicateMeta(null);
    setLinkedSourceBalances({});
    if (options?.focusFirstLine) {
      pendingAppendedLineIdRef.current = nextLine.id;
    }
  };

  const openNewDraft = () => {
    resetEditor({ focusFirstLine: isPosMode });
    setSaveMessage(
      activeStore ? null : `Select a business to start a ${config.singularLabel}.`,
    );
    setViewMode("editor");
  };

  const buildNormalizedDraft = () => {
    if (
      usesTransactionType(config.documentType) &&
      transactionType === "CREDIT" &&
      !activeCustomer
    ) {
      throw new Error(
        `Credit ${config.pluralLabel} require an existing customer. Create or select one first.`,
      );
    }
    if (!usesTransactionType(config.documentType) && !customerName.trim()) {
      throw new Error(
        `Customer details are required before saving this ${config.singularLabel}.`,
      );
    }

    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      throw new Error(
        `Add at least one line with an item or amount before saving this ${config.singularLabel}.`,
      );
    }

    return {
      id: activeDraftId ?? crypto.randomUUID(),
      documentType: config.documentType,
      parentId,
      locationId: documentLocationId,
      billNumber: billNumber.trim() || nextBillNumber,
      transactionType,
      customerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerGstNo: customerGstNo.trim(),
      validUntil: validUntil.trim(),
      dispatchDate: dispatchDate.trim(),
      dispatchCarrier: dispatchCarrier.trim(),
      dispatchReference: dispatchReference.trim(),
      notes: notes.trim(),
      savedAt: new Date().toISOString(),
      lines: normalizedLines,
      duplicateMeta,
    };
  };

  const saveDraft = async () => {
    try {
      if (!activeStore) {
        throw new Error(
          `Select a business before saving this ${config.singularLabel} draft.`,
        );
      }

      const nextDraft = buildNormalizedDraft();
      setNumberConflict(null);

      if (isOnline) {
        setDraftMutationLoading(true);
        const savedServerDraft =
          activeDraftSource === "server" && activeDraftId
            ? await updateSalesDocumentDraft(activeDraftId, {
                tenantId: activeStore,
                documentType: config.documentType,
                parentId: nextDraft.parentId,
                locationId: nextDraft.locationId,
                billNumber: nextDraft.billNumber,
                transactionType: nextDraft.transactionType,
                customerId: nextDraft.customerId,
                customerName: nextDraft.customerName,
                customerPhone: nextDraft.customerPhone,
                customerAddress: nextDraft.customerAddress,
                customerGstNo: nextDraft.customerGstNo,
                validUntil: nextDraft.validUntil,
                dispatchDate: nextDraft.dispatchDate,
                dispatchCarrier: nextDraft.dispatchCarrier,
                dispatchReference: nextDraft.dispatchReference,
                notes: nextDraft.notes,
                lines: nextDraft.lines,
              })
            : await createSalesDocumentDraft({
                tenantId: activeStore,
                documentType: config.documentType,
                parentId: nextDraft.parentId,
                locationId: nextDraft.locationId,
                billNumber: nextDraft.billNumber,
                transactionType: nextDraft.transactionType,
                customerId: nextDraft.customerId,
                customerName: nextDraft.customerName,
                customerPhone: nextDraft.customerPhone,
                customerAddress: nextDraft.customerAddress,
                customerGstNo: nextDraft.customerGstNo,
                validUntil: nextDraft.validUntil,
                dispatchDate: nextDraft.dispatchDate,
                dispatchCarrier: nextDraft.dispatchCarrier,
                dispatchReference: nextDraft.dispatchReference,
                notes: nextDraft.notes,
                lines: nextDraft.lines,
              });

        if (activeDraftSource === "local" && activeDraftId) {
          persistDrafts(drafts.filter((draft) => draft.id !== activeDraftId));
        }

        setServerInvoices((current) => {
          const withoutSaved = current.filter(
            (document) => document.id !== savedServerDraft.id,
          );
          return [savedServerDraft, ...withoutSaved];
        });
        setActiveDraftId(savedServerDraft.id);
        setActiveDraftSource("server");
        setBillNumber(savedServerDraft.billNumber);
        setParentId(savedServerDraft.parentId ?? null);
        setDocumentLocationId(savedServerDraft.locationId ?? activeLocationId ?? null);
        setValidUntil(savedServerDraft.validUntil);
        setDispatchDate(savedServerDraft.dispatchDate);
        setDispatchCarrier(savedServerDraft.dispatchCarrier);
        setDispatchReference(savedServerDraft.dispatchReference);
        setLines(savedServerDraft.lines.map(normalizeStoredLine));
        setSaveMessage(`${config.createTitle} draft saved to the server.`);
      } else {
        if (!storageKey) {
          throw new Error(
            `Select a business before saving this ${config.singularLabel} draft.`,
          );
        }

        const nextDrafts =
          activeDraftSource === "local" && activeDraftId
            ? drafts.map((draft) => (draft.id === activeDraftId ? nextDraft : draft))
            : [nextDraft, ...drafts];

        persistDrafts(nextDrafts);
        setActiveDraftId(nextDraft.id);
        setActiveDraftSource("local");
        setBillNumber(nextDraft.billNumber);
        setValidUntil(nextDraft.validUntil);
        setDispatchDate(nextDraft.dispatchDate);
        setDispatchCarrier(nextDraft.dispatchCarrier);
        setDispatchReference(nextDraft.dispatchReference);
        setLines(nextDraft.lines);
        setSaveMessage(
          `${config.createTitle} draft saved locally on this device.`,
        );
      }
    } catch (error) {
      console.error(error);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : `Unable to save ${config.singularLabel} draft.`,
      );
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const loadDraft = (draft: SavedBillDraft) => {
    setActiveDraftId(draft.id);
    setActiveDraftSource("local");
    setBillNumber(draft.billNumber);
    setTransactionType(
      usesTransactionType(config.documentType) &&
        draft.transactionType === "CREDIT"
        ? "CREDIT"
        : "CASH",
    );
    setParentId(draft.parentId ?? null);
    setDocumentLocationId(draft.locationId ?? activeLocationId ?? null);
    setCustomerId(draft.customerId);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerAddress(draft.customerAddress);
    setCustomerGstNo(draft.customerGstNo);
    setValidUntil(draft.validUntil);
    setDispatchDate(draft.dispatchDate);
    setDispatchCarrier(draft.dispatchCarrier);
    setDispatchReference(draft.dispatchReference);
    setNotes(draft.notes);
    setLines(draft.lines.map((line) => ({ ...line })));
    setDuplicateMeta(draft.duplicateMeta ?? null);
    setNumberConflict(null);
    setSaveMessage(null);
    setViewMode("editor");
  };

  const loadServerDraft = (draft: SalesDocumentDraft) => {
    setActiveDraftId(draft.id);
    setActiveDraftSource("server");
    setBillNumber(draft.billNumber);
    setTransactionType(
      usesTransactionType(config.documentType) &&
        draft.transactionType === "CREDIT"
        ? "CREDIT"
        : "CASH",
    );
    setParentId(draft.parentId ?? null);
    setDocumentLocationId(draft.locationId ?? activeLocationId ?? null);
    setCustomerId(draft.customerId);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerAddress(draft.customerAddress);
    setCustomerGstNo(draft.customerGstNo);
    setValidUntil(draft.validUntil);
    setDispatchDate(draft.dispatchDate);
    setDispatchCarrier(draft.dispatchCarrier);
    setDispatchReference(draft.dispatchReference);
    setNotes(draft.notes);
    setLines(draft.lines.map(normalizeStoredLine));
    setDuplicateMeta(null);
    setNumberConflict(null);
    setSaveMessage(null);
    setViewMode("editor");
  };

  const removeDraft = async (
    draftId: string,
    source: DraftSource,
    billNumberValue: string,
  ) => {
    if (draftMutationLoading) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${config.singularLabel} draft '${billNumberValue}'? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setDraftMutationLoading(true);
      if (source === "server") {
        if (!activeStore) {
          throw new Error(
            `Select a business before deleting this ${config.singularLabel} draft.`,
          );
        }
        await deleteSalesDocumentDraft(
          draftId,
          activeStore,
          config.documentType,
        );
        setServerInvoices((current) =>
          current.filter((document) => document.id !== draftId),
        );
      } else {
        const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
        persistDrafts(nextDrafts);
      }
      if (draftId === activeDraftId) {
        resetEditor();
      }
      setSaveMessage(
        `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} draft removed.`,
      );
    } catch (error) {
      console.error(error);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : `Unable to remove ${config.singularLabel} draft.`,
      );
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const updateLine = (lineId: string, field: keyof BillLine, value: string) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? (() => {
              const nextValue =
                field === "quantity" && line.sourceLineId
                  ? (() => {
                      const maxQuantity = getLinkedLineCap(line);
                      const parsedValue = Number(value);
                      if (maxQuantity !== null && Number.isFinite(parsedValue)) {
                        return formatQuantity(Math.min(Math.max(parsedValue, 0), maxQuantity));
                      }
                      return value;
                    })()
                  : value;

              return {
                ...line,
                [field]: nextValue,
                ...(field === "description" ? { variantId: "" } : {}),
              };
            })()
          : line,
      ),
    );
  };

  const applyCustomer = (customer: CustomerRow) =>
    applyCustomerSnapshot(
      customer,
      setCustomerId,
      setCustomerName,
      setCustomerPhone,
      setCustomerAddress,
      setCustomerGstNo,
    );

  const applyLineItem = (lineId: string, option: SalesItemOption) => {
    let highlightedLineId: string | null = null;

    setLines((currentLines) => {
      const currentLine = currentLines.find((line) => line.id === lineId);
      if (!currentLine) {
        return currentLines;
      }

      const existingLine = currentLines.find(
        (line) =>
          line.variantId === option.variantId &&
          line.id !== lineId &&
          !line.sourceLineId &&
          !currentLine.sourceLineId,
      );

      if (existingLine) {
        highlightedLineId = existingLine.id;
        const incrementBy = Math.max(toNumber(currentLine.quantity), 1);

        return currentLines
          .map((line) =>
            line.id === existingLine.id
              ? {
                  ...line,
                  quantity: formatQuantity(toNumber(line.quantity) + incrementBy),
                }
              : line,
          )
          .filter((line) => line.id !== lineId);
      }

      return currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              variantId: option.variantId,
              description: option.description,
              unitPrice:
                option.priceAmount !== null && Number.isFinite(option.priceAmount)
                  ? String(option.priceAmount)
                  : line.unitPrice,
              taxRate: option.gstLabel || "0%",
              taxMode: option.taxMode,
              unit: option.unit,
              stockOnHand: option.quantityOnHand,
            }
          : line,
      );
    });

    if (typeof highlightedLineId === "string") {
      setLineHighlightRequest({
        lineId: highlightedLineId,
        nonce: (lineHighlightRequest?.nonce ?? 0) + 1,
      });
    }
  };

  const quickAddLineItem = (option: SalesItemOption) => {
    setQuickAddItemQuery("");
    const reusableLine =
      lines.find((line) => !hasLineContent(line) && !line.sourceLineId) ?? null;
    const matchingLine =
      lines.find(
        (line) =>
          line.variantId === option.variantId && !line.sourceLineId,
      ) ?? null;

    if (reusableLine) {
      applyLineItem(reusableLine.id, option);
      return matchingLine?.id ?? reusableLine.id;
    }

    const nextLine = createLine();
    pendingAppendedLineIdRef.current = nextLine.id;
    setLines((currentLines) => [...currentLines, nextLine]);
    window.requestAnimationFrame(() => {
      applyLineItem(nextLine.id, option);
    });
    return matchingLine?.id ?? nextLine.id;
  };

  const removeLine = (lineId: string) => {
    const targetLine = lines.find((line) => line.id === lineId) ?? null;
    if (
      targetLine?.sourceLineId &&
      !window.confirm(
        "Remove this linked line? This will restore available quantity on the source document, but the document will stay linked to its parent.",
      )
    ) {
      return;
    }

    setLines((currentLines) => {
      if (currentLines.length === 1) {
        return [createLine()];
      }
      return currentLines.filter((line) => line.id !== lineId);
    });
  };

  const appendLine = () => {
    if (isViewingPostedDocument) {
      return null;
    }

    const nextLine = createLine();
    pendingAppendedLineIdRef.current = nextLine.id;
    setLines((currentLines) => [...currentLines, nextLine]);
    return nextLine.id;
  };

  const getEditableLineFields = (line: BillLine): SalesLineFieldKey[] => {
    if (isViewingPostedDocument) {
      return [];
    }

    const fields: SalesLineFieldKey[] = [];
    if (!line.sourceLineId) {
      fields.push("description");
    }
    fields.push("quantity", "unitPrice", "taxRate", "taxMode");
    return fields;
  };

  const focusSalesLineCell = (lineId: string, field: SalesLineFieldKey) => {
    if (typeof document === "undefined") {
      return;
    }

    if (field === "description") {
      document
        .querySelector<HTMLElement>(`#${getSalesLineDescriptionInputId(lineId)}`)
        ?.focus();
      return;
    }

    document
      .querySelector<HTMLElement>(`[data-sales-line-cell="${lineId}:${field}"]`)
      ?.focus();
  };

  const handleSalesLineNavigation = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    lineId: string,
    field: SalesLineFieldKey,
  ) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (
      event.currentTarget instanceof HTMLInputElement &&
      event.currentTarget.getAttribute("aria-activedescendant")
    ) {
      return;
    }

    event.preventDefault();

    const currentLine = lines.find((line) => line.id === lineId);
    if (!currentLine) {
      return;
    }

    const currentLineFields = getEditableLineFields(currentLine);
    const lineIndex = lines.findIndex((line) => line.id === lineId);
    const fieldIndex = currentLineFields.indexOf(field);
    if (lineIndex === -1 || fieldIndex === -1) {
      return;
    }

    const step = event.shiftKey ? -1 : 1;
    const nextFieldIndex = fieldIndex + step;
    if (nextFieldIndex >= 0 && nextFieldIndex < currentLineFields.length) {
      focusSalesLineCell(lineId, currentLineFields[nextFieldIndex]);
      return;
    }

    let nextLineIndex = lineIndex + step;
    while (nextLineIndex >= 0 && nextLineIndex < lines.length) {
      const nextFields = getEditableLineFields(lines[nextLineIndex]);
      if (nextFields.length > 0) {
        focusSalesLineCell(
          lines[nextLineIndex].id,
          step > 0 ? nextFields[0] : nextFields[nextFields.length - 1],
        );
        return;
      }
      nextLineIndex += step;
    }

    if (!event.shiftKey && lineIndex === lines.length - 1 && hasLineContent(currentLine)) {
      appendLine();
    }
  };

  const buildRouteInvoiceDraft = (): SavedBillDraft => ({
    id: activeDraftId ?? crypto.randomUUID(),
    documentType: config.documentType,
    parentId,
    locationId: documentLocationId,
    billNumber,
    transactionType,
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    customerGstNo,
    validUntil,
    dispatchDate,
    dispatchCarrier,
    dispatchReference,
    notes,
    savedAt: new Date().toISOString(),
    lines,
    duplicateMeta,
  });

  const submitPostedDraft = async (
    localDraft: SavedBillDraft,
    tenantId: string,
  ) => {
    const serverDraft =
      activeDraftSource === "server" && activeDraftId
        ? await updateSalesDocumentDraft(activeDraftId, {
            tenantId,
            documentType: config.documentType,
            parentId: localDraft.parentId,
            locationId: localDraft.locationId,
            billNumber: localDraft.billNumber,
            transactionType: localDraft.transactionType,
            customerId: localDraft.customerId,
            customerName: localDraft.customerName,
            customerPhone: localDraft.customerPhone,
            customerAddress: localDraft.customerAddress,
            customerGstNo: localDraft.customerGstNo,
            validUntil: localDraft.validUntil,
            dispatchDate: localDraft.dispatchDate,
            dispatchCarrier: localDraft.dispatchCarrier,
            dispatchReference: localDraft.dispatchReference,
            notes: localDraft.notes,
            lines: localDraft.lines,
          })
        : await createSalesDocumentDraft({
            tenantId,
            documentType: config.documentType,
            parentId: localDraft.parentId,
            locationId: localDraft.locationId,
            billNumber: localDraft.billNumber,
            transactionType: localDraft.transactionType,
            customerId: localDraft.customerId,
            customerName: localDraft.customerName,
            customerPhone: localDraft.customerPhone,
            customerAddress: localDraft.customerAddress,
            customerGstNo: localDraft.customerGstNo,
            validUntil: localDraft.validUntil,
            dispatchDate: localDraft.dispatchDate,
            dispatchCarrier: localDraft.dispatchCarrier,
            dispatchReference: localDraft.dispatchReference,
            notes: localDraft.notes,
            lines: localDraft.lines,
          });
    await postSalesDocumentDraft(serverDraft.id, tenantId, config.documentType);
    setServerInvoices((current) => [
      { ...serverDraft, status: "OPEN", postedAt: new Date().toISOString() },
      ...current.filter((invoice) => invoice.id !== serverDraft.id),
    ]);

    if (activeDraftSource === "local") {
      const nextDrafts = drafts.filter((draft) => draft.id !== localDraft.id);
      persistDrafts(nextDrafts);
    }
    resetEditor({ focusFirstLine: isPosMode });
    setViewMode(isPosMode ? "editor" : "list");
    setSaveMessage(
      isPosMode
        ? `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${serverDraft.billNumber} posted. Ready for the next sale.`
        : `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${serverDraft.billNumber} posted.`,
    );
  };

  const showPostErrorToast = (message: string) => {
    showToast({
      title: `Unable to post ${config.singularLabel}`,
      description: message,
      tone: "error",
      dedupeKey: `sales-post-error:${config.documentType}:${message}`,
    });
  };

  const postDraft = async (options?: PostDraftOptions): Promise<PostDraftResult> => {
    if (postValidationMessage) {
      setSaveMessage(postValidationMessage);
      showPostErrorToast(postValidationMessage);
      return { ok: false, errorMessage: postValidationMessage };
    }

    setDraftMutationLoading(true);
    setSaveMessage(null);
    setNumberConflict(null);
    try {
      const normalizedDraft = buildNormalizedDraft();
      const localDraft = {
        ...normalizedDraft,
        notes: options?.notesOverride ?? normalizedDraft.notes,
      };
      await submitPostedDraft(localDraft, activeStore!);
      return { ok: true };
    } catch (error) {
      console.error(error);
      if (
        error instanceof SalesDocumentApiError &&
        error.reasonCode === "DOCUMENT_NUMBER_CONFLICT" &&
        typeof error.details?.suggested === "string" &&
        error.details.suggested.trim()
      ) {
        setNumberConflict({
          requested: error.details.requested?.trim() || billNumber.trim(),
          suggested: error.details.suggested.trim(),
        });
        setSaveMessage(
          `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number ${error.details.requested?.trim() || billNumber.trim()} is already in use.`,
        );
        const message = `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number ${error.details.requested?.trim() || billNumber.trim()} is already in use.`;
        showPostErrorToast(message);
        return { ok: false, errorMessage: message };
      } else {
        const message =
          error instanceof Error
            ? error.message
            : `Unable to post ${config.singularLabel}.`;
        setSaveMessage(message);
        showPostErrorToast(message);
        return { ok: false, errorMessage: message };
      }
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const applySuggestedInvoiceNumber = async () => {
    if (!numberConflict || draftMutationLoading) {
      return;
    }

    if (!activeStore) {
      setSaveMessage(
        `Select a business before posting a ${config.singularLabel}.`,
      );
      return;
    }

    setDraftMutationLoading(true);
    setBillNumber(numberConflict.suggested);
    setNumberConflict(null);
    setSaveMessage(
      `Retrying with ${config.singularLabel} number ${numberConflict.suggested}.`,
    );
    try {
      const localDraft = {
        ...buildNormalizedDraft(),
        billNumber: numberConflict.suggested,
      };
      await submitPostedDraft(localDraft, activeStore);
    } catch (error) {
      console.error(error);
      if (
        error instanceof SalesDocumentApiError &&
        error.reasonCode === "DOCUMENT_NUMBER_CONFLICT" &&
        typeof error.details?.suggested === "string" &&
        error.details.suggested.trim()
      ) {
        setNumberConflict({
          requested: error.details.requested?.trim() || numberConflict.suggested,
          suggested: error.details.suggested.trim(),
        });
        setSaveMessage(
          `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number ${error.details.requested?.trim() || numberConflict.suggested} is already in use.`,
        );
        showPostErrorToast(
          `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number ${error.details.requested?.trim() || numberConflict.suggested} is already in use.`,
        );
      } else {
        const message =
          error instanceof Error
            ? error.message
            : `Unable to post ${config.singularLabel}.`;
        setSaveMessage(message);
        showPostErrorToast(message);
      }
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const applyServerDocumentAction = async (
    document: SalesDocumentDraft,
    action: SalesDocumentAction,
    cancelReason?: SalesDocumentCancelReason | null,
  ) => {
    if (!activeStore || serverActionDocumentId) {
      return;
    }

    setServerActionDocumentId(document.id);
    setSaveMessage(null);
    try {
      const updatedDocument = await transitionSalesDocument(
        document.id,
        activeStore,
        config.documentType,
        action,
        cancelReason,
      );
      setServerInvoices((current) =>
        current.map((entry) =>
          entry.id === updatedDocument.id ? updatedDocument : entry,
        ),
      );
      setSaveMessage(
        action === "CANCEL"
          ? `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${document.billNumber} cancelled${updatedDocument.cancelReason ? ` (${CANCEL_REASON_LABELS[updatedDocument.cancelReason]})` : ""}.`
          : action === "VOID"
            ? `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${document.billNumber} voided.`
            : `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${document.billNumber} reopened.`,
      );
    } catch (error) {
      console.error(error);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : `Unable to update ${config.singularLabel} status.`,
      );
    } finally {
      setServerActionDocumentId(null);
    }
  };

  const openDocumentHistory = async (document: SalesDocumentDraft) => {
    if (!activeStore) {
      setSaveMessage(`Select a business before viewing ${config.singularLabel} history.`);
      return;
    }

    setHistoryDocument(document);
    setHistoryEntries([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const entries = await getSalesDocumentHistory(
        document.id,
        activeStore,
        config.documentType,
      );
      setHistoryEntries(entries);
    } catch (error) {
      console.error(error);
      setHistoryError(
        error instanceof Error
          ? error.message
          : `Unable to load ${config.singularLabel} history.`,
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const confirmCancelDocument = async () => {
    if (!pendingCancelDocument) {
      return;
    }

    await applyServerDocumentAction(
      pendingCancelDocument,
      "CANCEL",
      cancelReasonDraft,
    );
    setPendingCancelDocument(null);
  };

  const pendingActionDialogs: ReactNode = (
    <>
      {pendingCancelDocument ? (
        <ActionReasonDialog
          title={`Cancel ${config.singularLabel}`}
          description={`${pendingCancelDocument.billNumber} will stay in history and stop moving forward.`}
          reasonLabel="Cancellation reason"
          reasons={(
            pendingCancelDocument.documentType === "SALES_ESTIMATE"
              ? ["CUSTOMER_DECLINED", "INTERNAL_DROP", "OTHER"]
              : ["INTERNAL_DROP", "OTHER"]
          ).map((reason) => ({
            value: reason,
            label: CANCEL_REASON_LABELS[reason as SalesDocumentCancelReason],
          }))}
          selectedReason={cancelReasonDraft}
          confirmLabel={
            serverActionDocumentId === pendingCancelDocument.id
              ? "Cancelling..."
              : "Confirm Cancel"
          }
          disabled={serverActionDocumentId === pendingCancelDocument.id}
          hint="Cancel when the deal is no longer active and the document should stay in history."
          onSelectedReasonChange={(reason) =>
            setCancelReasonDraft(reason as SalesDocumentCancelReason)
          }
          onConfirm={() => {
            void confirmCancelDocument();
          }}
          onClose={() => {
            if (serverActionDocumentId === pendingCancelDocument.id) {
              return;
            }
            setPendingCancelDocument(null);
          }}
        />
      ) : null}
      {historyDocument ? (
        <DocumentHistoryDialog
          title={`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} History`}
          description={`Lifecycle and conversion events for ${historyDocument.billNumber}.`}
          entries={historyEntries}
          loading={historyLoading}
          error={historyError}
          onClose={() => {
            if (historyLoading) {
              return;
            }
            setHistoryDocument(null);
            setHistoryEntries([]);
            setHistoryError(null);
          }}
        />
      ) : null}
    </>
  );

  const openCustomerCreate = () => {
    navigate("/app/customers/new", {
      state: {
        returnTo: config.routePath,
        invoiceDraft: buildRouteInvoiceDraft(),
        draftSource: activeDraftSource ?? "local",
        customerPrefill: {
          name: phoneCandidate ? "" : customerName.trim(),
          phone: phoneCandidate,
        },
      } satisfies BillingRouteState,
    });
  };

  const quickCreateCustomerFromPhone = async () => {
    if (
      !activeStore ||
      !identityId ||
      !phoneCandidate ||
      customerActionLoading
    ) {
      return;
    }

    setCustomerActionLoading(true);
    setSaveMessage(null);
    try {
      const entityId = crypto.randomUUID();
      await queueCustomerCreate(
        activeStore,
        identityId,
        {
          name: phoneCandidate,
          phone: phoneCandidate,
          email: "",
          address: "",
          gstNo: "",
        },
        entityId,
      );
      await syncOnce(activeStore);
      const nextCustomer: CustomerRow = {
        entityId,
        name: phoneCandidate,
        phone: phoneCandidate,
        email: "",
        address: "",
        gstNo: "",
        isActive: true,
        deletedAt: null,
        serverVersion: 0,
        pending: false,
      };
      setCustomers((current) => sortCustomers([...current, nextCustomer]));
      applyCustomer(nextCustomer);
      setSaveMessage(
        `Customer created from phone for this cash ${config.singularLabel}.`,
      );
    } catch (error) {
      console.error(error);
      setSaveMessage(
        "Unable to create a customer from this phone number right now.",
      );
    } finally {
      setCustomerActionLoading(false);
    }
  };

  return {
    activeBusiness,
    activeBusinessName,
    activeCustomer,
    activeDraftId,
    activeServerDocument,
    appendLine,
    applyCustomer,
    applyLineItem,
    applySuggestedInvoiceNumber,
    billNumber,
    canQuickCreateFromPhone,
    customerActionLoading,
    customerAddress,
    customerGstNo,
    customerId,
    customerName,
    customerPhone,
    customers,
    dispatchCarrier,
    dispatchDate,
    dispatchReference,
    documentLocationId,
    draftMutationLoading,
    duplicateMeta,
    duplicateWarningAlerts,
    duplicateWarnings,
    getRowMenuActions,
    getLineOriginTitle,
    getLinkedLineCap,
    getOriginBadgeClassName,
    getSameItemMixedOriginHint,
    handleSalesLineNavigation,
    invoiceRows,
    isOnline,
    isPosMode,
    isViewingPostedDocument,
    itemOptions,
    lines,
    loadDraft,
    loadServerDraft,
    lookupError,
    lookupLoading,
    notes,
    numberConflict,
    openCustomerCreate,
    openNewDraft,
    openRowMenuAnchorRect,
    openRowMenuId,
    openRowMenuItems,
    pendingActionDialogs,
    postDraft,
    postValidationMessage,
    quickAddItemQuery,
    quickAddLineItem,
    quickCreateCustomerFromPhone,
    refreshDuplicatePricesToCurrent,
    removeLine,
    saveDraft,
    saveMessage,
    serverInvoicesError,
    serverInvoicesLoading,
    setBillNumber,
    setCustomerAddress,
    setCustomerGstNo,
    setCustomerId,
    setCustomerName,
    setCustomerPhone,
    setDispatchCarrier,
    setDispatchDate,
    setDispatchReference,
    setDocumentLocationId,
    setNotes,
    setNumberConflict,
    setOpenRowMenuAnchorRect,
    setOpenRowMenuId,
    setQuickAddItemQuery,
    setTransactionType,
    setValidUntil,
    setViewMode,
    shouldShowOriginBadges,
    toggleRowMenu,
    totals,
    transactionType,
    updateLine,
    validUntil,
    viewMode,
  };
}

function buildSalesItemOptions(
  stockOptions: StockVariantOption[],
  pricingByVariantId: Map<string, ItemPricingRow>,
  stockLevelByVariantId: Map<string, StockLevelRow>,
): SalesItemOption[] {
  return stockOptions.map((option) => {
    const pricing = pricingByVariantId.get(option.variantId);
    const stockLevel = stockLevelByVariantId.get(option.variantId);
    const gstLabel = formatGstSlabLabel(pricing?.gstSlab);
    return {
      ...option,
      description: option.label,
      priceAmount: pricing?.amount ?? null,
      currency: pricing?.currency ?? "INR",
      gstLabel,
      taxRate: parseGstRate(gstLabel),
      taxMode: pricing?.taxMode ?? "EXCLUSIVE",
      quantityOnHand: stockLevel?.quantityOnHand ?? null,
    };
  });
}

function applyCustomerSnapshot(
  customer: Pick<
    CustomerRow,
    "entityId" | "name" | "phone" | "address" | "gstNo"
  >,
  setCustomerId: (value: string | null) => void,
  setCustomerName: (value: string) => void,
  setCustomerPhone: (value: string) => void,
  setCustomerAddress: (value: string) => void,
  setCustomerGstNo: (value: string) => void,
) {
  setCustomerId(customer.entityId);
  setCustomerName(customer.name);
  setCustomerPhone(customer.phone);
  setCustomerAddress(customer.address);
  setCustomerGstNo(customer.gstNo);
}
