import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Copy,
  Eye,
  History,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Textarea } from "../../design-system/atoms/Textarea";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { Card } from "../../design-system/molecules/Card";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../design-system/molecules/tabularSerialNumbers";
import { tabularNumericClassName } from "../../design-system/molecules/tabularTokens";
import {
  spreadsheetCellControlClassName,
  spreadsheetCellNumericClassName,
  spreadsheetCellSelectClassName,
} from "../../design-system/molecules/spreadsheetStyles";
import { ActionReasonDialog } from "../../design-system/organisms/ActionReasonDialog";
import { FloatingActionMenu, type FloatingActionMenuItem } from "../../design-system/organisms/FloatingActionMenu";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalItemPricingRowsForDisplay,
  getLocalStockLevels,
  getLocalStockVariantOptions,
  getLocalSuppliers,
  type ItemPricingRow,
  type StockLevelRow,
  type StockVariantOption,
  type SupplierRow,
} from "../../features/sync/engine";
import { useToast } from "../../features/toast/useToast";
import { formatGstSlabLabel, normalizeGstSlab } from "../../lib/gst-slabs";
import { cn } from "../../lib/utils";
import {
  createPurchaseDocumentDraft,
  deletePurchaseDocumentDraft,
  getPurchaseConversionBalance,
  getPurchaseDocumentHistory,
  listPurchaseDocuments,
  postPurchaseDocumentDraft,
  PurchaseDocumentApiError,
  transitionPurchaseDocument,
  updatePurchaseDocumentDraft,
  type PurchaseConversionBalanceLine,
  type PurchaseDocumentAction,
  type PurchaseDocumentCancelReason,
  type PurchaseDocumentDraft,
  type PurchaseDocumentHistoryEntry,
  type PurchaseDocumentLineDraft,
  type PurchaseDocumentType,
} from "./purchase-documents-api";

type PurchaseDocumentPageConfig = {
  documentType: PurchaseDocumentType;
  routePath: string;
  listTitle: string;
  createTitle: string;
  singularLabel: string;
  pluralLabel: string;
  listEmptyMessage: string;
  createActionLabel: string;
  postActionLabel: string;
  numberPrefix: string;
  defaultSettlementMode?: "CASH" | "CREDIT";
};

type PurchaseDocumentRouteParams = {
  documentId?: string;
};

type PurchaseDocumentConversionConfig = {
  targetDocumentType: PurchaseDocumentType;
  targetRoutePath: string;
  actionLabel: string;
};

type PurchaseLine = PurchaseDocumentLineDraft & {
  linkedRemainingQuantity?: string | null;
};

type PurchaseListRow = PurchaseDocumentDraft & {
  total: number;
  timestamp: string;
};

type PurchaseItemOption = StockVariantOption & {
  description: string;
  priceAmount: number | null;
  currency: string;
  gstLabel: string;
  taxRate: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  quantityOnHand: number | null;
};

type PurchaseRouteState = {
  parentDocumentId?: string;
  parentDocumentNumber?: string;
  parentDocumentType?: PurchaseDocumentType;
};

const CANCEL_REASON_LABELS: Record<PurchaseDocumentCancelReason, string> = {
  CUSTOMER_DECLINED: "Customer declined",
  INTERNAL_DROP: "Internal drop",
  OTHER: "Other",
};

const PURCHASE_DOCUMENT_PAGE_CONFIG: Record<
  PurchaseDocumentType,
  PurchaseDocumentPageConfig
> = {
  PURCHASE_ORDER: {
    documentType: "PURCHASE_ORDER",
    routePath: "/app/purchase-orders",
    listTitle: "Purchase Orders",
    createTitle: "Create Purchase Order",
    singularLabel: "purchase order",
    pluralLabel: "purchase orders",
    listEmptyMessage: "No recent purchase orders yet. Create one to begin procurement.",
    createActionLabel: "Create Order",
    postActionLabel: "Post Order",
    numberPrefix: "PO-",
  },
  GOODS_RECEIPT_NOTE: {
    documentType: "GOODS_RECEIPT_NOTE",
    routePath: "/app/goods-receipt-notes",
    listTitle: "Goods Receipt Notes",
    createTitle: "Create Goods Receipt Note",
    singularLabel: "goods receipt note",
    pluralLabel: "goods receipt notes",
    listEmptyMessage: "No recent GRNs yet. Receive stock here when goods arrive.",
    createActionLabel: "Create GRN",
    postActionLabel: "Post GRN",
    numberPrefix: "GRN-",
  },
  PURCHASE_INVOICE: {
    documentType: "PURCHASE_INVOICE",
    routePath: "/app/purchase-invoices",
    listTitle: "Purchase Invoices",
    createTitle: "Create Purchase Invoice",
    singularLabel: "purchase invoice",
    pluralLabel: "purchase invoices",
    listEmptyMessage: "No recent purchase invoices yet. Create one to bill inward purchases.",
    createActionLabel: "Create Invoice",
    postActionLabel: "Post Invoice",
    numberPrefix: "PINV-",
    defaultSettlementMode: "CREDIT",
  },
  PURCHASE_RETURN: {
    documentType: "PURCHASE_RETURN",
    routePath: "/app/purchase-returns",
    listTitle: "Purchase Returns",
    createTitle: "Create Purchase Return",
    singularLabel: "purchase return",
    pluralLabel: "purchase returns",
    listEmptyMessage: "No recent purchase returns yet. Create one from a posted GRN or invoice.",
    createActionLabel: "Create Return",
    postActionLabel: "Post Return",
    numberPrefix: "PRTN-",
  },
};

const PURCHASE_DOCUMENT_CONVERSIONS: Partial<
  Record<PurchaseDocumentType, PurchaseDocumentConversionConfig[]>
