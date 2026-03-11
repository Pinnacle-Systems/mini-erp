import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileOutput,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Switch } from "../../design-system/atoms/Switch";
import { Textarea } from "../../design-system/atoms/Textarea";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
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
import { formatGstSlabLabel, normalizeGstSlab } from "../../lib/gst-slabs";
import {
  createSalesDocumentDraft,
  deleteSalesDocumentDraft,
  transitionSalesDocument,
  listSalesDocuments,
  postSalesDocumentDraft,
  SalesDocumentApiError,
  type SalesDocumentDraft,
  type SalesDocumentAction,
  type SalesDocumentType,
  updateSalesDocumentDraft,
} from "./sales-invoices-api";

type BillLine = {
  id: string;
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
};

type SalesItemOption = StockVariantOption & {
  description: string;
  priceAmount: number | null;
  currency: string;
  gstLabel: string;
  taxRate: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  quantityOnHand: number | null;
};

type SalesDocumentPageConfig = {
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

type InvoiceListRow =
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

type RowMenuAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
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

const usesTransactionType = (documentType: SalesDocumentType) =>
  documentType === "SALES_INVOICE";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTaxRateNumber = (value: string) => {
  if (!value || value === "EXEMPT") return 0;
  const parsed = Number(value.replace("%", ""));
  return Math.max(0, Number.isFinite(parsed) ? parsed : 0);
};

const getLineTotals = (
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: string) => {
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

const normalizeLines = (lines: BillLine[]) => {
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

const SALES_DOCUMENT_PAGE_CONFIG: Record<
  SalesDocumentType,
  SalesDocumentPageConfig
> = {
  SALES_ESTIMATE: {
    documentType: "SALES_ESTIMATE",
    routePath: "/app/sales-estimates",
    listTitle: "Sales Quotations / Estimates",
    createTitle: "Create Sales Estimate",
    singularLabel: "estimate",
    pluralLabel: "estimates",
    listEmptyMessage:
      "No recent estimates yet. Create one to start this sales flow.",
    createActionLabel: "Create Estimate",
    postActionLabel: "Post Estimate",
    routeAppDraftLabel: "estimate",
    numberPrefix: "EST-",
    storageKeyPrefix: "mini_erp_sales_estimate_drafts_v1",
  },
  SALES_ORDER: {
    documentType: "SALES_ORDER",
    routePath: "/app/sales-orders",
    listTitle: "Sales Orders",
    createTitle: "Create Sales Order",
    singularLabel: "sales order",
    pluralLabel: "sales orders",
    listEmptyMessage:
      "No recent sales orders yet. Create one to start this sales flow.",
    createActionLabel: "Create Order",
    postActionLabel: "Post Order",
    routeAppDraftLabel: "sales order",
    numberPrefix: "SO-",
    storageKeyPrefix: "mini_erp_sales_order_drafts_v1",
  },
  DELIVERY_CHALLAN: {
    documentType: "DELIVERY_CHALLAN",
    routePath: "/app/delivery-challans",
    listTitle: "Delivery Challans",
    createTitle: "Create Delivery Challan",
    singularLabel: "delivery challan",
    pluralLabel: "delivery challans",
    listEmptyMessage:
      "No recent delivery challans yet. Create one to start this dispatch flow.",
    createActionLabel: "Create Challan",
    postActionLabel: "Post Challan",
    routeAppDraftLabel: "delivery challan",
    numberPrefix: "DC-",
    storageKeyPrefix: "mini_erp_delivery_challan_drafts_v1",
  },
  SALES_INVOICE: {
    documentType: "SALES_INVOICE",
    routePath: "/app/sales-bills",
    listTitle: "Sales Bills / Invoices",
    createTitle: "Create Sales Invoice",
    singularLabel: "invoice",
    pluralLabel: "invoices",
    listEmptyMessage:
      "No recent invoices yet. Create one to start this transaction flow.",
    createActionLabel: "Create Invoice",
    postActionLabel: "Post Invoice",
    routeAppDraftLabel: "invoice",
    numberPrefix: "INV-",
    storageKeyPrefix: "mini_erp_sales_invoice_drafts_v2",
  },
  SALES_RETURN: {
    documentType: "SALES_RETURN",
    routePath: "/app/sales-returns",
    listTitle: "Sales Returns / Credit Notes",
    createTitle: "Create Sales Return / Credit Note",
    singularLabel: "sales return",
    pluralLabel: "sales returns",
    listEmptyMessage:
      "No recent sales returns yet. Create one to start this return flow.",
    createActionLabel: "Create Return",
    postActionLabel: "Post Return",
    routeAppDraftLabel: "sales return",
    numberPrefix: "SRN-",
    storageKeyPrefix: "mini_erp_sales_return_drafts_v1",
  },
};

const SALES_DOCUMENT_CONVERSION_CONFIG: Partial<
  Record<SalesDocumentType, SalesDocumentConversionConfig>
> = {
  SALES_ESTIMATE: {
    targetDocumentType: "SALES_ORDER",
    targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_ORDER.routePath,
    actionLabel: "Convert to Order",
  },
  SALES_ORDER: {
    targetDocumentType: "SALES_INVOICE",
    targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE.routePath,
    actionLabel: "Convert to Invoice",
  },
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
      } satisfies SavedBillDraft;
    });
  } catch {
    return [];
  }
};

