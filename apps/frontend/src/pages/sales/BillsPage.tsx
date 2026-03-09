import { useEffect, useMemo, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
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

type SavedBillDraft = {
  id: string;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  notes: string;
  savedAt: string;
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

const STORAGE_KEY_PREFIX = "mini_erp_sales_invoice_drafts_v2";

type BillingRouteState = {
  returnTo?: string;
  invoiceDraft?: Partial<SavedBillDraft>;
  createdCustomer?: Partial<CustomerRow>;
  customerMessage?: string;
  customerPrefill?: {
    name?: string;
    phone?: string;
  };
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

const createBillNumber = (count: number) => `INV-${String(count + 1).padStart(4, "0")}`;

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTaxRateNumber = (value: string) => {
  if (!value || value === "EXEMPT") return 0;
  const parsed = Number(value.replace("%", ""));
  return Math.max(0, Number.isFinite(parsed) ? parsed : 0);
};

const getLineTotals = (line: Pick<BillLine, "quantity" | "unitPrice" | "taxRate" | "taxMode">) => {
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

const getDraftGrandTotal = (lines: BillLine[]) =>
  lines.reduce((sum, line) => sum + getLineTotals(line).total, 0);

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
  return Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(3)));
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
  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
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

const normalizeStoredLine = (rawLine: unknown): BillLine => {
  const line =
    rawLine && typeof rawLine === "object" ? (rawLine as Record<string, unknown>) : {};

  return {
    id: typeof line.id === "string" && line.id.trim() ? line.id : crypto.randomUUID(),
    variantId: typeof line.variantId === "string" ? line.variantId : "",
    description: typeof line.description === "string" ? line.description : "",
    quantity: typeof line.quantity === "string" ? line.quantity : "1",
    unitPrice: typeof line.unitPrice === "string" ? line.unitPrice : "",
    taxRate:
      typeof line.taxRate === "string" ? normalizeGstSlab(line.taxRate) ?? "0%" : "0%",
    taxMode: line.taxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
    unit: typeof line.unit === "string" && line.unit.trim() ? line.unit : "PCS",
    stockOnHand:
      typeof line.stockOnHand === "number" && Number.isFinite(line.stockOnHand)
        ? line.stockOnHand
        : null,
  };
};

const loadStoredDrafts = (activeStore: string | null) => {
  if (!activeStore || typeof window === "undefined") {
    return [] as SavedBillDraft[];
  }

  try {
    const storedValue = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${activeStore}`);
    const parsed = storedValue ? (JSON.parse(storedValue) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry, index) => {
      const draft =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const lines = Array.isArray(draft.lines) ? draft.lines.map(normalizeStoredLine) : [];
      return {
        id: typeof draft.id === "string" && draft.id.trim() ? draft.id : `draft-${index + 1}`,
        billNumber:
          typeof draft.billNumber === "string" && draft.billNumber.trim()
            ? draft.billNumber
            : createBillNumber(index),
        transactionType: draft.transactionType === "CREDIT" ? "CREDIT" : "CASH",
        customerId: typeof draft.customerId === "string" ? draft.customerId : null,
        customerName: typeof draft.customerName === "string" ? draft.customerName : "",
        customerPhone: typeof draft.customerPhone === "string" ? draft.customerPhone : "",
        customerAddress: typeof draft.customerAddress === "string" ? draft.customerAddress : "",
        customerGstNo: typeof draft.customerGstNo === "string" ? draft.customerGstNo : "",
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
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusiness = businesses.find((business) => business.id === activeStore) ?? null;

  return (
    <BillsWorkspace
      key={activeStore ?? "no-store"}
      activeStore={activeStore}
      activeBusinessName={activeBusiness?.name ?? "No business selected"}
    />
  );
}

function BillsWorkspace({
  activeStore,
  activeBusinessName,
}: {
  activeStore: string | null;
  activeBusinessName: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const [initialDrafts] = useState<SavedBillDraft[]>(() => loadStoredDrafts(activeStore));
  const [drafts, setDrafts] = useState<SavedBillDraft[]>(initialDrafts);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [billNumber, setBillNumber] = useState(() => createBillNumber(initialDrafts.length));
  const [transactionType, setTransactionType] = useState<"CASH" | "CREDIT">("CASH");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstNo, setCustomerGstNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([createLine()]);
  const [saveMessage, setSaveMessage] = useState<string | null>(
    activeStore ? null : "Select a business to start a sales invoice.",
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

  const storageKey = activeStore ? `${STORAGE_KEY_PREFIX}:${activeStore}` : null;

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

        setCustomers(sortCustomers(nextCustomers.filter((customer) => customer.isActive)));
        setItemOptions(
          buildSalesItemOptions(stockOptions, pricingByVariantId, stockLevelByVariantId),
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
          normalizedName.length > 0 && customer.name.trim().toLowerCase() === normalizedName;
        const phoneMatches =
          normalizedPhone.length > 0 &&
          normalizePhoneCandidate(customer.phone) === normalizedPhone;
        return nameMatches || phoneMatches;
      }) ?? null
    );
  }, [customerId, customerName, customers]);

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
      setBillNumber(
        typeof draft.billNumber === "string" && draft.billNumber.trim()
          ? draft.billNumber
          : createBillNumber(drafts.length),
      );
      setTransactionType(draft.transactionType === "CREDIT" ? "CREDIT" : "CASH");
      setCustomerId(typeof draft.customerId === "string" ? draft.customerId : null);
      setCustomerName(typeof draft.customerName === "string" ? draft.customerName : "");
      setCustomerPhone(typeof draft.customerPhone === "string" ? draft.customerPhone : "");
      setCustomerAddress(typeof draft.customerAddress === "string" ? draft.customerAddress : "");
      setCustomerGstNo(typeof draft.customerGstNo === "string" ? draft.customerGstNo : "");
      setNotes(typeof draft.notes === "string" ? draft.notes : "");
      setLines(
        Array.isArray(draft.lines) && draft.lines.length > 0
          ? draft.lines.map(normalizeStoredLine)
          : [createLine()],
      );
      if (!routeState.createdCustomer && !routeState.customerMessage) {
        setSaveMessage("Returned to billing. The invoice draft was restored.");
      }
    }

    const createdCustomer = routeState.createdCustomer;
    if (createdCustomer) {
      const hydratedCustomer: CustomerRow = {
        entityId:
          typeof createdCustomer.entityId === "string" && createdCustomer.entityId.trim()
            ? createdCustomer.entityId
            : crypto.randomUUID(),
        name: typeof createdCustomer.name === "string" ? createdCustomer.name : "",
        phone: typeof createdCustomer.phone === "string" ? createdCustomer.phone : "",
        email: typeof createdCustomer.email === "string" ? createdCustomer.email : "",
        address: typeof createdCustomer.address === "string" ? createdCustomer.address : "",
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
          ...current.filter((customer) => customer.entityId !== hydratedCustomer.entityId),
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
  }, [drafts.length, location.pathname, navigate, routeState]);

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

  const phoneCandidate = useMemo(() => normalizePhoneCandidate(customerName), [customerName]);
  const canQuickCreateFromPhone =
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

  const persistDrafts = (nextDrafts: SavedBillDraft[]) => {
    setDrafts(nextDrafts);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
    }
  };

  const resetEditor = (nextDraftCount: number) => {
    setActiveDraftId(null);
    setBillNumber(createBillNumber(nextDraftCount));
    setTransactionType("CASH");
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerGstNo("");
    setNotes("");
    setLines([createLine()]);
  };

  const openNewDraft = () => {
    resetEditor(drafts.length);
    setSaveMessage(activeStore ? null : "Select a business to start a sales invoice.");
    setViewMode("editor");
  };

  const saveDraft = () => {
    if (!storageKey) {
      setSaveMessage("Select a business before saving an invoice draft.");
      return;
    }

    if (transactionType === "CREDIT" && !activeCustomer) {
      setSaveMessage("Credit invoices require an existing customer. Create or select one first.");
      return;
    }

    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      setSaveMessage("Add at least one line with an item or amount before saving.");
      return;
    }

    const nextDraft: SavedBillDraft = {
      id: activeDraftId ?? crypto.randomUUID(),
      billNumber: billNumber.trim() || createBillNumber(drafts.length),
      transactionType,
      customerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerGstNo: customerGstNo.trim(),
      notes: notes.trim(),
      savedAt: new Date().toISOString(),
      lines: normalizedLines,
    };

    const nextDrafts = activeDraftId
      ? drafts.map((draft) => (draft.id === activeDraftId ? nextDraft : draft))
      : [nextDraft, ...drafts];

    persistDrafts(nextDrafts);
    setActiveDraftId(nextDraft.id);
    setBillNumber(nextDraft.billNumber);
    setLines(nextDraft.lines);
    setSaveMessage("Invoice draft saved locally on this device. Posting is not wired yet.");
  };

  const loadDraft = (draft: SavedBillDraft) => {
    setActiveDraftId(draft.id);
    setBillNumber(draft.billNumber);
    setTransactionType(draft.transactionType);
    setCustomerId(draft.customerId);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerAddress(draft.customerAddress);
    setCustomerGstNo(draft.customerGstNo);
    setNotes(draft.notes);
    setLines(draft.lines.map((line) => ({ ...line })));
    setSaveMessage(null);
    setViewMode("editor");
  };

  const removeDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    persistDrafts(nextDrafts);

    if (draftId === activeDraftId) {
      resetEditor(nextDrafts.length);
      setSaveMessage("Draft removed.");
    }
  };

  const updateLine = (lineId: string, field: keyof BillLine, value: string) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value, ...(field === "description" ? { variantId: "" } : {}) } : line,
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

    if (highlightedLineId) {
      setLineHighlightRequest((current) => ({
        lineId: highlightedLineId,
        nonce: (current?.nonce ?? 0) + 1,
      }));
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
    billNumber,
    transactionType,
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    customerGstNo,
    notes,
    savedAt: new Date().toISOString(),
    lines,
  });

  const openCustomerCreate = () => {
    navigate("/app/customers/new", {
      state: {
        returnTo: "/app/sales-bills",
        invoiceDraft: buildRouteInvoiceDraft(),
        customerPrefill: {
          name: phoneCandidate ? "" : customerName.trim(),
          phone: phoneCandidate,
        },
      } satisfies BillingRouteState,
    });
  };

  const quickCreateCustomerFromPhone = async () => {
    if (!activeStore || !identityId || !phoneCandidate || customerActionLoading) {
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
      setSaveMessage("Customer created from phone for this cash invoice.");
    } catch (error) {
      console.error(error);
      setSaveMessage("Unable to create a customer from this phone number right now.");
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
              <h1 className="text-sm font-semibold text-foreground">Sales Bills / Invoices</h1>
              <p className="text-xs text-muted-foreground">
                Recent invoice drafts stay local until the backend sales posting flow is wired.
              </p>
            </div>
            <Button type="button" size="sm" onClick={openNewDraft}>
              Create Invoice
            </Button>
          </div>

          <div className="space-y-2 pt-2 lg:hidden">
            {drafts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                No recent invoices yet. Create an invoice to start this transaction flow.
              </div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    draft.id === activeDraftId
                      ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                      : "border-border/70 bg-white text-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{draft.billNumber}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {draft.customerName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatCurrency(getDraftGrandTotal(draft.lines))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(draft.savedAt)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 font-semibold text-[#1f4167] hover:bg-transparent"
                        onClick={() => loadDraft(draft)}
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 font-semibold text-[#8a2b2b] hover:bg-transparent"
                        onClick={() => removeDraft(draft.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {drafts.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                No recent invoices yet. Create an invoice to start this transaction flow.
              </div>
            ) : (
              <DenseTable className="mt-2 rounded-xl border-border/80">
                <DenseTableHead>
                  <tr>
                    <DenseTableHeaderCell className="w-[14%]">Invoice</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[24%]">Customer</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[12%]">Lines</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[16%]">Total</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[20%]">Saved</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[14%] text-right">Actions</DenseTableHeaderCell>
                  </tr>
                </DenseTableHead>
                <DenseTableBody>
                  {drafts.map((draft) => (
                    <DenseTableRow key={draft.id}>
                      <DenseTableCell className="font-semibold text-foreground">
                        {draft.billNumber}
                      </DenseTableCell>
                      <DenseTableCell>{draft.customerName}</DenseTableCell>
                      <DenseTableCell>
                        {draft.lines.length} line{draft.lines.length === 1 ? "" : "s"}
                      </DenseTableCell>
                      <DenseTableCell className="font-semibold text-foreground">
                        {formatCurrency(getDraftGrandTotal(draft.lines))}
                      </DenseTableCell>
                      <DenseTableCell>{formatDateTime(draft.savedAt)}</DenseTableCell>
                      <DenseTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            type="button"
                            icon={Eye}
                            variant="ghost"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                            onClick={() => loadDraft(draft)}
                            aria-label={`Open ${draft.billNumber}`}
                            title="Open"
                          />
                          <IconButton
                            type="button"
                            icon={Trash2}
                            variant="ghost"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-white/55"
                            onClick={() => removeDraft(draft.id)}
                            aria-label={`Delete ${draft.billNumber}`}
                            title="Delete"
                          />
                        </div>
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
              {activeDraftId ? "Edit Sales Invoice" : "Create Sales Invoice"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Select a customer, add bill lines, and review the invoice totals before saving.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setViewMode("list")}>
              Back to Recent
            </Button>
            <Button type="button" size="sm" onClick={saveDraft}>
              Save Draft ({normalizeLines(lines).length || 1})
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-2 pt-1 md:flex-row md:items-start">
          <div className="space-y-1">
            <Label htmlFor="sales-bill-transaction-switch">Transaction</Label>
            <div className="flex h-8 w-max items-center gap-2 rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 text-xs text-[#15314e] lg:h-7 lg:text-[11px]">
              <span className={transactionType === "CASH" ? "font-semibold text-foreground" : "text-muted-foreground"}>
                Cash
              </span>
              <Switch
                id="sales-bill-transaction-switch"
                checked={transactionType === "CREDIT"}
                onCheckedChange={(checked) => setTransactionType(checked ? "CREDIT" : "CASH")}
                aria-label="Toggle cash or credit transaction"
                className="h-6 w-11 border border-[#b8cbe0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]"
                checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
              />
              <span className={transactionType === "CREDIT" ? "font-semibold text-foreground" : "text-muted-foreground"}>
                Credit
              </span>
            </div>
          </div>
          <div className="space-y-1 md:w-48">
            <Label htmlFor="sales-bill-number">Invoice number</Label>
            <Input
              id="sales-bill-number"
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
            />
          </div>
          <div className="space-y-1 md:w-96 md:max-w-[400px]">
            <Label htmlFor="sales-bill-customer">Customer</Label>
            <LookupDropdownInput
              id="sales-bill-customer"
              value={customerName}
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
                  <div className="font-medium text-foreground">{customer.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {[customer.phone, customer.gstNo].filter(Boolean).join("  |  ") || "No phone or GST"}
                  </div>
                </div>
              )}
            />
            {transactionType === "CREDIT" && !activeCustomer ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-amber-700">Credit invoices require an existing customer.</span>
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
            {transactionType === "CASH" && !activeCustomer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  Customer is optional for cash invoices.
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
                      {customerActionLoading ? "Creating..." : "Quick create from phone"}
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
            {activeCustomer || customerId || customerPhone || customerGstNo || customerAddress ? (
              <div className="px-1 pt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Phone:</span> {activeCustomer?.phone || customerPhone || "Not provided"} •{" "}
                <span className="font-medium text-foreground">GST:</span> {activeCustomer?.gstNo || customerGstNo || "Not provided"} •{" "}
                <span className="font-medium text-foreground">Address:</span> {activeCustomer?.address || customerAddress || "No billing address"}
              </div>
            ) : null}
          </div>
        </div>

        {lookupError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
            {lookupError}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 md:overflow-hidden">
          <div className="flex items-center justify-between md:shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Invoice Lines
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((currentLines) => [...currentLines, createLine()])}
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
                    <div className="text-xs font-semibold text-foreground">Line {index + 1}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`sales-line-mobile-description-${line.id}`}>Item</Label>
                      <LookupDropdownInput
                        id={`sales-line-mobile-description-${line.id}`}
                        value={line.description}
                        onValueChange={(value) => updateLine(line.id, "description", value)}
                        options={itemOptions}
                        loading={lookupLoading}
                        loadingLabel="Loading items"
                        placeholder="Search item or service"
                        onOptionSelect={(option) => applyLineItem(line.id, option)}
                        getOptionKey={(option) => option.variantId}
                        getOptionSearchText={(option) =>
                          `${option.label} ${option.sku} ${option.gstLabel}`
                        }
                        renderOption={(option) => <ItemOptionContent option={option} />}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-qty-${line.id}`}>Qty</Label>
                        <Input
                          id={`sales-line-mobile-qty-${line.id}`}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, "quantity", event.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-rate-${line.id}`}>Rate</Label>
                        <Input
                          id={`sales-line-mobile-rate-${line.id}`}
                          value={line.unitPrice}
                          onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>GST %</Label>
                        <GstSlabSelect
                          id={`sales-line-mobile-tax-${line.id}`}
                          className="h-[38px] text-xs text-left"
                          value={normalizeGstSlab(line.taxRate) || ""}
                          onChange={(e) => updateLine(line.id, "taxRate", e.target.value)}
                          placeholderOption="GST %"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                       <div className="rounded-md border border-border/70 bg-white px-2 py-1.5 flex items-center">
                         <span className="mr-1">Unit:</span>
                         <span className="font-medium text-foreground">{line.unit || "PCS"}</span>
                       </div>
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         className="h-auto w-full justify-between border-border/70 px-2 py-1.5 text-[11px] font-normal text-muted-foreground bg-white"
                         onClick={() =>
                           updateLine(
                             line.id,
                             "taxMode",
                             line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                           )
                         }
                       >
                         Tax mode:
                         <span className="font-medium text-foreground">
                           {line.taxMode === "INCLUSIVE" ? "Inclusive" : "Exclusive"}
                         </span>
                       </Button>
                       <div className="rounded-md border border-border/70 bg-white px-2 py-1.5 col-span-2 space-y-0.5">
                         {toTaxRateNumber(line.taxRate) > 0 ? (
                           line.taxMode === "INCLUSIVE" ? (
                             <>
                               <div className="flex justify-between">
                                 <span>Base (excl. GST)</span>
                                 <span className="font-medium text-foreground">{formatCurrency(lineTotals.subTotal)}</span>
                               </div>
                               <div className="flex justify-between">
                                 <span>GST ({line.taxRate})</span>
                                 <span className="font-medium text-foreground">{formatCurrency(lineTotals.taxTotal)}</span>
                               </div>
                             </>
                           ) : (
                             <>
                               <div className="flex justify-between">
                                 <span>Base</span>
                                 <span className="font-medium text-foreground">{formatCurrency(lineTotals.subTotal)}</span>
                               </div>
                               <div className="flex justify-between">
                                 <span>+GST ({line.taxRate})</span>
                                 <span className="font-medium text-foreground">{formatCurrency(lineTotals.taxTotal)}</span>
                               </div>
                             </>
                           )
                         ) : null}
                         <div className="flex justify-between border-t border-border/50 pt-0.5">
                           <span className="font-semibold text-foreground">Line total</span>
                           <span className="font-semibold text-foreground">{formatCurrency(lineTotals.total)}</span>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
              );
            })}
          </div>

          <div className="hidden min-h-0 flex-1 overflow-hidden md:block">
            <div className="h-full overflow-auto rounded-xl border border-border/80">
              <DenseTable className="rounded-none border-0">
                <DenseTableHead>
                  <tr>
                    <DenseTableHeaderCell className="w-[40%]">Item</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[12%]">Qty</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[10%]">Rate</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[10%]">GST %</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[8%]">Mode</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[16%] text-right">Total</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[4%] text-right"> </DenseTableHeaderCell>
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
                              onValueChange={(value) => updateLine(line.id, "description", value)}
                              options={itemOptions}
                              loading={lookupLoading}
                              loadingLabel="Loading items"
                              placeholder="Search item or service"
                              onOptionSelect={(option) => applyLineItem(line.id, option)}
                              getOptionKey={(option) => option.variantId}
                              getOptionSearchText={(option) =>
                                `${option.label} ${option.sku} ${option.gstLabel}`
                              }
                              renderOption={(option) => <ItemOptionContent option={option} />}
                            />
                          </div>
                        </DenseTableCell>
                        <DenseTableCell className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              className="w-16 min-w-0 px-2 text-right"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, "quantity", event.target.value)}
                              inputMode="decimal"
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {line.unit || "PCS"}
                            </span>
                          </div>
                        </DenseTableCell>
                        <DenseTableCell className="py-1.5">
                          <Input
                            className="min-w-0 px-2 text-right"
                            value={line.unitPrice}
                            onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)}
                            inputMode="decimal"
                          />
                        </DenseTableCell>
                        <DenseTableCell className="py-1.5">
                          <GstSlabSelect
                            className="h-8 min-w-0 px-2 text-left text-xs"
                            value={normalizeGstSlab(line.taxRate) || ""}
                            onChange={(e) => updateLine(line.id, "taxRate", e.target.value)}
                            placeholderOption="GST %"
                          />
                        </DenseTableCell>
                        <DenseTableCell className="py-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full min-w-0 border-border/70 px-0 text-xs text-muted-foreground"
                            onClick={() =>
                              updateLine(
                                line.id,
                                "taxMode",
                                line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                              )
                            }
                          >
                            {line.taxMode === "INCLUSIVE" ? "Inc" : "Exc"}
                          </Button>
                        </DenseTableCell>
                        <DenseTableCell className="py-1.5 text-right">
                          <div className="flex h-8 items-center justify-end text-[11px] font-semibold text-foreground whitespace-nowrap">
                            {toTaxRateNumber(line.taxRate) > 0 ? (
                              line.taxMode === "INCLUSIVE"
                                ? `${formatCurrency(lineTotals.total)} (incl. GST ${formatCurrency(lineTotals.taxTotal)})`
                                : `${formatCurrency(lineTotals.subTotal)} + ${formatCurrency(lineTotals.taxTotal)} = ${formatCurrency(lineTotals.total)}`
                            ) : formatCurrency(lineTotals.total)}
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
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-border/85 bg-white p-2 md:flex-row md:shrink-0">
            <div className="flex-1 space-y-1">
              <Label htmlFor="sales-bill-notes">Notes</Label>
              <Textarea
                id="sales-bill-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal note"
                rows={2}
                className="w-full resize-none overflow-y-auto rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 py-2 text-xs text-[#15314e] placeholder:text-[#6d829b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#5d95d6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/20 md:h-[4.5rem] md:px-2.5 md:py-1.5 md:text-[11px]"
              />
            </div>
            <div className="w-full border-t border-border/70 pt-2 md:w-[320px] md:border-l md:border-t-0 md:pl-4 md:pt-0">
              <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border/70 pb-2 text-[11px]">
                <span className="shrink-0 font-semibold text-foreground">Invoice Summary</span>
                <span className="shrink-0 text-muted-foreground">•</span>
                <span className="truncate text-muted-foreground">{activeBusinessName}</span>
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
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-xs">
                  <span className="font-semibold text-foreground">Grand total</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
                {saveMessage ? (
                  <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
                    {saveMessage}
                  </div>
                ) : null}
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
  customer: Pick<CustomerRow, "entityId" | "name" | "phone" | "address" | "gstNo">,
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
          option.priceAmount !== null ? formatCurrency(option.priceAmount) : "No sales price",
        ]
          .filter(Boolean)
          .join("  |  ")}
      </div>
    </div>
  );
}