> = {
  PURCHASE_ORDER: [
    {
      targetDocumentType: "GOODS_RECEIPT_NOTE",
      targetRoutePath: PURCHASE_DOCUMENT_PAGE_CONFIG.GOODS_RECEIPT_NOTE.routePath,
      actionLabel: "Create GRN",
    },
    {
      targetDocumentType: "PURCHASE_INVOICE",
      targetRoutePath: PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_INVOICE.routePath,
      actionLabel: "Create Invoice",
    },
  ],
  GOODS_RECEIPT_NOTE: [
    {
      targetDocumentType: "PURCHASE_INVOICE",
      targetRoutePath: PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_INVOICE.routePath,
      actionLabel: "Create Invoice",
    },
    {
      targetDocumentType: "PURCHASE_RETURN",
      targetRoutePath: PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_RETURN.routePath,
      actionLabel: "Create Return",
    },
  ],
  PURCHASE_INVOICE: [
    {
      targetDocumentType: "PURCHASE_RETURN",
      targetRoutePath: PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_RETURN.routePath,
      actionLabel: "Create Return",
    },
  ],
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toRounded = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toTaxRateNumber = (value: string) => {
  if (!value.trim() || value === "EXEMPT") {
    return 0;
  }
  const normalized = value.endsWith("%") ? value.slice(0, -1) : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLineTotals = (line: PurchaseLine) => {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const taxRate = toTaxRateNumber(line.taxRate);
  const grossAmount = toRounded(quantity * unitPrice, 2);

  if (line.taxMode === "INCLUSIVE" && taxRate > 0) {
    const subTotal = toRounded(grossAmount / (1 + taxRate / 100), 2);
    const taxTotal = toRounded(grossAmount - subTotal, 2);
    return {
      subTotal,
      taxTotal,
      total: grossAmount,
    };
  }

  const subTotal = grossAmount;
  const taxTotal = toRounded(subTotal * (taxRate / 100), 2);
  return {
    subTotal,
    taxTotal,
    total: toRounded(subTotal + taxTotal, 2),
  };
};

const normalizeLines = (lines: PurchaseLine[]) =>
  lines.filter(
    (line) =>
      line.variantId.trim().length > 0 ||
      line.description.trim().length > 0 ||
      line.unitPrice.trim().length > 0,
  );

const createLine = (seed?: Partial<PurchaseLine>): PurchaseLine => ({
  id: crypto.randomUUID(),
  sourceLineId: null,
  variantId: "",
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: "0%",
  taxMode: "EXCLUSIVE",
  unit: "PCS",
  linkedRemainingQuantity: null,
  ...seed,
});

const formatSequenceNumber = (prefix: string, nextNumber: number) =>
  `${prefix}${String(nextNumber).padStart(4, "0")}`;

const parseSequenceNumber = (value: string, prefix: string) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(value.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNextBillNumber = (
  prefix: string,
  documents: Array<Pick<PurchaseDocumentDraft, "billNumber">>,
) => {
  const maxSequence = documents.reduce((max, document) => {
    const parsed = parseSequenceNumber(document.billNumber, prefix);
    return parsed && parsed > max ? parsed : max;
  }, 0);

  return formatSequenceNumber(prefix, maxSequence + 1);
};

const getDocumentTotal = (document: PurchaseDocumentDraft) =>
  normalizeLines(document.lines).reduce(
    (sum, line) => sum + getLineTotals(line as PurchaseLine).total,
    0,
  );

const usesSettlementMode = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_INVOICE";

const isStockAffectingDocument = (documentType: PurchaseDocumentType) =>
  documentType !== "PURCHASE_ORDER";

const requiresPostedParent = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_RETURN";

function PurchaseDocumentHistoryDialog({
  title,
  description,
  entries,
  loading,
  error,
  onClose,
}: {
  title: string;
  description: string;
  entries: PurchaseDocumentHistoryEntry[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const dialog = (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 p-0 md:p-4">
      <Card className="h-full w-full rounded-none border-0 bg-white p-0 shadow-none md:mx-auto md:mt-8 md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-xl md:border md:border-[#cfd9e5] md:shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#dbe4ee] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <XCircle className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-3 md:max-h-[calc(85vh-7.5rem)]">
          {loading ? (
            <div className="rounded-md border border-border/70 bg-slate-50 px-3 py-3 text-xs text-muted-foreground">
              Loading document history...
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-md border border-border/70 bg-slate-50 px-3 py-3 text-xs text-muted-foreground">
              No history has been recorded for this document yet.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/80 bg-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {entry.eventType === "CREATED"
                          ? "Draft created"
                          : entry.eventType === "UPDATED"
                            ? "Draft updated"
                            : entry.eventType === "CONVERSION_LINKED"
                              ? "Conversion linked"
                              : entry.fromStatus && entry.toStatus
                                ? `Status changed: ${entry.fromStatus} -> ${entry.toStatus}`
                                : "Status changed"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {entry.actorName?.trim() || "Unknown user"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end border-t border-[#dbe4ee] px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} className="h-8 px-3 text-xs">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}

function PurchaseDocumentPage({ config }: { config: PurchaseDocumentPageConfig }) {
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeLocationId = useSessionStore((state) => state.activeLocationId);

  return (
    <PurchaseDocumentWorkspace
      key={`${config.documentType}:${activeStore ?? "no-store"}:${activeLocationId ?? "default-location"}`}
      config={config}
      activeStore={activeStore}
      activeLocationId={activeLocationId}
    />
  );
}

function PurchaseDocumentWorkspace({
  config,
  activeStore,
  activeLocationId,
}: {
  config: PurchaseDocumentPageConfig;
  activeStore: string | null;
  activeLocationId: string | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { documentId } = useParams<PurchaseDocumentRouteParams>();
  const { showToast } = useToast();
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const activeBusinessName = activeBusiness?.name ?? "Active Business";
  const [documents, setDocuments] = useState<PurchaseDocumentDraft[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [draftMutationLoading, setDraftMutationLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<PurchaseDocumentHistoryEntry[]>([]);
  const [historyDocument, setHistoryDocument] = useState<PurchaseDocumentDraft | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [rowMenuAnchorRect, setRowMenuAnchorRect] = useState<DOMRect | null>(null);
  const [cancelDocument, setCancelDocument] = useState<PurchaseDocumentDraft | null>(null);
  const [selectedCancelReason, setSelectedCancelReason] =
    useState<PurchaseDocumentCancelReason>("OTHER");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentDocumentNumber, setParentDocumentNumber] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [settlementMode, setSettlementMode] = useState<"CASH" | "CREDIT">(
    config.defaultSettlementMode ?? "CASH",
  );
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([createLine()]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [itemOptions, setItemOptions] = useState<PurchaseItemOption[]>([]);
  const [postValidationMessage, setPostValidationMessage] = useState<string | null>(null);
  const rowMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const routeState = location.state as PurchaseRouteState | null;
  const createRoutePath = `${config.routePath}/new`;
  const isCreateRoute = location.pathname === createRoutePath;
  const isDocumentRoute = Boolean(documentId);
  const isEditorRoute = isCreateRoute || isDocumentRoute;

  const isViewingPostedDocument = useMemo(() => {
    const current = documents.find((entry) => entry.id === viewingDocumentId);
    return Boolean(current && current.status !== "DRAFT");
  }, [documents, viewingDocumentId]);

  const activeDocument = useMemo(
    () => documents.find((entry) => entry.id === (viewingDocumentId ?? activeDraftId)) ?? null,
    [activeDraftId, documents, viewingDocumentId],
  );

  const totals = useMemo(
    () =>
      normalizeLines(lines).reduce(
        (summary, line) => {
          const lineTotals = getLineTotals(line);
          return {
            subTotal: toRounded(summary.subTotal + lineTotals.subTotal, 2),
            taxTotal: toRounded(summary.taxTotal + lineTotals.taxTotal, 2),
            grandTotal: toRounded(summary.grandTotal + lineTotals.total, 2),
          };
        },
        { subTotal: 0, taxTotal: 0, grandTotal: 0 },
      ),
    [lines],
  );

  const documentRows = useMemo<PurchaseListRow[]>(
    () =>
      documents.map((document) => ({
        ...document,
        total: getDocumentTotal(document),
        timestamp: document.savedAt ?? document.postedAt ?? "",
      })),
    [documents],
  );

  const linkedRemainingBySourceLineId = useMemo(
    () =>
      new Map(
        lines
          .filter((line) => line.sourceLineId && line.linkedRemainingQuantity)
          .map((line) => [line.sourceLineId as string, line.linkedRemainingQuantity as string]),
      ),
    [lines],
  );

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    setDocumentsLoading(true);
    setDocumentsError(null);
    void listPurchaseDocuments(activeStore, config.documentType)
      .then((nextDocuments) => {
        setDocuments(nextDocuments);
        if (!isEditorRoute && !routeState?.parentDocumentId) {
          setBillNumber(getNextBillNumber(config.numberPrefix, nextDocuments));
        }
      })
      .catch((error) => {
        setDocumentsError(
          error instanceof Error ? error.message : "Unable to load purchase documents.",
        );
      })
      .finally(() => {
        setDocumentsLoading(false);
      });
  }, [activeStore, config.documentType, config.numberPrefix, isEditorRoute, routeState?.parentDocumentId]);

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    void Promise.all([
      getLocalSuppliers(activeStore),
      getLocalStockVariantOptions(activeStore),
      getLocalItemPricingRowsForDisplay(activeStore, undefined, false, "PURCHASE"),
      getLocalStockLevels(activeStore),
    ])
      .then(([nextSuppliers, stockOptions, pricingRows, stockLevels]) => {
        setSuppliers(nextSuppliers.filter((supplier) => supplier.isActive));
        setItemOptions(buildPurchaseItemOptions(stockOptions, pricingRows, stockLevels));
      })
      .catch((error) => {
        setLookupError(
          error instanceof Error ? error.message : "Unable to load suppliers or item lookups.",
        );
      })
      .finally(() => {
        setLookupLoading(false);
      });
  }, [activeStore]);

  useEffect(() => {
    if (!activeStore || !routeState?.parentDocumentId) {
      return;
    }

    const sourceDocumentId = routeState.parentDocumentId;
    const sourceDocumentNumber = routeState.parentDocumentNumber ?? "";

    void getPurchaseConversionBalance(sourceDocumentId, activeStore)
      .then((balance) => {
        const convertedLines = balance.lines
          .filter((line) => Number(line.remainingQuantity) > 0)
          .map((line) => toConvertedLine(line));

        setActiveDraftId(null);
        setViewingDocumentId(null);
        setParentId(sourceDocumentId);
        setParentDocumentNumber(sourceDocumentNumber);
        setBillNumber(getNextBillNumber(config.numberPrefix, documents));
        setSettlementMode(config.defaultSettlementMode ?? "CASH");
        setNotes("");
        setLines(convertedLines.length > 0 ? convertedLines : [createLine()]);
        setPostValidationMessage(null);
      })
      .catch((error) => {
        showToast({
          title: error instanceof Error ? error.message : "Unable to prepare conversion.",
          tone: "error",
        });
      })
      .finally(() => {
        navigate(location.pathname, { replace: true, state: null });
      });
  }, [activeStore, config.defaultSettlementMode, config.numberPrefix, documents, location.pathname, navigate, routeState?.parentDocumentId, routeState?.parentDocumentNumber, showToast]);

  useEffect(() => {
    if (documentsLoading) {
      return;
    }

    if (documentId) {
      const matchedDocument = documents.find((entry) => entry.id === documentId);
      if (!matchedDocument) {
        setFormError(`This ${config.singularLabel} could not be found.`);
        return;
      }

      applyDocumentToWorkspace(matchedDocument, matchedDocument.status !== "DRAFT");
      return;
    }

    if (isCreateRoute && !routeState?.parentDocumentId) {
      resetWorkspace(documents);
    }
  }, [config.singularLabel, documentId, documents, documentsLoading, isCreateRoute, routeState?.parentDocumentId]);

  useEffect(() => {
    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      setPostValidationMessage(`Add at least one ${config.singularLabel} line before posting.`);
      return;
    }

    if (usesSettlementMode(config.documentType) && settlementMode === "CREDIT" && !supplierId) {
      setPostValidationMessage(`Credit ${config.pluralLabel} require an existing supplier.`);
      return;
    }

    if (!supplierName.trim()) {
      setPostValidationMessage(`${config.createTitle.replace("Create ", "")} requires supplier details.`);
      return;
    }

    if (requiresPostedParent(config.documentType) && !parentId) {
      setPostValidationMessage("Purchase return must be created from a posted GRN or invoice.");
      return;
    }

    setPostValidationMessage(null);
  }, [config.createTitle, config.documentType, config.pluralLabel, config.singularLabel, lines, parentId, settlementMode, supplierId, supplierName]);

  const resetWorkspace = (nextDocuments: PurchaseDocumentDraft[]) => {
    setActiveDraftId(null);
    setViewingDocumentId(null);
    setParentId(null);
    setParentDocumentNumber("");
    setBillNumber(getNextBillNumber(config.numberPrefix, nextDocuments));
    setSettlementMode(config.defaultSettlementMode ?? "CASH");
    setSupplierId(null);
    setSupplierName("");
    setSupplierPhone("");
    setSupplierAddress("");
    setSupplierTaxId("");
    setNotes("");
    setLines([createLine()]);
    setPostValidationMessage(null);
    setFormError(null);
  };

  const applyDocumentToWorkspace = (document: PurchaseDocumentDraft, readOnly: boolean) => {
    setActiveDraftId(readOnly ? null : document.id);
    setViewingDocumentId(readOnly ? document.id : null);
    setParentId(document.parentId ?? null);
    setParentDocumentNumber("");
    setBillNumber(document.billNumber);
    setSettlementMode(document.settlementMode ?? config.defaultSettlementMode ?? "CASH");
    setSupplierId(document.supplierId ?? null);
    setSupplierName(document.supplierName);
    setSupplierPhone(document.supplierPhone);
    setSupplierAddress(document.supplierAddress);
    setSupplierTaxId(document.supplierTaxId);
    setNotes(document.notes);
    setLines(
      document.lines.length > 0
        ? document.lines.map((line) =>
            createLine({
              ...line,
              linkedRemainingQuantity: linkedRemainingBySourceLineId.get(line.sourceLineId ?? "") ?? null,
            }),
          )
        : [createLine()],
    );
    setFormError(null);
  };

  const persistDraft = async (mode: "save" | "post") => {
    if (!activeStore) {
      return;
    }

    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      showToast({
        title: `Add at least one ${config.singularLabel} line before saving.`,
        tone: "error",
      });
      return;
    }

    setDraftMutationLoading(true);
    setFormError(null);
    try {
      const payload = {
        tenantId: activeStore,
        documentType: config.documentType,
        parentId,
        locationId: isStockAffectingDocument(config.documentType) ? activeLocationId ?? null : null,
        billNumber: billNumber.trim(),
        settlementMode: usesSettlementMode(config.documentType) ? settlementMode : "CASH",
        supplierId,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim(),
        supplierAddress: supplierAddress.trim(),
        supplierTaxId: supplierTaxId.trim(),
        notes: notes.trim(),
        lines: normalizedLines,
      };

      const saved =
        activeDraftId
          ? await updatePurchaseDocumentDraft(activeDraftId, payload)
          : await createPurchaseDocumentDraft(payload);

      let nextDocument = saved;
      if (mode === "post") {
        nextDocument = await postPurchaseDocumentDraft(saved.id, activeStore, config.documentType);
      }

      const nextDocuments = await listPurchaseDocuments(activeStore, config.documentType);
      setDocuments(nextDocuments);

      if (mode === "post") {
        showToast({
          title: `${config.createTitle.replace("Create ", "")} posted.`,
          tone: "success",
        });
        applyDocumentToWorkspace(nextDocument, true);
      } else {
        showToast({
          title: `${config.createTitle.replace("Create ", "")} saved as draft.`,
          tone: "success",
        });
        applyDocumentToWorkspace(nextDocument, false);
      }

      navigate(`${config.routePath}/${nextDocument.id}`, { replace: true });
    } catch (error) {
      const message =
        error instanceof PurchaseDocumentApiError ? error.message : "Unable to save purchase draft.";
      setFormError(message);
      showToast({
        title: message,
        tone: "error",
      });
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const openHistory = async (document: PurchaseDocumentDraft) => {
    if (!activeStore) {
      return;
    }

    setHistoryDocument(document);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const entries = await getPurchaseDocumentHistory(document.id, activeStore, config.documentType);
      setHistoryEntries(entries);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Unable to load document history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const transitionDocument = async (
    document: PurchaseDocumentDraft,
    action: PurchaseDocumentAction,
    cancelReason?: PurchaseDocumentCancelReason,
  ) => {
    if (!activeStore) {
      return;
    }

    setDraftMutationLoading(true);
    setFormError(null);
    try {
      const nextDocument = await transitionPurchaseDocument(
        document.id,
        activeStore,
        config.documentType,
        action,
        cancelReason ?? null,
      );
      const nextDocuments = await listPurchaseDocuments(activeStore, config.documentType);
      setDocuments(nextDocuments);

      if (documentId === document.id || viewingDocumentId === document.id) {
        applyDocumentToWorkspace(nextDocument, nextDocument.status !== "DRAFT");
      }

      showToast({
        title:
          action === "CANCEL"
            ? `${config.createTitle.replace("Create ", "")} cancelled.`
            : action === "REOPEN"
              ? `${config.createTitle.replace("Create ", "")} reopened.`
              : `${config.createTitle.replace("Create ", "")} updated.`,
        tone: "success",
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update purchase document.");
      showToast({
        title: error instanceof Error ? error.message : "Unable to update purchase document.",
        tone: "error",
      });
    } finally {
      setDraftMutationLoading(false);
      setCancelDocument(null);
    }
  };

  const deleteDraft = async (document: PurchaseDocumentDraft) => {
    if (!activeStore) {
      return;
    }

    const confirmed = window.confirm(`Delete draft ${document.billNumber}?`);
    if (!confirmed) {
      return;
    }

    setDraftMutationLoading(true);
    setFormError(null);
    try {
      await deletePurchaseDocumentDraft(document.id, activeStore, config.documentType);
      const nextDocuments = await listPurchaseDocuments(activeStore, config.documentType);
      setDocuments(nextDocuments);
      if (documentId === document.id || activeDraftId === document.id || viewingDocumentId === document.id) {
        resetWorkspace(nextDocuments);
        navigate(config.routePath, { replace: true });
      }
      showToast({
        title: `${config.singularLabel} draft deleted.`,
        tone: "success",
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete purchase draft.");
      showToast({
        title: error instanceof Error ? error.message : "Unable to delete purchase draft.",
        tone: "error",
      });
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const getRowMenuActions = (row: PurchaseListRow): FloatingActionMenuItem[] => {
    const actions: FloatingActionMenuItem[] = [
      {
        key: "view",
        label: row.status === "DRAFT" ? "Open Draft" : "View Document",
        icon: Eye,
        onSelect: () => navigate(`${config.routePath}/${row.id}`),
      },
      {
        key: "history",
        label: "View History",
        icon: History,
        onSelect: () => {
          void openHistory(row);
        },
      },
    ];

    if (row.status === "DRAFT") {
      actions.push({
        key: "delete",
        label: "Delete Draft",
        icon: Trash2,
        tone: "danger",
        onSelect: () => {
          void deleteDraft(row);
        },
      });
      return actions;
    }

    for (const conversion of PURCHASE_DOCUMENT_CONVERSIONS[row.documentType] ?? []) {
      actions.push({
        key: `convert-${conversion.targetDocumentType}`,
        label: conversion.actionLabel,
        icon: Copy,
        onSelect: () =>
          navigate(`${conversion.targetRoutePath}/new`, {
            state: {
              parentDocumentId: row.id,
              parentDocumentNumber: row.billNumber,
              parentDocumentType: row.documentType,
            } satisfies PurchaseRouteState,
          }),
      });
    }

    if (row.status === "OPEN" || row.status === "PARTIAL") {
      actions.push({
        key: "cancel",
        label: "Cancel Document",
        icon: XCircle,
        tone: "danger",
        onSelect: () => {
          setSelectedCancelReason("OTHER");
          setCancelDocument(row);
        },
      });
    }

    if (row.status === "CANCELLED") {
      actions.push({
        key: "reopen",
        label: "Reopen Document",
        icon: RotateCcw,
        onSelect: () => {
          void transitionDocument(row, "REOPEN");
        },
      });
    }

    return actions;
  };

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        ...supplier,
        label: supplier.name,
      })),
    [suppliers],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f9fc] lg:overflow-hidden">
      <div
        className={`grid min-h-0 flex-1 gap-2 p-2 lg:overflow-hidden ${isEditorRoute ? "lg:grid-cols-1" : "lg:grid-cols-1"}`}
      >
        {!isEditorRoute ? (
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">{config.listTitle}</h1>
              <p className="text-xs text-muted-foreground">
                Review recent {config.pluralLabel}, open existing documents, or start a new one with full-width editing space.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetWorkspace(documents);
                navigate(createRoutePath);
              }}
            >
              {config.createActionLabel}
            </Button>
          </div>

          <div className="space-y-2 pt-2 lg:hidden">
            {documentsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                {documentsError}
              </div>
            ) : null}
            {documentsLoading ? (
              <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {documentRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              documentRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/70 bg-white px-2 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{row.billNumber}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{row.supplierName}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {row.status ?? "DRAFT"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(row.timestamp)}</span>
                    <span>{formatCurrency(row.total)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`${config.routePath}/${row.id}`)}
                    >
                      {row.status === "DRAFT" ? "Open Draft" : "View"}
                    </Button>
                    <IconButton
                      type="button"
                      icon={MoreHorizontal}
                      variant="ghost"
                      className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                      onClick={(event) => {
                        rowMenuButtonRefs.current.set(row.id, event.currentTarget);
                        setOpenRowMenuId(row.id);
                        setRowMenuAnchorRect(event.currentTarget.getBoundingClientRect());
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            {documentsError ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                {documentsError}
              </div>
            ) : null}
            {documentsLoading ? (
              <div className="mt-2 rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {documentRows.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1.2fr) minmax(0,1.7fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,1fr) 3rem")}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Number</TabularCell>
                      <TabularCell variant="header">Supplier</TabularCell>
                      <TabularCell variant="header">Status</TabularCell>
                      <TabularCell variant="header" align="end">Total</TabularCell>
                      <TabularCell variant="header">Updated</TabularCell>
                      <TabularCell variant="header" align="center">Actions</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {documentRows.map((row, index) => (
                      <TabularRow key={row.id} columns={withTabularSerialNumberColumn("minmax(0,1.2fr) minmax(0,1.7fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,1fr) 3rem")} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={row.billNumber} className="font-semibold text-foreground">
                          {row.billNumber}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.supplierName}>{row.supplierName}</TabularCell>
                        <TabularCell>{row.status ?? "DRAFT"}</TabularCell>
                        <TabularCell align="end" className="font-semibold text-foreground">
                          {formatCurrency(row.total)}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={formatDateTime(row.timestamp)}>
                          {formatDateTime(row.timestamp)}
                        </TabularCell>
                        <TabularCell align="center">
                          <div className="relative inline-flex">
                            <IconButton
                              type="button"
                              icon={MoreHorizontal}
                              variant="ghost"
                              className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                              onClick={(event) => {
                                rowMenuButtonRefs.current.set(row.id, event.currentTarget);
                                setOpenRowMenuId(row.id);
                                setRowMenuAnchorRect(event.currentTarget.getBoundingClientRect());
                              }}
                            />
                          </div>
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            )}
          </div>
        </section>
        ) : null}

        {isEditorRoute ? (
        <section className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:overflow-hidden">
          <div className="flex flex-col gap-1.5 border-b border-border/70 pb-1.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {isViewingPostedDocument
                    ? `View ${config.createTitle.replace("Create ", "")}`
                    : activeDraftId
                      ? `Edit ${config.createTitle.replace("Create ", "")}`
                      : config.createTitle}
                </h2>
                {activeDocument?.status && activeDocument.status !== "DRAFT" ? (
                  <span className="hidden rounded-md border border-border/70 bg-slate-50 px-2 py-0.5 text-[10px] text-muted-foreground lg:inline-flex">
                    Status: {activeDocument.status}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {isViewingPostedDocument
                  ? "Posted documents open in read-only mode for review, history, and downstream conversion."
                  : "Pick a supplier, add lines, keep the draft current, then post when the document is ready."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetWorkspace(documents);
                  navigate(config.routePath);
                }}
              >
                Back to Recent
              </Button>
              {!isViewingPostedDocument ? (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={draftMutationLoading} onClick={() => void persistDraft("save")}>
                    {draftMutationLoading ? "Saving..." : `Save Draft (${normalizeLines(lines).length || 1})`}
                  </Button>
                  <Button type="button" size="sm" disabled={draftMutationLoading || Boolean(postValidationMessage)} onClick={() => void persistDraft("post")}>
                    {draftMutationLoading ? "Working..." : config.postActionLabel}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 lg:overflow-hidden">
            <div className="flex min-h-0 flex-col gap-1.5 lg:overflow-hidden">
              <div className="grid gap-2 pt-0.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_12rem] md:items-start">
                <div className="space-y-1 md:w-[13.5rem] md:min-w-[13.5rem]">
                  <Label htmlFor="purchase-bill-number">Document number</Label>
                  <Input
                    id="purchase-bill-number"
                    value={billNumber}
                    onChange={(event) => setBillNumber(event.target.value)}
                    disabled={isViewingPostedDocument}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="purchase-supplier">Supplier</Label>
                  <div className="space-y-1">
                    <LookupDropdownInput
                      id="purchase-supplier"
                      value={supplierName}
                      disabled={isViewingPostedDocument}
                      onValueChange={(value) => {
                        setSupplierId(null);
                        setSupplierName(value);
                      }}
                      options={supplierOptions}
                      loading={lookupLoading}
                      loadingLabel="Loading suppliers"
                      placeholder="Search supplier"
                      onOptionSelect={(supplier) => {
                        setSupplierId(supplier.entityId);
                        setSupplierName(supplier.name);
                        setSupplierPhone(supplier.phone);
                        setSupplierAddress(supplier.address);
                        setSupplierTaxId(supplier.gstNo);
                      }}
                      getOptionKey={(option) => option.entityId}
                      getOptionSearchText={(option) => `${option.name} ${option.phone} ${option.gstNo}`}
                      renderOption={(option) => (
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium text-foreground">{option.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {[option.phone, option.gstNo].filter(Boolean).join(" • ") || "No phone or tax id"}
                          </div>
                        </div>
                      )}
                    />
                    {(supplierPhone || supplierTaxId || supplierAddress) ? (
                      <div className="px-1 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Phone:</span>{" "}
                        {supplierPhone || "Not provided"}{" "}
                        <span className="text-muted-foreground">•</span>{" "}
                        <span className="font-medium text-foreground">Tax:</span>{" "}
                        {supplierTaxId || "Not provided"}{" "}
                        <span className="text-muted-foreground">•</span>{" "}
                        <span className="font-medium text-foreground">Address:</span>{" "}
                        {supplierAddress || "Not provided"}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {usesSettlementMode(config.documentType) ? (
                    <div className="space-y-1">
                      <Label htmlFor="purchase-settlement-mode">Settlement</Label>
                      <Select
                        id="purchase-settlement-mode"
                        value={settlementMode}
                        onChange={(event) => setSettlementMode(event.target.value as "CASH" | "CREDIT")}
                        disabled={isViewingPostedDocument}
                        className="h-8 text-xs"
                      >
                        <option value="CASH">Cash</option>
                        <option value="CREDIT">Credit</option>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>Source</Label>
                      <div className="flex h-8 items-center rounded-md border border-border/80 bg-white px-2 text-xs text-muted-foreground">
                        {parentDocumentNumber || "Standalone"}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Location</Label>
                    <div className="flex h-8 items-center rounded-md border border-border/80 bg-white px-2 text-xs text-muted-foreground">
                      {isStockAffectingDocument(config.documentType)
                        ? activeBusiness?.locations.find((entry) => entry.id === (activeLocationId ?? activeBusiness.defaultLocationId))?.name ??
                          activeBusiness?.locations.find((entry) => entry.isDefault)?.name ??
                          "Default location"
                        : "Business default"}
                    </div>
                  </div>
                </div>
              </div>

              {lookupError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                  {lookupError}
                </div>
              ) : null}
              {formError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex min-h-[18rem] flex-1 flex-col gap-1.5 pt-0.5 md:min-h-0 md:overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Lines`}
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={isViewingPostedDocument} onClick={() => setLines((current) => [...current, createLine()])}>
                    Add Line
                  </Button>
                </div>
                <div className="space-y-2 md:hidden">
                  {lines.map((line, index) => {
                    const lineTotals = getLineTotals(line);
                    return (
                      <div key={line.id} className="rounded-lg border border-border/80 bg-slate-50 p-2">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-semibold text-foreground">Line {index + 1}</div>
                          <Button type="button" variant="ghost" size="sm" className="h-auto p-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isViewingPostedDocument} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`purchase-line-description-${line.id}`}>Item</Label>
                            <LookupDropdownInput
                              id={`purchase-line-description-${line.id}`}
                              value={line.description}
                              disabled={isViewingPostedDocument || Boolean(line.sourceLineId)}
                              onValueChange={(value) =>
                                setLines((current) =>
                                  current.map((entry) => entry.id === line.id ? { ...entry, description: value } : entry),
                                )
                              }
                              options={itemOptions}
                              loading={lookupLoading}
                              loadingLabel="Loading items"
                              placeholder="Search item or service"
                              onOptionSelect={(option) =>
                                setLines((current) =>
                                  current.map((entry) =>
                                    entry.id === line.id
                                      ? {
                                          ...entry,
                                          variantId: option.variantId,
                                          description: option.description,
                                          unitPrice: option.priceAmount !== null ? String(option.priceAmount) : "",
                                          taxRate: `${option.taxRate}%`,
                                          taxMode: option.taxMode,
                                          unit: option.unit,
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              getOptionKey={(option) => option.variantId}
                              getOptionSearchText={(option) =>
                                `${option.label} ${option.sku} ${option.gstLabel}`
                              }
                              renderOption={(option) => (
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
                                    <span className="truncate">{option.description}</span>
                                    <span className="shrink-0">{formatCurrency(option.priceAmount ?? 0)}</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {[option.sku, option.gstLabel].filter(Boolean).join(" • ")}
                                  </div>
                                </div>
                              )}
                            />
                            {line.sourceLineId ? (
                              <div className="text-[11px] text-[#1f4167]">
                                Linked qty remaining: {line.linkedRemainingQuantity ?? line.quantity}
                              </div>
                            ) : null}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Qty</Label>
                              <Input value={line.quantity} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, quantity: event.target.value } : entry))} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label>Rate</Label>
                              <Input value={line.unitPrice} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, unitPrice: event.target.value } : entry))} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Tax</Label>
                              <GstSlabSelect value={normalizeGstSlab(line.taxRate) ?? "0%"} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, taxRate: event.target.value } : entry))} disabled={isViewingPostedDocument} />
                            </div>
                            <div className="space-y-1">
                              <Label>Tax mode</Label>
                              <Select value={line.taxMode} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, taxMode: event.target.value as "EXCLUSIVE" | "INCLUSIVE" } : entry))} className="h-8 text-xs">
                                <option value="EXCLUSIVE">Exclusive</option>
                                <option value="INCLUSIVE">Inclusive</option>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border/80 bg-white px-2 py-1.5 text-xs">
                            <span className="text-muted-foreground">Line total</span>
                            <span className="font-semibold text-foreground">{formatCurrency(lineTotals.total)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
                  <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
                    <TabularHeader>
                      <TabularRow columns={withTabularSerialNumberColumn("minmax(0,2.8fr) minmax(4.25rem,1fr) minmax(4.5rem,1fr) minmax(5rem,1.2fr) minmax(3.75rem,0.8fr) minmax(5rem,1fr) 2.25rem")}>
                        <TabularSerialNumberHeaderCell />
                        <TabularCell variant="header">Item</TabularCell>
                        <TabularCell variant="header">Qty</TabularCell>
                        <TabularCell variant="header">Rate</TabularCell>
                        <TabularCell variant="header">Tax</TabularCell>
                        <TabularCell variant="header">Mode</TabularCell>
                        <TabularCell variant="header" align="end">Amount</TabularCell>
                        <TabularCell variant="header" align="center">Del</TabularCell>
                      </TabularRow>
                    </TabularHeader>
                    <TabularBody className="overflow-y-auto">
                      {lines.map((line, index) => {
                        const totalsForLine = getLineTotals(line);
                        return (
                          <TabularRow key={line.id} columns={withTabularSerialNumberColumn("minmax(0,2.8fr) minmax(4.25rem,1fr) minmax(4.5rem,1fr) minmax(5rem,1.2fr) minmax(3.75rem,0.8fr) minmax(5rem,1fr) 2.25rem")} interactive>
                            <TabularSerialNumberCell index={index} />
                            <TabularCell>
                              <div className="space-y-1">
                                <LookupDropdownInput
                                  value={line.description}
                                  disabled={isViewingPostedDocument || Boolean(line.sourceLineId)}
                                  onValueChange={(value) =>
                                    setLines((current) =>
                                      current.map((entry) => entry.id === line.id ? { ...entry, description: value } : entry),
                                    )
                                  }
                                  options={itemOptions}
                                  loading={lookupLoading}
                                  loadingLabel="Loading items"
                                  placeholder="Search item or service"
                                  onOptionSelect={(option) =>
                                    setLines((current) =>
                                      current.map((entry) =>
                                        entry.id === line.id
                                          ? {
                                              ...entry,
                                              variantId: option.variantId,
                                              description: option.description,
                                              unitPrice: option.priceAmount !== null ? String(option.priceAmount) : "",
                                              taxRate: `${option.taxRate}%`,
                                              taxMode: option.taxMode,
                                              unit: option.unit,
                                            }
                                          : entry,
                                      ),
                                    )
                                  }
                                  getOptionKey={(option) => option.variantId}
                                  getOptionSearchText={(option) =>
                                    `${option.label} ${option.sku} ${option.gstLabel}`
                                  }
                                  renderOption={(option) => (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
                                        <span className="truncate">{option.description}</span>
                                        <span className="shrink-0">{formatCurrency(option.priceAmount ?? 0)}</span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {[option.sku, option.gstLabel].filter(Boolean).join(" • ")}
                                      </div>
                                    </div>
                                  )}
                                  inputClassName={spreadsheetCellControlClassName}
                                />
                                {line.sourceLineId ? (
                                  <div className="text-[10px] text-[#1f4167]">
                                    Linked qty remaining: {line.linkedRemainingQuantity ?? line.quantity}
                                  </div>
                                ) : null}
                              </div>
                            </TabularCell>
                            <TabularCell>
                              <Input className={cn(spreadsheetCellNumericClassName, tabularNumericClassName)} value={line.quantity} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, quantity: event.target.value } : entry))} />
                            </TabularCell>
                            <TabularCell>
                              <Input className={cn(spreadsheetCellNumericClassName, tabularNumericClassName)} value={line.unitPrice} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, unitPrice: event.target.value } : entry))} />
                            </TabularCell>
                            <TabularCell>
                              <GstSlabSelect value={normalizeGstSlab(line.taxRate) ?? "0%"} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, taxRate: event.target.value } : entry))} disabled={isViewingPostedDocument} className={spreadsheetCellSelectClassName} />
                            </TabularCell>
                            <TabularCell>
                              <Select className={spreadsheetCellSelectClassName} value={line.taxMode} disabled={isViewingPostedDocument} onChange={(event) => setLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, taxMode: event.target.value as "EXCLUSIVE" | "INCLUSIVE" } : entry))}>
                                <option value="EXCLUSIVE">Excl</option>
                                <option value="INCLUSIVE">Incl</option>
                              </Select>
                            </TabularCell>
                            <TabularCell align="end" className="font-semibold text-foreground">
                              {formatCurrency(totalsForLine.total)}
                            </TabularCell>
                            <TabularCell align="center">
                              <Button type="button" variant="ghost" size="icon" disabled={isViewingPostedDocument} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))} className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TabularCell>
                          </TabularRow>
                        );
                      })}
                    </TabularBody>
                  </TabularSurface>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-border/85 bg-white p-1.5 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:shrink-0">
                <div className="flex flex-col gap-1 md:min-h-0 md:flex-1">
                  <Label htmlFor="purchase-notes">Notes</Label>
                  <Textarea
                    id="purchase-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={isViewingPostedDocument}
                    rows={2}
                    className="min-h-[2.75rem] max-h-[4.5rem] text-xs"
                  />
                  {postValidationMessage ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                      {postValidationMessage}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-[#d7e2ef] bg-[#f8fbfe] p-3">
                  <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border/70 pb-2 text-[11px]">
                    <span className="shrink-0 font-semibold text-foreground">
                      {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Summary`}
                    </span>
                    <span className="shrink-0 text-muted-foreground">•</span>
                    <span className="truncate text-muted-foreground">{activeBusinessName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold text-foreground">{formatCurrency(totals.subTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-semibold text-foreground">{formatCurrency(totals.taxTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lines</span>
                    <span className="font-semibold text-foreground">{normalizeLines(lines).length || 1}</span>
                  </div>
                  {parentDocumentNumber ? (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">Source</span>
                      <span className="truncate font-semibold text-foreground">{parentDocumentNumber}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between rounded-md border border-border/70 bg-white px-2 py-1.5 text-xs">
                    <span className="font-semibold text-foreground">Grand total</span>
                    <span className="font-semibold text-foreground">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        ) : null}
      </div>

      {openRowMenuId && rowMenuAnchorRect ? (
        <FloatingActionMenu
          anchorRect={rowMenuAnchorRect}
          items={getRowMenuActions(documentRows.find((row) => row.id === openRowMenuId)!)}
          onClose={() => {
            setOpenRowMenuId(null);
            setRowMenuAnchorRect(null);
          }}
        />
      ) : null}

      {cancelDocument ? (
        <ActionReasonDialog
          title={`Cancel ${cancelDocument.billNumber}`}
          description="Cancelling a posted purchase document writes reversal stock rows where applicable."
          reasonLabel="Cancel reason"
          reasons={Object.entries(CANCEL_REASON_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selectedReason={selectedCancelReason}
          confirmLabel="Cancel Document"
          disabled={draftMutationLoading}
          onSelectedReasonChange={(reason) =>
            setSelectedCancelReason(reason as PurchaseDocumentCancelReason)
          }
          onConfirm={() => {
            void transitionDocument(cancelDocument, "CANCEL", selectedCancelReason);
          }}
          onClose={() => setCancelDocument(null)}
        />
      ) : null}

      {historyDocument ? (
        <PurchaseDocumentHistoryDialog
          title={`History: ${historyDocument.billNumber}`}
          description="Review the server-authored timeline for this purchase document."
          entries={historyEntries}
          loading={historyLoading}
          error={historyError}
          onClose={() => {
            setHistoryDocument(null);
            setHistoryEntries([]);
            setHistoryError(null);
          }}
        />
      ) : null}
    </div>
  );
}

const buildPurchaseItemOptions = (
  stockOptions: StockVariantOption[],
  pricingRows: ItemPricingRow[],
  stockLevels: StockLevelRow[],
): PurchaseItemOption[] => {
  const pricingByVariantId = new Map(pricingRows.map((row) => [row.variantId, row] as const));
  const stockByVariantId = new Map(stockLevels.map((row) => [row.variantId, row] as const));

  return stockOptions.map((option) => {
    const pricing = pricingByVariantId.get(option.variantId);
    const stockLevel = stockByVariantId.get(option.variantId);
    const gstLabel = formatGstSlabLabel(pricing?.gstSlab);
    const description =
      pricing?.variantName?.trim()
        ? `${pricing.itemName} · ${pricing.variantName}`
        : pricing?.itemName?.trim() || option.label;

    return {
      ...option,
      description,
      priceAmount: pricing?.amount ?? null,
      currency: pricing?.currency ?? "INR",
      gstLabel,
      taxRate:
        pricing?.gstSlab && normalizeGstSlab(pricing.gstSlab)
          ? Number((normalizeGstSlab(pricing.gstSlab) ?? "0%").replace("%", "")) || 0
          : 0,
      taxMode: pricing?.taxMode ?? "EXCLUSIVE",
      quantityOnHand: stockLevel?.quantityOnHand ?? null,
    };
  });
};

const toConvertedLine = (line: PurchaseConversionBalanceLine) =>
  createLine({
    sourceLineId: line.sourceLineId,
    variantId: line.variantId ?? "",
    description: line.description,
    quantity: line.remainingQuantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    taxMode: line.taxMode,
    unit: line.unit,
    linkedRemainingQuantity: line.remainingQuantity,
  });

export function PurchaseOrdersPage() {
  return <PurchaseDocumentPage config={PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_ORDER} />;
}

export function GoodsReceiptNotesPage() {
  return <PurchaseDocumentPage config={PURCHASE_DOCUMENT_PAGE_CONFIG.GOODS_RECEIPT_NOTE} />;
}

export function PurchaseInvoicesPage() {
  return <PurchaseDocumentPage config={PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_INVOICE} />;
}

export function PurchaseReturnsPage() {
  return <PurchaseDocumentPage config={PURCHASE_DOCUMENT_PAGE_CONFIG.PURCHASE_RETURN} />;
}