export function BillsPage() {
  return (
    <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE} />
  );
}
export function EstimatesPage() {
  return (
    <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.SALES_ESTIMATE} />
  );
}
export function OrdersPage() {
  return <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.SALES_ORDER} />;
}
export function DeliveryChallansPage() {
  return (
    <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.DELIVERY_CHALLAN} />
  );
}
export function ReturnsPage() {
  return <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.SALES_RETURN} />;
}

function SalesDocumentPage({ config }: { config: SalesDocumentPageConfig }) {
  const activeStore = useSessionStore((state) => state.activeStore);
  return (
    <SalesDocumentWorkspace
      key={`${config.documentType}:${activeStore ?? "no-store"}`}
      activeStore={activeStore}
      config={config}
    />
  );
}

function SalesDocumentWorkspace({
  activeStore,
  config,
}: {
  activeStore: string | null;
  config: SalesDocumentPageConfig;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusinessName =
    businesses.find((business) => business.id === activeStore)?.name ??
    "No business selected";
  const [initialDrafts] = useState<SavedBillDraft[]>(() =>
    loadStoredDrafts(activeStore, config),
  );
  const [drafts, setDrafts] = useState<SavedBillDraft[]>(initialDrafts);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftSource, setActiveDraftSource] =
    useState<DraftSource | null>(null);
  const [billNumber, setBillNumber] = useState(() =>
    getNextBillNumber(config.numberPrefix, [], initialDrafts),
  );
  const [transactionType, setTransactionType] = useState<"CASH" | "CREDIT">(
    "CREDIT",
  );
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstNo, setCustomerGstNo] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [dispatchCarrier, setDispatchCarrier] = useState("");
  const [dispatchReference, setDispatchReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([createLine()]);
  const [saveMessage, setSaveMessage] = useState<string | null>(
    activeStore
      ? null
      : `Select a business to start a ${config.singularLabel}.`,
  );
  const [lineHighlightRequest, setLineHighlightRequest] = useState<{
    lineId: string;
    nonce: number;
  } | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [itemOptions, setItemOptions] = useState<SalesItemOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [draftMutationLoading, setDraftMutationLoading] = useState(false);
  const [serverActionDocumentId, setServerActionDocumentId] = useState<
    string | null
  >(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [numberConflict, setNumberConflict] =
    useState<NumberConflictState | null>(null);
  const [serverInvoices, setServerInvoices] = useState<SalesDocumentDraft[]>(
    [],
  );
  const [serverInvoicesLoading, setServerInvoicesLoading] = useState(false);
  const [serverInvoicesError, setServerInvoicesError] = useState<string | null>(
    null,
  );
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
    if (!activeStore || !isOnline) {
      setServerInvoices([]);
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

  const activeCustomer = useMemo(() => {
    if (customerId) {
      return (
        customers.find((customer) => customer.entityId === customerId) ?? null
      );
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
      return ["CANCEL", "VOID"];
    }
    if (document.status === "CANCELLED") {
      return ["REOPEN"];
    }
    return [];
  };

  const getServerDocumentConversion = (
    document: SalesDocumentDraft,
  ): SalesDocumentConversionConfig | null => {
    if (!["OPEN", "PARTIAL"].includes(document.status ?? "OPEN")) {
      return null;
    }

    return SALES_DOCUMENT_CONVERSION_CONFIG[document.documentType] ?? null;
  };

  const startDocumentConversion = (document: SalesDocumentDraft) => {
    const conversion = getServerDocumentConversion(document);
    if (!conversion) {
      return;
    }

    navigate(conversion.targetRoutePath, {
      state: {
        returnTo: config.routePath,
        draftSource: "local",
        invoiceDraft: {
          documentType: conversion.targetDocumentType,
          parentId: document.id,
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
          lines: document.lines.map((line) => ({
            ...line,
            id: crypto.randomUUID(),
            stockOnHand: line.stockOnHand ?? null,
          })),
        },
      } satisfies BillingRouteState,
    });
  };

  const getRowMenuActions = (row: InvoiceListRow): RowMenuAction[] => {
    if (row.status === "DRAFT") {
      return [
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
            void removeDraft(row.id, row.source);
          },
        },
      ];
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
    const conversion = getServerDocumentConversion(row.invoice);
    if (conversion) {
      actions.push({
        key: "convert",
        label: conversion.actionLabel,
        icon: FileOutput,
        onSelect: () => {
          startDocumentConversion(row.invoice);
        },
      });
    }

    for (const action of getServerDocumentActions(row.invoice)) {
      actions.push({
        key: action,
        label:
          action === "CANCEL"
            ? "Cancel"
            : action === "VOID"
              ? "Void"
              : "Reopen",
        icon: action === "REOPEN" ? RotateCcw : XCircle,
        tone: action === "VOID" ? "danger" : "default",
        disabled: serverActionDocumentId === row.id,
        onSelect: () => {
          void applyServerDocumentAction(row.invoice, action);
        },
      });
    }

    return actions;
  };

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
      setCustomerId(
        typeof draft.customerId === "string" ? draft.customerId : null,
      );
      setCustomerName(
        typeof draft.customerName === "string" ? draft.customerName : "",
      );
      setCustomerPhone(
        typeof draft.customerPhone === "string" ? draft.customerPhone : "",
      );
      setCustomerAddress(
        typeof draft.customerAddress === "string" ? draft.customerAddress : "",
      );
      setCustomerGstNo(
        typeof draft.customerGstNo === "string" ? draft.customerGstNo : "",
      );
      setValidUntil(
        typeof draft.validUntil === "string" ? draft.validUntil : "",
      );
      setDispatchDate(
        typeof draft.dispatchDate === "string" ? draft.dispatchDate : "",
      );
      setDispatchCarrier(
        typeof draft.dispatchCarrier === "string" ? draft.dispatchCarrier : "",
      );
      setDispatchReference(
        typeof draft.dispatchReference === "string"
          ? draft.dispatchReference
          : "",
      );
      setNotes(typeof draft.notes === "string" ? draft.notes : "");
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
        name:
          typeof createdCustomer.name === "string" ? createdCustomer.name : "",
        phone:
          typeof createdCustomer.phone === "string"
            ? createdCustomer.phone
            : "",
        email:
          typeof createdCustomer.email === "string"
            ? createdCustomer.email
            : "",
        address:
          typeof createdCustomer.address === "string"
            ? createdCustomer.address
            : "",
        gstNo:
          typeof createdCustomer.gstNo === "string"
            ? createdCustomer.gstNo
            : "",
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
    config.documentType,
    location.pathname,
    navigate,
    nextBillNumber,
    routeState,
    config.routeAppDraftLabel,
  ]);

  useEffect(() => {
    if (!openRowMenuId) {
      return;
    }

    const handlePointerDown = () => {
      setOpenRowMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openRowMenuId]);

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

  const resetEditor = () => {
    setActiveDraftId(null);
    setActiveDraftSource(null);
    setBillNumber(nextBillNumber);
    setTransactionType("CASH");
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerGstNo("");
    setParentId(null);
    setValidUntil("");
    setDispatchDate("");
    setDispatchCarrier("");
    setDispatchReference("");
    setNotes("");
    setLines([createLine()]);
    setNumberConflict(null);
  };

  const openNewDraft = () => {
    resetEditor();
    setSaveMessage(
      activeStore
        ? null
        : `Select a business to start a ${config.singularLabel}.`,
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
            ? drafts.map((draft) =>
                draft.id === activeDraftId ? nextDraft : draft,
              )
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
    setNumberConflict(null);
    setSaveMessage(null);
    setViewMode("editor");
  };

  const removeDraft = async (draftId: string, source: DraftSource) => {
    if (draftMutationLoading) {
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
          ? {
              ...line,
              [field]: value,
              ...(field === "description" ? { variantId: "" } : {}),
            }
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
        (line) => line.variantId === option.variantId && line.id !== lineId,
      );

      if (existingLine) {
        highlightedLineId = existingLine.id;
        const incrementBy = Math.max(toNumber(currentLine.quantity), 1);

        return currentLines
          .map((line) =>
            line.id === existingLine.id
              ? {
                  ...line,
                  quantity: formatQuantity(
                    toNumber(line.quantity) + incrementBy,
                  ),
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
                option.priceAmount !== null &&
                Number.isFinite(option.priceAmount)
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

  const removeLine = (lineId: string) => {
    setLines((currentLines) => {
      if (currentLines.length === 1) {
        return [createLine()];
      }
      return currentLines.filter((line) => line.id !== lineId);
    });
  };

  const buildRouteInvoiceDraft = (): SavedBillDraft => ({
    id: activeDraftId ?? crypto.randomUUID(),
    documentType: config.documentType,
    parentId,
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
    resetEditor();
    setViewMode("list");
    setSaveMessage(
      `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${serverDraft.billNumber} posted.`,
    );
  };

  const postDraft = async () => {
    if (postValidationMessage) {
      setSaveMessage(postValidationMessage);
      return;
    }

    setDraftMutationLoading(true);
    setSaveMessage(null);
    setNumberConflict(null);
    try {
      const localDraft = buildNormalizedDraft();
      await submitPostedDraft(localDraft, activeStore!);
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
      } else {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : `Unable to post ${config.singularLabel}.`,
        );
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
          requested:
            error.details.requested?.trim() || numberConflict.suggested,
          suggested: error.details.suggested.trim(),
        });
        setSaveMessage(
          `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number ${error.details.requested?.trim() || numberConflict.suggested} is already in use.`,
        );
      } else {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : `Unable to post ${config.singularLabel}.`,
        );
      }
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const applyServerDocumentAction = async (
    document: SalesDocumentDraft,
    action: SalesDocumentAction,
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
      );
      setServerInvoices((current) =>
        current.map((entry) =>
          entry.id === updatedDocument.id ? updatedDocument : entry,
        ),
      );
      setSaveMessage(
        action === "CANCEL"
          ? `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} ${document.billNumber} cancelled.`
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

  if (viewMode === "list") {
    return (
      <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
        <div className="flex flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0 lg:flex-1">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">
                {config.listTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                Draft and posted {config.pluralLabel} are shown together here.
                Status indicates whether a document is still local or already
                posted.
              </p>
            </div>
            <Button type="button" size="sm" onClick={openNewDraft}>
              {config.createActionLabel}
            </Button>
          </div>

          <div className="space-y-2 pt-2 lg:hidden">
            {saveMessage ? (
              <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
                {saveMessage}
              </div>
            ) : null}
            {serverInvoicesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                {serverInvoicesError}
              </div>
            ) : null}
            {serverInvoicesLoading ? (
              <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {invoiceRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              invoiceRows.map((row) => (
                <div
                  key={`${row.source}:${row.id}`}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    row.source === "local" && row.id === activeDraftId
                      ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                      : "border-border/70 bg-white text-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {row.billNumber}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {row.customerName}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(row.timestamp)}</span>
                    <span>{formatCurrency(row.total)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {row.lines.length} line{row.lines.length === 1 ? "" : "s"}
                    </span>
                    {(() => {
                      const actions = getRowMenuActions(row);
                      if (actions.length === 0) {
                        return null;
                      }

                      return (
                        <div
                          className="relative"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <IconButton
                            type="button"
                            icon={MoreHorizontal}
                            variant="ghost"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                            aria-label={`Open actions for ${row.billNumber}`}
                            title="More actions"
                            aria-expanded={openRowMenuId === row.id}
                            onClick={() =>
                              setOpenRowMenuId((current) =>
                                current === row.id ? null : row.id,
                              )
                            }
                          />
                          {openRowMenuId === row.id ? (
                            <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-border/80 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
                              <div className="grid gap-1">
                                {actions.map((action) => (
                                  <Button
                                    key={action.key}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] ${
                                      action.tone === "danger"
                                        ? "text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                                        : "text-[#15314e]"
                                    }`}
                                    disabled={action.disabled}
                                    onClick={() => {
                                      setOpenRowMenuId(null);
                                      action.onSelect();
                                    }}
                                  >
                                    <action.icon
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                    {action.disabled && action.key !== "delete"
                                      ? "Working..."
                                      : action.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {saveMessage ? (
              <div className="mt-2 rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
                {saveMessage}
              </div>
            ) : null}
            {serverInvoicesError ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                {serverInvoicesError}
              </div>
            ) : null}
            {serverInvoicesLoading ? (
              <div className="mt-2 rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {invoiceRows.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              <DenseTable className="mt-2 rounded-xl border-border/80">
                <DenseTableHead>
                  <tr>
                    <DenseTableHeaderCell className="w-[14%]">
                      Number
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[22%]">
                      Customer
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[10%]">
                      Status
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[10%]">
                      Lines
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[14%]">
                      Total
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[18%]">
                      Updated
                    </DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[12%] text-right">
                      Actions
                    </DenseTableHeaderCell>
                  </tr>
                </DenseTableHead>
                <DenseTableBody>
                  {invoiceRows.map((row) => (
                    <DenseTableRow key={`${row.source}:${row.id}`}>
                      <DenseTableCell className="font-semibold text-foreground">
                        {row.billNumber}
                      </DenseTableCell>
                      <DenseTableCell>{row.customerName}</DenseTableCell>
                      <DenseTableCell>{row.status}</DenseTableCell>
                      <DenseTableCell>
                        {row.lines.length} line
                        {row.lines.length === 1 ? "" : "s"}
                      </DenseTableCell>
                      <DenseTableCell className="font-semibold text-foreground">
                        {formatCurrency(row.total)}
                      </DenseTableCell>
                      <DenseTableCell>
                        {formatDateTime(row.timestamp)}
                      </DenseTableCell>
                      <DenseTableCell className="text-right">
                        {(() => {
                          const actions = getRowMenuActions(row);
                          if (actions.length === 0) {
                            return (
                              <span className="text-[11px] text-muted-foreground">
                                Posted
                              </span>
                            );
                          }

                          return (
                            <div
                              className="relative inline-flex"
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <IconButton
                                type="button"
                                icon={MoreHorizontal}
                                variant="ghost"
                                className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                                onClick={() =>
                                  setOpenRowMenuId((current) =>
                                    current === row.id ? null : row.id,
                                  )
                                }
                                aria-label={`Open actions for ${row.billNumber}`}
                                title="More actions"
                                aria-expanded={openRowMenuId === row.id}
                              />
                              {openRowMenuId === row.id ? (
                                <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-border/80 bg-white p-1 text-left shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
                                  <div className="grid gap-1">
                                    {actions.map((action) => (
                                      <Button
                                        key={action.key}
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] ${
                                          action.tone === "danger"
                                            ? "text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                                            : "text-[#15314e]"
                                        }`}
                                        disabled={action.disabled}
                                        onClick={() => {
                                          setOpenRowMenuId(null);
                                          action.onSelect();
                                        }}
                                      >
                                        <action.icon
                                          className="h-3.5 w-3.5"
                                          aria-hidden="true"
                                        />
                                        {action.disabled &&
                                        action.key !== "delete"
                                          ? "Working..."
                                          : action.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </DenseTableCell>
                    </DenseTableRow>
                  ))}
                </DenseTableBody>
              </DenseTable>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-1 lg:overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-semibold text-foreground">
              {isViewingPostedDocument
                ? `View ${config.createTitle.replace("Create ", "")}`
                : activeDraftId
                ? `Edit ${config.createTitle.replace("Create ", "")}`
                : config.createTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isViewingPostedDocument
                ? "Posted documents open here in read-only mode for review."
                : "Select a customer, add lines, save the draft, then post when it is ready."}
            </p>
            {isViewingPostedDocument ? (
              <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground">
                Status: {activeServerDocument?.status ?? "OPEN"}
              </div>
            ) : null}
            {!isOnline ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                {`You are offline. Drafts still save locally. Reconnect to post this ${config.singularLabel}.`}
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:justify-end lg:gap-2">
            <div className="flex flex-wrap gap-2 lg:flex-nowrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode("list")}
              >
                Back to Recent
              </Button>
              {!isViewingPostedDocument ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void saveDraft();
                    }}
                    disabled={draftMutationLoading}
                  >
                    {draftMutationLoading
                      ? "Saving..."
                      : `Save Draft (${normalizeLines(lines).length || 1})`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void postDraft();
                    }}
                    disabled={
                      draftMutationLoading || Boolean(postValidationMessage)
                    }
                    title={postValidationMessage ?? config.postActionLabel}
                  >
                    {draftMutationLoading
                      ? "Working..."
                      : !postValidationMessage
                        ? config.postActionLabel
                        : "Cannot Post Yet"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-2 pt-1 md:flex-row md:items-start">
          {usesTransactionType(config.documentType) ? (
            <div className="space-y-1">
              <Label htmlFor="sales-bill-transaction-switch">Transaction</Label>
              <div className="flex h-8 w-max items-center gap-2 rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 text-xs text-[#15314e] lg:h-7 lg:text-[11px]">
                <span
                  className={
                    transactionType === "CASH"
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  Cash
                </span>
                <Switch
                  id="sales-bill-transaction-switch"
                  checked={transactionType === "CREDIT"}
                  disabled={isViewingPostedDocument}
                  onCheckedChange={(checked) =>
                    setTransactionType(checked ? "CREDIT" : "CASH")
                  }
                  aria-label="Toggle cash or credit transaction"
                  className="h-6 w-11 border border-[#b8cbe0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]"
                  checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                  uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                />
                <span
                  className={
                    transactionType === "CREDIT"
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  Credit
                </span>
              </div>
            </div>
          ) : null}
          <div className="space-y-1 md:w-48">
            <Label htmlFor="sales-bill-number">
              {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number`}
            </Label>
            <Input
              id="sales-bill-number"
              value={billNumber}
              readOnly={isViewingPostedDocument}
              disabled={isViewingPostedDocument}
              onChange={(event) => {
                setBillNumber(event.target.value);
                setNumberConflict(null);
              }}
            />
            {numberConflict ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number`}{" "}
                <span className="font-semibold">
                  {numberConflict.requested}
                </span>{" "}
                is already used. Suggested:{" "}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 text-[11px] font-semibold text-[#1f4167] underline underline-offset-2 hover:bg-transparent"
                  onClick={() => {
                    void applySuggestedInvoiceNumber();
                  }}
                  disabled={draftMutationLoading}
                >
                  {numberConflict.suggested}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-1 md:w-[28rem] md:max-w-[28rem]">
            <Label htmlFor="sales-bill-customer">
              {usesTransactionType(config.documentType)
                ? "Customer"
                : "Customer *"}
            </Label>
            <LookupDropdownInput
              id="sales-bill-customer"
              value={customerName}
              disabled={isViewingPostedDocument}
              onValueChange={(value) => {
                setCustomerName(value);
                setCustomerId(null);
                if (!value.trim()) {
                  setCustomerPhone("");
                  setCustomerAddress("");
                  setCustomerGstNo("");
                }
              }}
              options={customers}
              loading={lookupLoading}
              loadingLabel="Loading customers"
              placeholder="Search or enter customer"
              onOptionSelect={applyCustomer}
              getOptionKey={(customer) => customer.entityId}
              getOptionSearchText={(customer) =>
                `${customer.name} ${customer.phone} ${customer.email} ${customer.gstNo}`
              }
              renderOption={(customer) => (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">
                    {customer.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {[customer.phone, customer.gstNo]
                      .filter(Boolean)
                      .join("  |  ") || "No phone or GST"}
                  </div>
                </div>
              )}
            />
            {!isViewingPostedDocument &&
            usesTransactionType(config.documentType) &&
            transactionType === "CREDIT" &&
            !activeCustomer ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-amber-700">
                  {`Credit ${config.pluralLabel} require an existing customer.`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 text-[11px] font-semibold text-[#1f4167] hover:bg-transparent"
                  onClick={openCustomerCreate}
                >
                  Create customer
                </Button>
              </div>
            ) : null}
            {!isViewingPostedDocument &&
            usesTransactionType(config.documentType) &&
            transactionType === "CASH" &&
            !activeCustomer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  {`Customer is optional for cash ${config.pluralLabel}.`}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {canQuickCreateFromPhone ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 py-0 text-[11px] font-semibold text-[#1f4167] hover:bg-transparent"
                      onClick={() => {
                        void quickCreateCustomerFromPhone();
                      }}
                      disabled={customerActionLoading}
                    >
                      {customerActionLoading
                        ? "Creating..."
                        : "Quick create from phone"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 py-0 text-[11px] font-semibold text-[#1f4167] hover:bg-transparent"
                    onClick={openCustomerCreate}
                  >
                    Create customer
                  </Button>
                </div>
              </div>
            ) : null}
            {!isViewingPostedDocument &&
            !usesTransactionType(config.documentType) &&
            !customerName.trim() ? (
              <div className="text-[11px] text-amber-700">
                {`Customer details are required for this ${config.singularLabel}.`}
              </div>
            ) : null}
            {activeCustomer ||
            customerId ||
            customerPhone ||
            customerGstNo ||
            customerAddress ? (
              <div className="px-1 pt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Phone:</span>{" "}
                {activeCustomer?.phone || customerPhone || "Not provided"} •{" "}
                <span className="font-medium text-foreground">GST:</span>{" "}
                {activeCustomer?.gstNo || customerGstNo || "Not provided"} •{" "}
                <span className="font-medium text-foreground">Address:</span>{" "}
                {activeCustomer?.address ||
                  customerAddress ||
                  "No billing address"}
              </div>
            ) : null}
          </div>
          {config.documentType === "SALES_ESTIMATE" ? (
            <div className="space-y-1 md:w-[17rem] md:min-w-[17rem]">
              <Label htmlFor="sales-estimate-valid-until">Valid until</Label>
              <Input
                id="sales-estimate-valid-until"
                type="date"
                value={validUntil}
                readOnly={isViewingPostedDocument}
                disabled={isViewingPostedDocument}
                onChange={(event) => setValidUntil(event.target.value)}
              />
              <div className="text-[11px] text-muted-foreground">
                Validity stays with the estimate so later conversions can carry
                the committed expiry.
              </div>
            </div>
          ) : null}
        </div>

        {lookupError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
            {lookupError}
          </div>
        ) : null}

        {config.documentType === "DELIVERY_CHALLAN" ? (
          <div className="grid gap-2 rounded-xl border border-border/80 bg-slate-50 p-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="delivery-challan-dispatch-date">
                Dispatch date
              </Label>
              <Input
                id="delivery-challan-dispatch-date"
                type="date"
                value={dispatchDate}
                readOnly={isViewingPostedDocument}
                disabled={isViewingPostedDocument}
                onChange={(event) => setDispatchDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="delivery-challan-carrier">Carrier</Label>
              <Input
                id="delivery-challan-carrier"
                value={dispatchCarrier}
                readOnly={isViewingPostedDocument}
                disabled={isViewingPostedDocument}
                onChange={(event) => setDispatchCarrier(event.target.value)}
                placeholder="Optional transporter or vehicle"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="delivery-challan-reference">
                Dispatch reference
              </Label>
              <Input
                id="delivery-challan-reference"
                value={dispatchReference}
                readOnly={isViewingPostedDocument}
                disabled={isViewingPostedDocument}
                onChange={(event) => setDispatchReference(event.target.value)}
                placeholder="LR no. / trip / docket"
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 md:overflow-hidden">
          <div className="flex items-center justify-between md:shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Lines`}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isViewingPostedDocument}
              onClick={() =>
                setLines((currentLines) => [...currentLines, createLine()])
              }
            >
              Add Line
            </Button>
          </div>

          <div className="space-y-2 md:hidden">
            {lines.map((line, index) => {
              const lineTotals = getLineTotals(line);
              return (
                <div
                  key={line.id}
                  data-bill-line-id={line.id}
                  className="rounded-lg border border-border/80 bg-slate-50 p-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground">
                      Line {index + 1}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeLine(line.id)}
                      disabled={isViewingPostedDocument}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`sales-line-mobile-description-${line.id}`}
                      >
                        Item
                      </Label>
                      <LookupDropdownInput
                        id={`sales-line-mobile-description-${line.id}`}
                        value={line.description}
                        disabled={isViewingPostedDocument}
                        onValueChange={(value) =>
                          updateLine(line.id, "description", value)
                        }
                        options={itemOptions}
                        loading={lookupLoading}
                        loadingLabel="Loading items"
                        placeholder="Search item or service"
                        onOptionSelect={(option) =>
                          applyLineItem(line.id, option)
                        }
                        getOptionKey={(option) => option.variantId}
                        getOptionSearchText={(option) =>
                          `${option.label} ${option.sku} ${option.gstLabel}`
                        }
                        renderOption={(option) => (
                          <ItemOptionContent option={option} />
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-qty-${line.id}`}>
                          Qty
                        </Label>
                        <Input
                          id={`sales-line-mobile-qty-${line.id}`}
                          value={line.quantity}
                          readOnly={isViewingPostedDocument}
                          disabled={isViewingPostedDocument}
                          onChange={(event) =>
                            updateLine(line.id, "quantity", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-rate-${line.id}`}>
                          Rate
                        </Label>
                        <Input
                          id={`sales-line-mobile-rate-${line.id}`}
                          value={line.unitPrice}
                          readOnly={isViewingPostedDocument}
                          disabled={isViewingPostedDocument}
                          onChange={(event) =>
                            updateLine(line.id, "unitPrice", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>GST %</Label>
                        <GstSlabSelect
                          id={`sales-line-mobile-tax-${line.id}`}
                          className="h-[38px] text-xs text-left"
                          value={normalizeGstSlab(line.taxRate) || ""}
                          disabled={isViewingPostedDocument}
                          onChange={(e) =>
                            updateLine(line.id, "taxRate", e.target.value)
                          }
                          placeholderOption="GST %"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="rounded-md border border-border/70 bg-white px-2 py-1.5 flex items-center">
                        <span className="mr-1">Unit:</span>
                        <span className="font-medium text-foreground">
                          {line.unit || "PCS"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto w-full justify-between border-border/70 px-2 py-1.5 text-[11px] font-normal text-muted-foreground bg-white"
                        disabled={isViewingPostedDocument}
                        onClick={() =>
                          updateLine(
                            line.id,
                            "taxMode",
                            line.taxMode === "INCLUSIVE"
                              ? "EXCLUSIVE"
                              : "INCLUSIVE",
                          )
                        }
                      >
                        Tax mode:
                        <span className="font-medium text-foreground">
                          {line.taxMode === "INCLUSIVE"
                            ? "Inclusive"
                            : "Exclusive"}
                        </span>
                      </Button>
                      <div className="rounded-md border border-border/70 bg-white px-2 py-1.5 col-span-2 space-y-0.5">
                        {toTaxRateNumber(line.taxRate) > 0 ? (
                          line.taxMode === "INCLUSIVE" ? (
                            <>
                              <div className="flex justify-between">
                                <span>Base (excl. GST)</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(lineTotals.subTotal)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>GST ({line.taxRate})</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(lineTotals.taxTotal)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>Base</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(lineTotals.subTotal)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>+GST ({line.taxRate})</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(lineTotals.taxTotal)}
                                </span>
                              </div>
                            </>
                          )
                        ) : null}
                        <div className="flex justify-between border-t border-border/50 pt-0.5">
                          <span className="font-semibold text-foreground">
                            Line total
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(lineTotals.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden min-h-0 flex-1 overflow-hidden md:block">
            <DenseTable className="rounded-xl border-border/80 [scrollbar-gutter:stable]">
              <DenseTableHead>
                <tr>
                  <DenseTableHeaderCell className="w-[36%]">
                    Item
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[13%]">
                    Qty
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[10%]">
                    Rate
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[9%]">
                    GST %
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[7%]">
                    Mode
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[9%] text-right">
                    Tax
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[9%] text-right">
                    Total
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[4%] text-right">
                    {" "}
                  </DenseTableHeaderCell>
                </tr>
              </DenseTableHead>
              <DenseTableBody>
                {lines.map((line) => {
                  const lineTotals = getLineTotals(line);
                  return (
                    <DenseTableRow
                      key={line.id}
                      data-bill-line-id={line.id}
                      className="align-middle"
                    >
                      <DenseTableCell className="py-1.5">
                        <div className="space-y-1">
                          <LookupDropdownInput
                            value={line.description}
                            disabled={isViewingPostedDocument}
                            onValueChange={(value) =>
                              updateLine(line.id, "description", value)
                            }
                            options={itemOptions}
                            loading={lookupLoading}
                            loadingLabel="Loading items"
                            placeholder="Search item or service"
                            onOptionSelect={(option) =>
                              applyLineItem(line.id, option)
                            }
                            getOptionKey={(option) => option.variantId}
                            getOptionSearchText={(option) =>
                              `${option.label} ${option.sku} ${option.gstLabel}`
                            }
                            renderOption={(option) => (
                              <ItemOptionContent option={option} />
                            )}
                          />
                        </div>
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            className="!w-[4.5rem] shrink-0 px-1 text-right"
                            value={line.quantity}
                            readOnly={isViewingPostedDocument}
                            disabled={isViewingPostedDocument}
                            onChange={(event) =>
                              updateLine(
                                line.id,
                                "quantity",
                                event.target.value,
                              )
                            }
                            inputMode="decimal"
                          />
                          <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                            {line.unit || "PCS"}
                          </span>
                        </div>
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5">
                        <Input
                          className="min-w-0 px-2 text-right"
                          value={line.unitPrice}
                          readOnly={isViewingPostedDocument}
                          disabled={isViewingPostedDocument}
                          onChange={(event) =>
                            updateLine(line.id, "unitPrice", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5">
                        <GstSlabSelect
                          className="h-8 min-w-0 px-2 text-left text-xs"
                          value={normalizeGstSlab(line.taxRate) || ""}
                          disabled={isViewingPostedDocument}
                          onChange={(e) =>
                            updateLine(line.id, "taxRate", e.target.value)
                          }
                          placeholderOption="GST %"
                        />
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full min-w-0 border-border/70 px-0 text-xs text-muted-foreground"
                          disabled={isViewingPostedDocument}
                          onClick={() =>
                            updateLine(
                              line.id,
                              "taxMode",
                              line.taxMode === "INCLUSIVE"
                                ? "EXCLUSIVE"
                                : "INCLUSIVE",
                            )
                          }
                        >
                          {line.taxMode === "INCLUSIVE" ? "Inc" : "Exc"}
                        </Button>
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5 text-right">
                        <div className="flex h-8 items-center justify-end text-[11px] font-medium text-foreground whitespace-nowrap">
                          {formatCurrency(lineTotals.taxTotal)}
                        </div>
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5 text-right">
                        <div className="flex h-8 items-center justify-end text-[11px] font-semibold text-foreground whitespace-nowrap">
                          {formatCurrency(lineTotals.total)}
                        </div>
                      </DenseTableCell>
                      <DenseTableCell className="py-1.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          onClick={() => removeLine(line.id)}
                          title="Remove line"
                          disabled={isViewingPostedDocument}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </DenseTableCell>
                    </DenseTableRow>
                  );
                })}
              </DenseTableBody>
            </DenseTable>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-border/85 bg-white p-2 md:flex-row md:shrink-0">
            <div className="flex flex-1 flex-col gap-1 md:min-h-[6rem]">
              <Label htmlFor="sales-bill-notes">Notes</Label>
              <Textarea
                id="sales-bill-notes"
                value={notes}
                readOnly={isViewingPostedDocument}
                disabled={isViewingPostedDocument}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal note"
                rows={2}
                className="w-full resize-none overflow-y-auto rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 py-2 text-xs text-[#15314e] placeholder:text-[#6d829b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#5d95d6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/20 md:flex-1 md:px-2.5 md:py-1.5 md:text-[11px]"
              />
              <div className="min-h-[1.75rem]">
                {!isViewingPostedDocument && numberConflict ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    <span>
                      Requested number{" "}
                      <span className="font-semibold">
                        {numberConflict.requested}
                      </span>{" "}
                      is unavailable.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 py-0 text-[11px] font-semibold text-[#1f4167] hover:bg-transparent"
                      onClick={() => {
                        void applySuggestedInvoiceNumber();
                      }}
                      disabled={draftMutationLoading}
                    >
                      Use {numberConflict.suggested}
                    </Button>
                  </div>
                ) : !isViewingPostedDocument && postValidationMessage ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    {postValidationMessage}
                  </div>
                ) : saveMessage ? (
                  <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground">
                    {saveMessage}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="w-full border-t border-border/70 pt-2 md:w-[320px] md:border-l md:border-t-0 md:pl-4 md:pt-0">
              <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border/70 pb-2 text-[11px]">
                <span className="shrink-0 font-semibold text-foreground">
                  {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Summary`}
                </span>
                <span className="shrink-0 text-muted-foreground">•</span>
                <span className="truncate text-muted-foreground">
                  {activeBusinessName}
                </span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.subTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.taxTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Lines</span>
                  <span className="font-semibold text-foreground">
                    {normalizeLines(lines).length || 1}
                  </span>
                </div>
                {config.documentType === "SALES_ESTIMATE" && validUntil ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Valid until</span>
                    <span className="font-semibold text-foreground">
                      {validUntil}
                    </span>
                  </div>
                ) : null}
                {config.documentType === "DELIVERY_CHALLAN" ? (
                  <>
                    {dispatchDate ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Dispatch date
                        </span>
                        <span className="font-semibold text-foreground">
                          {dispatchDate}
                        </span>
                      </div>
                    ) : null}
                    {dispatchReference ? (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="truncate font-semibold text-foreground">
                          {dispatchReference}
                        </span>
                      </div>
                    ) : null}
                    {dispatchCarrier ? (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Carrier</span>
                        <span className="truncate font-semibold text-foreground">
                          {dispatchCarrier}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-xs">
                  <span className="font-semibold text-foreground">
                    Grand total
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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

function ItemOptionContent({ option }: { option: SalesItemOption }) {
  return (
    <div className="space-y-0.5">
      <div className="font-medium text-foreground">{option.label}</div>
      <div className="text-[10px] text-muted-foreground">
        {[
          option.unit,
          option.gstLabel ? `GST ${option.gstLabel}` : null,
          option.priceAmount !== null
            ? formatCurrency(option.priceAmount)
            : "No sales price",
        ]
          .filter(Boolean)
          .join("  |  ")}
      </div>
    </div>
  );
}
