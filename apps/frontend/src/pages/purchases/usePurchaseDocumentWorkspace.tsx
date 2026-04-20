import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, History, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { type DraftReviewAlert } from "../../design-system/organisms/DraftReviewPanel";
import { type FloatingActionMenuItem } from "../../design-system/organisms/FloatingActionMenu";
import {
  DESKTOP_GROW_AS_NEEDED_STARTER_ROWS,
  MOBILE_GROW_AS_NEEDED_STARTER_ROWS,
} from "../../design-system/molecules/useSpreadsheetNavigation";
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
import {
  calculateDocumentLineTotals,
  formatDocumentCurrency,
  formatDocumentDateTime,
  getNextDocumentNumber,
} from "../../lib/document-utils";
import {
  createPurchaseDocumentDraft,
  deletePurchaseDocumentDraft,
  getPurchaseConversionBalance,
  getPurchaseDocumentHistory,
  listLocalPurchaseDocuments,
  listPurchaseDocuments,
  postPurchaseDocumentDraft,
  PurchaseDocumentApiError,
  type PurchaseDocumentPostInput,
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
import { useConnectivity } from "../../hooks/useConnectivity";

export type PurchaseDocumentPageConfig = {
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

export type PurchaseDocumentRouteParams = {
  documentId?: string;
};

export type PurchaseDocumentConversionConfig = {
  targetDocumentType: PurchaseDocumentType;
  targetRoutePath: string;
  actionLabel: string;
};

export type PurchaseLine = PurchaseDocumentLineDraft & {
  linkedRemainingQuantity?: string | null;
};

const MINIMUM_VISIBLE_DOCUMENT_LINES = 5;

export type PurchaseDocumentDuplicateMeta = {
  sourceBillNumber: string;
  sourceDocumentType: PurchaseDocumentType;
  lines: Record<
    string,
    {
      sourceVariantId: string;
      originalUnitPrice: string;
      originalTaxRate: string;
      originalTaxMode: "EXCLUSIVE" | "INCLUSIVE";
      isAvailable: boolean;
    }
  >;
};

export type PurchaseDocumentDuplicateWarnings = {
  unavailableItems: Array<{
    lineId: string;
    description: string;
    isAvailable: boolean;
  }>;
  priceDiscrepancies: Array<{
    lineId: string;
    description: string;
    currentPrice: number;
    draftPrice: number;
  }>;
};

type PurchaseDraftSource = "local" | "server";

type SavedPurchaseDraft = PurchaseDocumentDraft & {
  duplicateMeta?: PurchaseDocumentDuplicateMeta | null;
};

export type PurchaseListRow = PurchaseDocumentDraft & {
  source: PurchaseDraftSource;
  total: number;
  timestamp: string;
};

export type PurchaseItemOption = StockVariantOption & {
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
  parentSupplier?: {
    supplierId?: string | null;
    supplierName?: string;
    supplierPhone?: string;
    supplierAddress?: string;
    supplierTaxId?: string;
  };
  returnTo?: string;
  purchaseDraft?: {
    activeDraftId?: string | null;
    billNumber: string;
    settlementMode: "CASH" | "CREDIT";
    supplierId: string | null;
    supplierName: string;
    supplierPhone: string;
    supplierAddress: string;
    supplierTaxId: string;
    notes: string;
    lines: PurchaseLine[];
    parentId: string | null;
    parentDocumentNumber: string;
    duplicateMeta?: PurchaseDocumentDuplicateMeta | null;
  };
  createdSupplier?: {
    entityId?: string;
    name?: string;
    phone?: string;
    address?: string;
    gstNo?: string;
  };
  supplierMessage?: string;
  supplierPrefill?: {
    name?: string;
  };
};

export const CANCEL_REASON_LABELS: Record<PurchaseDocumentCancelReason, string> = {
  CUSTOMER_DECLINED: "Customer declined",
  INTERNAL_DROP: "Internal drop",
  OTHER: "Other",
};

export const formatCurrency = formatDocumentCurrency;
export const formatDateTime = formatDocumentDateTime;

const DUPLICATE_META_STORAGE_SUFFIX = "duplicate-meta";

const toRounded = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeComparableUnitPrice = (
  amount: number,
  taxMode: "EXCLUSIVE" | "INCLUSIVE",
  taxRate: string,
) => {
  const normalizedTaxRate = Number((normalizeGstSlab(taxRate) ?? "0%").replace("%", "")) || 0;
  if (taxMode !== "INCLUSIVE" || normalizedTaxRate <= 0) {
    return amount;
  }

  return amount / (1 + normalizedTaxRate / 100);
};

const convertUnitPriceForTaxMode = (input: {
  amount: number;
  fromTaxMode: "EXCLUSIVE" | "INCLUSIVE";
  fromTaxRate: string;
  toTaxMode: "EXCLUSIVE" | "INCLUSIVE";
  toTaxRate: string;
}) => {
  const normalizedExclusive = normalizeComparableUnitPrice(
    input.amount,
    input.fromTaxMode,
    input.fromTaxRate,
  );
  const targetTaxRate = Number((normalizeGstSlab(input.toTaxRate) ?? "0%").replace("%", "")) || 0;
  if (input.toTaxMode !== "INCLUSIVE" || targetTaxRate <= 0) {
    return normalizedExclusive;
  }

  return normalizedExclusive * (1 + targetTaxRate / 100);
};

const formatPriceInput = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export const getLineTotals = (line: PurchaseLine) => {
  return calculateDocumentLineTotals(line, { round: true, digits: 2 });
};

export const normalizeLines = (lines: PurchaseLine[]) =>
  lines.filter(
    (line) =>
      line.variantId.trim().length > 0 ||
      line.description.trim().length > 0 ||
      line.unitPrice.trim().length > 0,
  );

export const createPurchaseLine = (seed?: Partial<PurchaseLine>): PurchaseLine => ({
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

const getDefaultStarterLineCount = () => {
  if (typeof window === "undefined") {
    return DESKTOP_GROW_AS_NEEDED_STARTER_ROWS;
  }

  return window.matchMedia("(min-width: 1024px)").matches
    ? DESKTOP_GROW_AS_NEEDED_STARTER_ROWS
    : MOBILE_GROW_AS_NEEDED_STARTER_ROWS;
};

export const buildPurchaseStarterLines = (count = getDefaultStarterLineCount()) =>
  Array.from(
    { length: Math.max(count, MINIMUM_VISIBLE_DOCUMENT_LINES) },
    () => createPurchaseLine(),
  );

const padPurchaseLinesForEditing = (
  lines: PurchaseLine[],
  minimumCount = Math.max(getDefaultStarterLineCount(), MINIMUM_VISIBLE_DOCUMENT_LINES),
) => {
  if (lines.length >= minimumCount) {
    return lines;
  }

  return [
    ...lines,
    ...Array.from({ length: minimumCount - lines.length }, () => createPurchaseLine()),
  ];
};

const getNextBillNumber = (
  prefix: string,
  documents: Array<Pick<PurchaseDocumentDraft, "billNumber">>,
) => getNextDocumentNumber(prefix, documents, 4);

const getDocumentTotal = (document: PurchaseDocumentDraft) =>
  normalizeLines(document.lines as PurchaseLine[]).reduce(
    (sum, line) => sum + getLineTotals(line).total,
    0,
  );

export const usesSettlementMode = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_INVOICE";

export const isStockAffectingDocument = (documentType: PurchaseDocumentType) =>
  documentType !== "PURCHASE_ORDER";

const requiresPostedParent = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_RETURN";

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

export const formatPurchaseDocumentTypeLabel = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_ORDER"
    ? "purchase order"
    : documentType === "GOODS_RECEIPT_NOTE"
      ? "goods receipt"
      : documentType === "PURCHASE_INVOICE"
        ? "purchase invoice"
        : "purchase return";

const formatPurchaseDocumentTypeActionLabel = (documentType: PurchaseDocumentType) =>
  formatPurchaseDocumentTypeLabel(documentType)
    .split(" ")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");

const normalizePurchaseDocumentDuplicateMeta = (
  rawValue: unknown,
): PurchaseDocumentDuplicateMeta | null => {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const value = rawValue as Record<string, unknown>;
  const sourceBillNumber =
    typeof value.sourceBillNumber === "string" ? value.sourceBillNumber.trim() : "";
  const sourceDocumentType =
    value.sourceDocumentType === "PURCHASE_ORDER" ||
    value.sourceDocumentType === "GOODS_RECEIPT_NOTE" ||
    value.sourceDocumentType === "PURCHASE_INVOICE" ||
    value.sourceDocumentType === "PURCHASE_RETURN"
      ? value.sourceDocumentType
      : null;
  const lines =
    value.lines && typeof value.lines === "object"
      ? Object.entries(value.lines as Record<string, unknown>).reduce<
          PurchaseDocumentDuplicateMeta["lines"]
        >((accumulator, [lineId, rawLine]) => {
          const line =
            rawLine && typeof rawLine === "object"
              ? (rawLine as Record<string, unknown>)
              : null;
          if (!line || lineId.trim().length === 0) {
            return accumulator;
          }

          const sourceVariantId =
            typeof line.sourceVariantId === "string"
              ? line.sourceVariantId.trim()
              : "";
          if (!sourceVariantId) {
            return accumulator;
          }

          accumulator[lineId] = {
            sourceVariantId,
            originalUnitPrice:
              typeof line.originalUnitPrice === "string"
                ? line.originalUnitPrice
                : "",
            originalTaxRate:
              typeof line.originalTaxRate === "string"
                ? line.originalTaxRate
                : "0%",
            originalTaxMode: line.originalTaxMode === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
            isAvailable: line.isAvailable !== false,
          };
          return accumulator;
        }, {})
      : {};

  if (!sourceBillNumber || !sourceDocumentType) {
    return null;
  }

  return {
    sourceBillNumber,
    sourceDocumentType,
    lines,
  };
};

const buildPurchaseDocumentDuplicateWarnings = (
  lines: PurchaseLine[],
  itemOptionsByVariantId: Map<string, PurchaseItemOption>,
  duplicateMeta: PurchaseDocumentDuplicateMeta | null,
): PurchaseDocumentDuplicateWarnings => {
  if (!duplicateMeta) {
    return {
      unavailableItems: [],
      priceDiscrepancies: [],
    };
  }

  const unavailableItems: PurchaseDocumentDuplicateWarnings["unavailableItems"] = [];
  const priceDiscrepancies: PurchaseDocumentDuplicateWarnings["priceDiscrepancies"] = [];

  for (const line of lines) {
    const duplicateLineMeta = duplicateMeta.lines[line.id];
    const sourceVariantId = duplicateLineMeta?.sourceVariantId;
    const option = line.variantId ? itemOptionsByVariantId.get(line.variantId) : null;

    if (sourceVariantId && !option) {
      unavailableItems.push({
        lineId: line.id,
        description: line.description || "Unnamed item",
        isAvailable: false,
      });
      continue;
    }

    if (!option || option.priceAmount === null || !duplicateLineMeta) {
      continue;
    }

    const draftPrice = normalizeComparableUnitPrice(
      toNumber(duplicateLineMeta.originalUnitPrice || line.unitPrice),
      duplicateLineMeta.originalTaxMode,
      duplicateLineMeta.originalTaxRate,
    );
    const currentPrice = normalizeComparableUnitPrice(
      option.priceAmount,
      option.taxMode,
      `${option.taxRate}%`,
    );
    if (Math.abs(draftPrice - currentPrice) < 0.01) {
      continue;
    }

    priceDiscrepancies.push({
      lineId: line.id,
      description: line.description || "Unnamed item",
      draftPrice,
      currentPrice,
    });
  }

  return {
    unavailableItems,
    priceDiscrepancies,
  };
};

const sortSuppliers = (rows: SupplierRow[]) =>
  [...rows].sort((left, right) => left.name.localeCompare(right.name));

const applySupplierSnapshot = (
  supplier: SupplierRow,
  setSupplierId: (value: string | null) => void,
  setSupplierName: (value: string) => void,
  setSupplierPhone: (value: string) => void,
  setSupplierAddress: (value: string) => void,
  setSupplierTaxId: (value: string) => void,
) => {
  setSupplierId(supplier.entityId);
  setSupplierName(supplier.name);
  setSupplierPhone(supplier.phone);
  setSupplierAddress(supplier.address);
  setSupplierTaxId(supplier.gstNo);
};

const toConvertedLine = (line: PurchaseConversionBalanceLine) =>
  createPurchaseLine({
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

const loadStoredDrafts = (
  activeStore: string | null,
  documentType: PurchaseDocumentType,
  numberPrefix: string,
) => {
  if (!activeStore || typeof window === "undefined") {
    return [] as SavedPurchaseDraft[];
  }

  try {
    const storedValue = window.localStorage.getItem(
      `mini_erp_${documentType.toLowerCase()}_drafts_v1:${activeStore}`,
    );
    const parsed = storedValue ? (JSON.parse(storedValue) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry, index) => {
      const draft =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const lines = Array.isArray(draft.lines)
        ? draft.lines.map((line) =>
            createPurchaseLine(
              line && typeof line === "object" ? (line as Partial<PurchaseLine>) : undefined,
            ),
          )
        : buildPurchaseStarterLines();

      return {
        id:
          typeof draft.id === "string" && draft.id.trim()
            ? draft.id
            : `draft-${index + 1}`,
        documentType,
        billNumber:
          typeof draft.billNumber === "string" && draft.billNumber.trim()
            ? draft.billNumber
            : getNextDocumentNumber(numberPrefix, [], 4),
        settlementMode: draft.settlementMode === "CREDIT" ? "CREDIT" : "CASH",
        supplierId: typeof draft.supplierId === "string" ? draft.supplierId : null,
        supplierName: typeof draft.supplierName === "string" ? draft.supplierName : "",
        supplierPhone: typeof draft.supplierPhone === "string" ? draft.supplierPhone : "",
        supplierAddress:
          typeof draft.supplierAddress === "string" ? draft.supplierAddress : "",
        supplierTaxId: typeof draft.supplierTaxId === "string" ? draft.supplierTaxId : "",
        notes: typeof draft.notes === "string" ? draft.notes : "",
        parentId: typeof draft.parentId === "string" ? draft.parentId : null,
        parentDocumentNumber:
          typeof draft.parentDocumentNumber === "string" ? draft.parentDocumentNumber : "",
        locationId: typeof draft.locationId === "string" ? draft.locationId : null,
        locationName: typeof draft.locationName === "string" ? draft.locationName : "",
        savedAt:
          typeof draft.savedAt === "string" && draft.savedAt.trim()
            ? draft.savedAt
            : new Date().toISOString(),
        lines,
        duplicateMeta: normalizePurchaseDocumentDuplicateMeta(draft.duplicateMeta),
      } satisfies SavedPurchaseDraft;
    });
  } catch {
    return [] as SavedPurchaseDraft[];
  }
};

export function usePurchaseDocumentWorkspace({
  config,
  activeStore,
  activeLocationId,
  conversions,
}: {
  config: PurchaseDocumentPageConfig;
  activeStore: string | null;
  activeLocationId: string | null;
  conversions: Partial<Record<PurchaseDocumentType, PurchaseDocumentConversionConfig[]>>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { documentId } = useParams<PurchaseDocumentRouteParams>();
  const { showToast } = useToast();
  const handledReturnStateKeyRef = useRef<string | null>(null);
  const storageKey = activeStore
    ? `mini_erp_${config.documentType.toLowerCase()}_drafts_v1:${activeStore}`
    : null;
  const { isOnline, classifyError } = useConnectivity();
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const activeBusinessName = activeBusiness?.name ?? "Active Business";
  const [initialDrafts] = useState<SavedPurchaseDraft[]>(() =>
    loadStoredDrafts(activeStore, config.documentType, config.numberPrefix),
  );
  const [drafts, setDrafts] = useState<SavedPurchaseDraft[]>(initialDrafts);
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
  const [activeDraftSource, setActiveDraftSource] = useState<PurchaseDraftSource | null>(null);
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
  const [lines, setLines] = useState<PurchaseLine[]>(() => buildPurchaseStarterLines());
  const [duplicateMeta, setDuplicateMeta] = useState<PurchaseDocumentDuplicateMeta | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [itemOptions, setItemOptions] = useState<PurchaseItemOption[]>([]);
  const [postValidationMessage, setPostValidationMessage] = useState<string | null>(null);
  const [isListRouteEditorOpen, setIsListRouteEditorOpen] = useState(false);
  const routeState = location.state as PurchaseRouteState | null;
  const createRoutePath = `${config.routePath}/new`;
  const isCreateRoute = location.pathname === createRoutePath;
  const isDocumentRoute = Boolean(documentId);
  const isEditorRoute = isCreateRoute || isDocumentRoute || isListRouteEditorOpen;
  const duplicateMetaStorageKey = activeStore
    ? `${config.documentType}:${DUPLICATE_META_STORAGE_SUFFIX}:${activeStore}`
    : null;

  const loadPersistedDuplicateMetaMap = useCallback(() => {
    if (!duplicateMetaStorageKey || typeof window === "undefined") {
      return {} as Record<string, PurchaseDocumentDuplicateMeta>;
    }

    try {
      const storedValue = window.localStorage.getItem(duplicateMetaStorageKey);
      const parsed = storedValue ? (JSON.parse(storedValue) as unknown) : {};
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return Object.entries(parsed as Record<string, unknown>).reduce<
        Record<string, PurchaseDocumentDuplicateMeta>
      >((accumulator, [draftId, rawMeta]) => {
        const normalizedMeta = normalizePurchaseDocumentDuplicateMeta(rawMeta);
        if (normalizedMeta) {
          accumulator[draftId] = normalizedMeta;
        }
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  }, [duplicateMetaStorageKey]);

  const persistDuplicateMetaMap = useCallback(
    (nextMap: Record<string, PurchaseDocumentDuplicateMeta>) => {
      if (!duplicateMetaStorageKey || typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(duplicateMetaStorageKey, JSON.stringify(nextMap));
    },
    [duplicateMetaStorageKey],
  );

  const setPersistedDuplicateMeta = useCallback(
    (draftId: string, nextMeta: PurchaseDocumentDuplicateMeta | null) => {
      const nextMap = loadPersistedDuplicateMetaMap();
      if (nextMeta) {
        nextMap[draftId] = nextMeta;
      } else {
        delete nextMap[draftId];
      }
      persistDuplicateMetaMap(nextMap);
    },
    [loadPersistedDuplicateMetaMap, persistDuplicateMetaMap],
  );

  const getPersistedDuplicateMeta = useCallback(
    (draftId: string) => loadPersistedDuplicateMetaMap()[draftId] ?? null,
    [loadPersistedDuplicateMetaMap],
  );

  const persistDrafts = useCallback(
    (nextDrafts: SavedPurchaseDraft[]) => {
      setDrafts(nextDrafts);
      if (storageKey && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
      }
    },
    [storageKey],
  );

  const isViewingPostedDocument = useMemo(() => {
    const current = documents.find((entry) => entry.id === viewingDocumentId);
    return activeDraftSource === "server" && Boolean(current && current.status !== "DRAFT");
  }, [activeDraftSource, documents, viewingDocumentId]);

  const activeDocument = useMemo(() => {
    if (activeDraftSource === "local") {
      return drafts.find((entry) => entry.id === activeDraftId) ?? null;
    }
    return documents.find((entry) => entry.id === (viewingDocumentId ?? activeDraftId)) ?? null;
  }, [activeDraftId, activeDraftSource, documents, drafts, viewingDocumentId]);

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
  const itemOptionsByVariantId = useMemo(
    () => new Map(itemOptions.map((option) => [option.variantId, option] as const)),
    [itemOptions],
  );
  const duplicateWarnings = useMemo(
    () => buildPurchaseDocumentDuplicateWarnings(lines, itemOptionsByVariantId, duplicateMeta),
    [duplicateMeta, itemOptionsByVariantId, lines],
  );
  const duplicateWarningAlerts = useMemo<DraftReviewAlert[]>(() => {
    const unavailableAlerts = duplicateWarnings.unavailableItems.map((warning) => ({
      id: `missing:${warning.lineId}`,
      title: `${warning.description} is no longer available`,
      description: "Select a replacement item before saving or posting this duplicate.",
    }));
    const priceAlerts = duplicateWarnings.priceDiscrepancies.map((warning) => ({
      id: `price:${warning.lineId}`,
      title: `${warning.description} price differs from the current purchase price`,
      description: `Draft price ${formatCurrency(warning.draftPrice)}. Current price ${formatCurrency(warning.currentPrice)}.`,
    }));

    return [...unavailableAlerts, ...priceAlerts];
  }, [duplicateWarnings]);

  const documentRows = useMemo<PurchaseListRow[]>(
    () =>
      [
        ...drafts.map((draft) => ({
          ...draft,
          source: "local" as const,
          total: getDocumentTotal(draft),
          timestamp: draft.savedAt ?? "",
        })),
        ...documents.map((document) => ({
          ...document,
          source: "server" as const,
          total: getDocumentTotal(document),
          timestamp: document.savedAt ?? document.postedAt ?? "",
        })),
      ].sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [documents, drafts],
  );

  const resetWorkspace = useCallback(
    (nextDocuments: PurchaseDocumentDraft[]) => {
      setActiveDraftId(null);
      setActiveDraftSource(null);
      setViewingDocumentId(null);
      setParentId(null);
      setParentDocumentNumber("");
      setBillNumber(getNextBillNumber(config.numberPrefix, [...nextDocuments, ...drafts]));
      setSettlementMode(config.defaultSettlementMode ?? "CASH");
      setSupplierId(null);
      setSupplierName("");
      setSupplierPhone("");
      setSupplierAddress("");
      setSupplierTaxId("");
      setNotes("");
      setLines(buildPurchaseStarterLines());
      setDuplicateMeta(null);
      setPostValidationMessage(null);
      setFormError(null);
    },
    [config.defaultSettlementMode, config.numberPrefix, drafts],
  );

  const applyDocumentToWorkspace = useCallback(
    (document: PurchaseDocumentDraft, source: PurchaseDraftSource, readOnly: boolean) => {
      const hydratedLines =
        document.lines.length > 0
          ? document.lines.map((line) =>
              createPurchaseLine({
                ...line,
                linkedRemainingQuantity:
                  "linkedRemainingQuantity" in line &&
                  typeof line.linkedRemainingQuantity === "string"
                    ? line.linkedRemainingQuantity
                    : null,
              }),
            )
          : buildPurchaseStarterLines();

      setActiveDraftId(readOnly ? null : document.id);
      setActiveDraftSource(readOnly ? "server" : source);
      setViewingDocumentId(readOnly ? document.id : source === "server" ? null : null);
      setParentId(document.parentId ?? null);
      setParentDocumentNumber(document.parentDocumentNumber ?? "");
      setBillNumber(document.billNumber);
      setSettlementMode(document.settlementMode ?? config.defaultSettlementMode ?? "CASH");
      setSupplierId(document.supplierId ?? null);
      setSupplierName(document.supplierName);
      setSupplierPhone(document.supplierPhone);
      setSupplierAddress(document.supplierAddress);
      setSupplierTaxId(document.supplierTaxId);
      setNotes(document.notes);
      setDuplicateMeta(
        source === "local"
          ? (document as SavedPurchaseDraft).duplicateMeta ?? getPersistedDuplicateMeta(document.id)
          : getPersistedDuplicateMeta(document.id),
      );
      setLines(padPurchaseLinesForEditing(hydratedLines));
      setFormError(null);
    },
    [config.defaultSettlementMode, getPersistedDuplicateMeta],
  );

  const buildRoutePurchaseDraft = useCallback(
    () => ({
      activeDraftId,
      billNumber,
      settlementMode,
      supplierId,
      supplierName,
      supplierPhone,
      supplierAddress,
      supplierTaxId,
      notes,
      lines,
      parentId,
      parentDocumentNumber,
      duplicateMeta,
    }),
    [
      activeDraftId,
      billNumber,
      duplicateMeta,
      lines,
      notes,
      parentDocumentNumber,
      parentId,
      settlementMode,
      supplierAddress,
      supplierId,
      supplierName,
      supplierPhone,
      supplierTaxId,
    ],
  );

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    setDocumentsLoading(true);
    setDocumentsError(null);
    const fetchDocuments = isOnline
      ? listPurchaseDocuments(activeStore, config.documentType)
      : listLocalPurchaseDocuments(activeStore, config.documentType);

    void fetchDocuments
      .then((nextDocuments) => {
        setDocuments(nextDocuments);
        if (!isEditorRoute && !routeState?.parentDocumentId) {
          setBillNumber(getNextBillNumber(config.numberPrefix, [...nextDocuments, ...drafts]));
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
  }, [
    activeStore,
    config.documentType,
    config.numberPrefix,
    drafts,
    isOnline,
    isEditorRoute,
    routeState?.parentDocumentId,
  ]);

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

    if (!isOnline) {
      showToast({
        title: "Connection required",
        description: `Internet connection required to convert this ${config.singularLabel}.`,
        tone: "error",
      });
      navigate(config.routePath, { replace: true });
      return;
    }

    const sourceDocumentId = routeState.parentDocumentId;
    const sourceDocumentNumber = routeState.parentDocumentNumber ?? "";
    const parentSupplier = routeState.parentSupplier;

    void getPurchaseConversionBalance(sourceDocumentId, activeStore)
      .then((balance) => {
        const convertedLines = balance.lines
          .filter((line) => Number(line.remainingQuantity) > 0)
          .map((line) => toConvertedLine(line));

        setActiveDraftId(null);
        setActiveDraftSource(null);
        setViewingDocumentId(null);
        setParentId(sourceDocumentId);
        setParentDocumentNumber(sourceDocumentNumber);
        setBillNumber(getNextBillNumber(config.numberPrefix, documents));
        setSettlementMode(config.defaultSettlementMode ?? "CASH");
        setSupplierId(
          typeof parentSupplier?.supplierId === "string" ? parentSupplier.supplierId : null,
        );
        setSupplierName(
          typeof parentSupplier?.supplierName === "string" ? parentSupplier.supplierName : "",
        );
        setSupplierPhone(
          typeof parentSupplier?.supplierPhone === "string" ? parentSupplier.supplierPhone : "",
        );
        setSupplierAddress(
          typeof parentSupplier?.supplierAddress === "string"
            ? parentSupplier.supplierAddress
            : "",
        );
        setSupplierTaxId(
          typeof parentSupplier?.supplierTaxId === "string" ? parentSupplier.supplierTaxId : "",
        );
        setNotes("");
        setDuplicateMeta(null);
        setLines(
          convertedLines.length > 0
            ? padPurchaseLinesForEditing(convertedLines)
            : buildPurchaseStarterLines(),
        );
        setPostValidationMessage(null);
        navigate(location.pathname, { replace: true, state: null });
      })
      .catch((error) => {
        showToast({
          title:
            classifyError(error).isConnectivityError
              ? "Internet connection required to prepare this conversion."
              : error instanceof Error
                ? error.message
                : "Unable to prepare conversion.",
          tone: "error",
        });
        navigate(config.routePath, { replace: true });
      });
  }, [
    activeStore,
    classifyError,
    config.defaultSettlementMode,
    config.numberPrefix,
    config.routePath,
    config.singularLabel,
    documents,
    isOnline,
    location.pathname,
    navigate,
    routeState?.parentDocumentId,
    routeState?.parentDocumentNumber,
    routeState?.parentSupplier,
    showToast,
  ]);

  useEffect(() => {
    if (
      !routeState?.purchaseDraft &&
      !routeState?.createdSupplier &&
      !routeState?.supplierMessage
    ) {
      return;
    }

    if (handledReturnStateKeyRef.current === location.key) {
      return;
    }

    handledReturnStateKeyRef.current = location.key;

    if (routeState.purchaseDraft) {
      setIsListRouteEditorOpen(location.pathname === config.routePath);
      const draft = routeState.purchaseDraft;
      setActiveDraftId(draft.activeDraftId ?? null);
      setActiveDraftSource("local");
      setViewingDocumentId(null);
      setParentId(draft.parentId ?? null);
      setParentDocumentNumber(draft.parentDocumentNumber ?? "");
      setBillNumber(draft.billNumber);
      setSettlementMode(draft.settlementMode);
      setSupplierId(draft.supplierId ?? null);
      setSupplierName(draft.supplierName);
      setSupplierPhone(draft.supplierPhone);
      setSupplierAddress(draft.supplierAddress);
      setSupplierTaxId(draft.supplierTaxId);
      setNotes(draft.notes);
      setDuplicateMeta(normalizePurchaseDocumentDuplicateMeta(draft.duplicateMeta));
      setLines(
        draft.lines.length > 0
          ? padPurchaseLinesForEditing(
              draft.lines.map((line) => createPurchaseLine({ ...line })),
            )
          : buildPurchaseStarterLines(),
      );
      setFormError(null);
    }

    if (routeState.createdSupplier) {
      const hydratedSupplier: SupplierRow = {
        entityId:
          typeof routeState.createdSupplier.entityId === "string" &&
          routeState.createdSupplier.entityId.trim()
            ? routeState.createdSupplier.entityId
            : crypto.randomUUID(),
        name: typeof routeState.createdSupplier.name === "string"
          ? routeState.createdSupplier.name
          : "",
        phone: typeof routeState.createdSupplier.phone === "string"
          ? routeState.createdSupplier.phone
          : "",
        email: "",
        address: typeof routeState.createdSupplier.address === "string"
          ? routeState.createdSupplier.address
          : "",
        gstNo: typeof routeState.createdSupplier.gstNo === "string"
          ? routeState.createdSupplier.gstNo
          : "",
        isActive: true,
        deletedAt: null,
        serverVersion: 0,
        pending: true,
      };
      setSuppliers((current) =>
        sortSuppliers([
          ...current.filter((supplier) => supplier.entityId !== hydratedSupplier.entityId),
          hydratedSupplier,
        ]),
      );
      applySupplierSnapshot(
        hydratedSupplier,
        setSupplierId,
        setSupplierName,
        setSupplierPhone,
        setSupplierAddress,
        setSupplierTaxId,
      );
    }

    if (routeState.supplierMessage) {
      showToast({
        title: routeState.supplierMessage,
        tone: "success",
      });
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [
    config.routePath,
    location.key,
    location.pathname,
    navigate,
    routeState?.createdSupplier,
    routeState?.purchaseDraft,
    routeState?.supplierMessage,
    showToast,
  ]);

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

      applyDocumentToWorkspace(
        matchedDocument,
        "server",
        matchedDocument.status !== "DRAFT",
      );
      return;
    }

    if (isCreateRoute && !routeState?.parentDocumentId) {
      if (billNumber.trim().length > 0) {
        return;
      }

      resetWorkspace(documents);
    }
  }, [
    applyDocumentToWorkspace,
    config.singularLabel,
    billNumber,
    documentId,
    documents,
    documentsLoading,
    isCreateRoute,
    resetWorkspace,
    routeState?.parentDocumentId,
  ]);

  useEffect(() => {
    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      setPostValidationMessage(`Add at least one ${config.singularLabel} line before posting.`);
      return;
    }

    for (const [index, line] of normalizedLines.entries()) {
      if (!line.variantId.trim()) {
        setPostValidationMessage(`Line ${index + 1}: Select an item before posting.`);
        return;
      }

      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setPostValidationMessage(`Line ${index + 1}: Quantity must be greater than 0.`);
        return;
      }

      const unitPrice = Number(line.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setPostValidationMessage(`Line ${index + 1}: Rate must be 0 or greater.`);
        return;
      }
    }

    if (duplicateWarnings.unavailableItems.length > 0) {
      setPostValidationMessage(
        "Replace or remove unavailable items before posting this duplicate.",
      );
      return;
    }

    if (usesSettlementMode(config.documentType) && settlementMode === "CREDIT" && !supplierId) {
      setPostValidationMessage(`Credit ${config.pluralLabel} require an existing supplier.`);
      return;
    }

    if (!supplierName.trim()) {
      setPostValidationMessage(
        `${config.createTitle.replace("Create ", "")} requires supplier details.`,
      );
      return;
    }

    if (requiresPostedParent(config.documentType) && !parentId) {
      setPostValidationMessage(
        "Purchase return must be created from a posted goods receipt or invoice.",
      );
      return;
    }

    setPostValidationMessage(null);
  }, [
    config.createTitle,
    config.documentType,
    config.pluralLabel,
    config.singularLabel,
    lines,
    parentId,
    settlementMode,
    supplierId,
    supplierName,
    duplicateWarnings.unavailableItems.length,
  ]);

  const isInlineValidationError = useCallback(
    (message: string) => {
      const normalizedMessage = message.trim().toLowerCase().replace(/\.$/, "");
      const normalizedInlineMessage = postValidationMessage
        ?.trim()
        .toLowerCase()
        .replace(/\.$/, "");

      if (normalizedInlineMessage && normalizedMessage === normalizedInlineMessage) {
        return true;
      }

      if (!supplierName.trim() && normalizedMessage.includes("requires supplier details")) {
        return true;
      }

      if (
        usesSettlementMode(config.documentType) &&
        settlementMode === "CREDIT" &&
        !supplierId &&
        normalizedMessage.includes("require an existing supplier")
      ) {
        return true;
      }

      if (
        requiresPostedParent(config.documentType) &&
        !parentId &&
        normalizedMessage.includes("must be created from")
      ) {
        return true;
      }

      return false;
    },
    [
      config.documentType,
      parentId,
      postValidationMessage,
      settlementMode,
      supplierId,
      supplierName,
    ],
  );

  const hasMeaningfulDraftContent = useCallback(() => {
    return Boolean(
      parentId ||
        supplierId ||
        supplierName.trim() ||
        supplierPhone.trim() ||
        supplierAddress.trim() ||
        supplierTaxId.trim() ||
        notes.trim() ||
        normalizeLines(lines).length > 0,
    );
  }, [
    lines,
    notes,
    parentId,
    supplierAddress,
    supplierId,
    supplierName,
    supplierPhone,
    supplierTaxId,
  ]);

  const duplicateDocument = useCallback(
    (document: PurchaseDocumentDraft) => {
      const duplicateLineMeta: PurchaseDocumentDuplicateMeta["lines"] = {};
      const duplicatedLines =
        document.lines.length > 0
          ? padPurchaseLinesForEditing(
              document.lines.map((line) => {
                const nextLineId = crypto.randomUUID();
                const sourceVariantId = line.variantId?.trim() ?? "";
                const currentOption = sourceVariantId
                  ? itemOptionsByVariantId.get(sourceVariantId)
                  : null;

                if (sourceVariantId) {
                  duplicateLineMeta[nextLineId] = {
                    sourceVariantId,
                    originalUnitPrice: line.unitPrice,
                    originalTaxRate: line.taxRate,
                    originalTaxMode: line.taxMode,
                    isAvailable: Boolean(currentOption),
                  };
                }

                return createPurchaseLine({
                  ...line,
                  id: nextLineId,
                  sourceLineId: null,
                  linkedRemainingQuantity: null,
                  variantId: currentOption ? sourceVariantId : "",
                });
              }),
            )
          : buildPurchaseStarterLines();

      setActiveDraftId(null);
      setActiveDraftSource(null);
      setViewingDocumentId(null);
      setParentId(null);
      setParentDocumentNumber("");
      setBillNumber(getNextBillNumber(config.numberPrefix, [...documents, ...drafts]));
      setSettlementMode(document.settlementMode ?? config.defaultSettlementMode ?? "CASH");
      setSupplierId(document.supplierId ?? null);
      setSupplierName(document.supplierName);
      setSupplierPhone(document.supplierPhone);
      setSupplierAddress(document.supplierAddress);
      setSupplierTaxId(document.supplierTaxId);
      setNotes(document.notes);
      setDuplicateMeta({
        sourceBillNumber: document.billNumber,
        sourceDocumentType: document.documentType,
        lines: duplicateLineMeta,
      });
      setLines(duplicatedLines);
      setPostValidationMessage(null);
      setFormError(null);
      setIsListRouteEditorOpen(false);
      navigate(createRoutePath);
      showToast({
        title: `${formatPurchaseDocumentTypeLabel(document.documentType)} ${document.billNumber} duplicated into draft mode. Original prices were preserved.`,
        tone: "success",
      });
    },
    [
      config.defaultSettlementMode,
      config.numberPrefix,
      createRoutePath,
      documents,
      drafts,
      itemOptionsByVariantId,
      navigate,
      showToast,
    ],
  );

  const refreshDuplicatePricesToCurrent = useCallback(() => {
    setLines((currentLines) =>
      currentLines.map((line) => {
        const matchingWarning = duplicateWarnings.priceDiscrepancies.find(
          (warning) => warning.lineId === line.id,
        );
        const currentOption = line.variantId
          ? itemOptionsByVariantId.get(line.variantId)
          : null;
        if (!matchingWarning || !currentOption || currentOption.priceAmount === null) {
          return line;
        }

        return {
          ...line,
          unitPrice: formatPriceInput(
            convertUnitPriceForTaxMode({
              amount: currentOption.priceAmount,
              fromTaxMode: currentOption.taxMode,
              fromTaxRate: `${currentOption.taxRate}%`,
              toTaxMode: line.taxMode,
              toTaxRate: line.taxRate,
            }),
          ),
        };
      }),
    );
  }, [duplicateWarnings.priceDiscrepancies, itemOptionsByVariantId]);

  const buildNormalizedDraft = useCallback(() => {
    const normalizedPurchaseLines = normalizeLines(lines);
    return {
      id: activeDraftId ?? crypto.randomUUID(),
      documentType: config.documentType,
      parentId,
      parentDocumentNumber,
      locationId: isStockAffectingDocument(config.documentType) ? activeLocationId ?? null : null,
      billNumber: billNumber.trim() || getNextBillNumber(config.numberPrefix, [...documents, ...drafts]),
      settlementMode: usesSettlementMode(config.documentType) ? settlementMode : "CASH",
      supplierId,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone.trim(),
      supplierAddress: supplierAddress.trim(),
      supplierTaxId: supplierTaxId.trim(),
      notes: notes.trim(),
      savedAt: new Date().toISOString(),
      lines: normalizedPurchaseLines,
      duplicateMeta,
    } satisfies SavedPurchaseDraft;
  }, [
    activeDraftId,
    activeLocationId,
    billNumber,
    config.documentType,
    config.numberPrefix,
    documents,
    drafts,
    duplicateMeta,
    lines,
    notes,
    parentDocumentNumber,
    parentId,
    settlementMode,
    supplierAddress,
    supplierId,
    supplierName,
    supplierPhone,
    supplierTaxId,
  ]);

  const persistDraft = async (
    mode: "save" | "post",
    options?: {
      postInput?: PurchaseDocumentPostInput;
      successMessage?: string;
    },
  ) => {
    if (!activeStore) {
      return false;
    }

    if (mode === "save" && !hasMeaningfulDraftContent()) {
      showToast({
        title: `Enter at least one line, supplier detail, note, or source before saving this ${config.singularLabel} draft.`,
        tone: "error",
      });
      return false;
    }

    if (mode === "post" && !isOnline) {
      const message = `Internet connection required to post this ${config.singularLabel}. Your progress is saved as a local draft.`;
      setFormError(message);
      showToast({
        title: "Connection required",
        description: message,
        tone: "error",
      });
      return false;
    }

    setDraftMutationLoading(true);
    setFormError(null);
    try {
      const nextDraft = buildNormalizedDraft();

      if (mode === "save" && !isOnline) {
        const nextDrafts =
          activeDraftSource === "local" && activeDraftId
            ? drafts.map((draft) => (draft.id === activeDraftId ? nextDraft : draft))
            : [nextDraft, ...drafts];
        persistDrafts(nextDrafts);
        setPersistedDuplicateMeta(nextDraft.id, duplicateMeta);
        setActiveDraftId(nextDraft.id);
        setActiveDraftSource("local");
        setViewingDocumentId(null);
        setBillNumber(nextDraft.billNumber);
        setLines(padPurchaseLinesForEditing(nextDraft.lines.map((line) => ({ ...line }))));
        showToast({
          title: `${config.createTitle.replace("Create ", "")} draft saved locally on this device.`,
          tone: "success",
        });
        return true;
      }

      const payload = {
        tenantId: activeStore,
        documentType: config.documentType,
        parentId: nextDraft.parentId,
        locationId: nextDraft.locationId,
        billNumber: nextDraft.billNumber,
        settlementMode: nextDraft.settlementMode,
        supplierId: nextDraft.supplierId,
        supplierName: nextDraft.supplierName,
        supplierPhone: nextDraft.supplierPhone,
        supplierAddress: nextDraft.supplierAddress,
        supplierTaxId: nextDraft.supplierTaxId,
        notes: nextDraft.notes,
        lines: nextDraft.lines,
      };

      const saved =
        activeDraftSource === "server" && activeDraftId
          ? await updatePurchaseDocumentDraft(activeDraftId, payload)
          : await createPurchaseDocumentDraft(payload);

      let nextDocument = saved;
      if (mode === "post") {
        nextDocument = await postPurchaseDocumentDraft(
          saved.id,
          activeStore,
          config.documentType,
          options?.postInput,
        );
      }
      if (mode === "post") {
        setPersistedDuplicateMeta(saved.id, null);
      } else {
        setPersistedDuplicateMeta(saved.id, duplicateMeta);
      }

      if (activeDraftSource === "local" && activeDraftId) {
        persistDrafts(drafts.filter((draft) => draft.id !== activeDraftId));
        setPersistedDuplicateMeta(activeDraftId, null);
      }

      const nextDocuments = await listPurchaseDocuments(activeStore, config.documentType);
      setDocuments(nextDocuments);

      if (mode === "post") {
        showToast({
          title: options?.successMessage ?? `${config.createTitle.replace("Create ", "")} posted.`,
          tone: "success",
        });
        resetWorkspace(nextDocuments);
        setIsListRouteEditorOpen(false);
      } else {
        applyDocumentToWorkspace(nextDocument, "server", false);
      }

      navigate(mode === "post" ? config.routePath : `${config.routePath}/${nextDocument.id}`, {
        replace: true,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof PurchaseDocumentApiError ? error.message : "Unable to save purchase draft.";
      if (isInlineValidationError(message)) {
        setFormError(null);
        return false;
      }
      setFormError(message);
      showToast({
        title: message,
        tone: "error",
      });
      return false;
    } finally {
      setDraftMutationLoading(false);
    }
  };

  const openHistory = async (document: PurchaseDocumentDraft) => {
    if (!activeStore) {
      return;
    }

    if (!isOnline) {
      showToast({
        title: "Connection required",
        description: `Internet connection required to view ${config.singularLabel} history.`,
        tone: "error",
      });
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

    if (!isOnline) {
      const message = `Connection required to update ${config.singularLabel} status.`;
      setFormError(message);
      showToast({
        title: "Connection required",
        description: message,
        tone: "error",
      });
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
        applyDocumentToWorkspace(nextDocument, "server", nextDocument.status !== "DRAFT");
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

  const deleteDraft = async (document: PurchaseListRow) => {
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
      if (document.source === "server") {
        if (!isOnline) {
          const message = `Cannot delete server drafts while offline. Connect to the internet to perform this action.`;
          setFormError(message);
          showToast({
            title: "Action unavailable",
            description: message,
            tone: "error",
          });
          return;
        }

        await deletePurchaseDocumentDraft(document.id, activeStore, config.documentType);
        setPersistedDuplicateMeta(document.id, null);
        const nextDocuments = await listPurchaseDocuments(activeStore, config.documentType);
        setDocuments(nextDocuments);
        if (
          documentId === document.id ||
          activeDraftId === document.id ||
          viewingDocumentId === document.id
        ) {
          resetWorkspace(nextDocuments);
          navigate(config.routePath, { replace: true });
        }
      } else {
        persistDrafts(drafts.filter((draft) => draft.id !== document.id));
        setPersistedDuplicateMeta(document.id, null);
        if (activeDraftId === document.id) {
          resetWorkspace(documents);
          navigate(config.routePath, { replace: true });
        }
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

  const openDocumentRow = useCallback(
    (row: PurchaseListRow) => {
      if (row.source === "local") {
        applyDocumentToWorkspace(row, "local", false);
        setIsListRouteEditorOpen(false);
        navigate(createRoutePath);
        return;
      }

      navigate(`${config.routePath}/${row.id}`);
    },
    [applyDocumentToWorkspace, config.routePath, createRoutePath, navigate],
  );

  const getRowMenuActions = (row: PurchaseListRow): FloatingActionMenuItem[] => {
    const documentLabel = formatPurchaseDocumentTypeActionLabel(row.documentType);
    const actions: FloatingActionMenuItem[] = [
      {
        key: "view",
        label: row.status === "DRAFT" ? `Edit ${documentLabel} Draft` : `View ${documentLabel}`,
        icon: Eye,
        onSelect: () => openDocumentRow(row),
      },
      {
        key: "history",
        label: `View ${documentLabel} History`,
        icon: History,
        disabled: row.source === "local",
        onSelect: () => {
          void openHistory(row);
        },
      },
    ];

    if (row.status === "DRAFT") {
      actions.push({
        key: "duplicate",
        label: `Duplicate ${documentLabel}`,
        icon: Copy,
        onSelect: () => {
          duplicateDocument(row);
        },
      });
      actions.push({
        key: "delete",
        label: `Delete ${documentLabel} Draft`,
        icon: Trash2,
        tone: "danger",
        onSelect: () => {
          void deleteDraft(row);
        },
      });
      return actions;
    }

    actions.push({
      key: "duplicate",
      label: `Duplicate ${documentLabel}`,
      icon: Copy,
      onSelect: () => {
        duplicateDocument(row);
      },
    });

    if (row.status === "OPEN" || row.status === "PARTIAL") {
      for (const conversion of conversions[row.documentType] ?? []) {
        actions.push({
          key: `convert-${conversion.targetDocumentType}`,
          label: isOnline ? conversion.actionLabel : `${conversion.actionLabel} (Online only)`,
          icon: Copy,
          disabled: !isOnline,
          onSelect: () =>
            navigate(`${conversion.targetRoutePath}/new`, {
              state: {
                parentDocumentId: row.id,
                parentDocumentNumber: row.billNumber,
                parentDocumentType: row.documentType,
                parentSupplier: {
                  supplierId: row.supplierId,
                  supplierName: row.supplierName,
                  supplierPhone: row.supplierPhone,
                  supplierAddress: row.supplierAddress,
                  supplierTaxId: row.supplierTaxId,
                },
              } satisfies PurchaseRouteState,
            }),
        });
      }
    }

    if (row.status === "OPEN" || row.status === "PARTIAL") {
      actions.push({
        key: "cancel",
        label: `Cancel ${documentLabel}`,
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
        label: `Reopen ${documentLabel}`,
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

  const openSupplierCreate = () => {
    navigate("/app/suppliers/new", {
      state: {
        returnTo: config.routePath,
        purchaseDraft: buildRoutePurchaseDraft(),
        supplierPrefill: {
          name: supplierName.trim(),
        },
      } satisfies PurchaseRouteState,
    });
  };

  return {
    activeBusiness,
    activeBusinessName,
    activeDocument,
    activeDraftId,
    billNumber,
    cancelDocument,
    createRoutePath,
    documentRows,
    documents,
    documentsError,
    documentsLoading,
    duplicateMeta,
    duplicateWarningAlerts,
    duplicateWarnings,
    draftMutationLoading,
    formError,
    getRowMenuActions,
    historyDocument,
    historyEntries,
    historyError,
    historyLoading,
    isOnline,
    isCreateRoute,
    isDocumentRoute,
    isEditorRoute,
    isListRouteEditorOpen,
    isViewingPostedDocument,
    itemOptions,
    lines,
    lookupError,
    lookupLoading,
    notes,
    openDocumentRow,
    openSupplierCreate,
    openRowMenuId,
    parentDocumentNumber,
    postValidationMessage,
    refreshDuplicatePricesToCurrent,
    resetWorkspace,
    persistDraft,
    rowMenuAnchorRect,
    selectedCancelReason,
    setBillNumber,
    setCancelDocument,
    setHistoryDocument,
    setHistoryEntries,
    setHistoryError,
    setIsListRouteEditorOpen,
    setLines,
    setNotes,
    setOpenRowMenuId,
    setRowMenuAnchorRect,
    setSelectedCancelReason,
    setSettlementMode,
    setSupplierAddress,
    setSupplierId,
    setSupplierName,
    setSupplierPhone,
    setSupplierTaxId,
    settlementMode,
    showToast,
    supplierAddress,
    supplierId,
    supplierName,
    supplierOptions,
    supplierPhone,
    supplierTaxId,
    totals,
    transitionDocument,
    viewingDocumentId,
  };
}
