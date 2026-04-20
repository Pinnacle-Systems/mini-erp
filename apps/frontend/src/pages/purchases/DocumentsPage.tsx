import { useEffect, useRef, useState } from "react";
import { Info, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Textarea } from "../../design-system/atoms/Textarea";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
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
import { ActionReasonDialog } from "../../design-system/organisms/ActionReasonDialog";
import { DocumentHistoryDialog } from "../../design-system/organisms/DocumentHistoryDialog";
import { DraftReviewPanel } from "../../design-system/organisms/DraftReviewPanel";
import { FloatingActionMenu } from "../../design-system/organisms/FloatingActionMenu";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getFinancialDocumentBalance,
  listFinancialAccounts,
  type FinancialAccountRow,
  type FinancialDocumentBalanceRow,
} from "../finance/financial-api";
import { PostCashInvoiceDialog } from "./PostCashInvoiceDialog";
import {
  type PurchaseDocumentCancelReason,
  type PurchaseDocumentType,
} from "./purchase-documents-api";
import { PurchaseDocumentLineEditor } from "./PurchaseDocumentLineEditor";
import {
  buildPurchaseStarterLines,
  CANCEL_REASON_LABELS,
  createPurchaseLine,
  formatCurrency,
  formatDateTime,
  formatPurchaseDocumentTypeLabel,
  isStockAffectingDocument,
  normalizeLines,
  type PurchaseDocumentConversionConfig,
  type PurchaseDocumentPageConfig,
  usePurchaseDocumentWorkspace,
  usesSettlementMode,
} from "./usePurchaseDocumentWorkspace";

const isFinancialPurchaseDocumentType = (
  documentType: PurchaseDocumentType,
): documentType is "PURCHASE_INVOICE" | "PURCHASE_RETURN" =>
  documentType === "PURCHASE_INVOICE" || documentType === "PURCHASE_RETURN";

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
    listTitle: "Goods Receipts",
    createTitle: "Create Goods Receipt",
    singularLabel: "goods receipt",
    pluralLabel: "goods receipts",
    listEmptyMessage: "No recent goods receipts yet. Receive stock here when goods arrive.",
    createActionLabel: "Create Goods Receipt",
    postActionLabel: "Post Goods Receipt",
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
    listEmptyMessage: "No recent purchase returns yet. Create one from a posted goods receipt or invoice.",
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
      actionLabel: "Create Goods Receipt",
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

const getSettlementStatus = (
  row: Pick<FinancialDocumentBalanceRow, "settlementStatus" | "paymentStatus">,
) => row.settlementStatus ?? row.paymentStatus;

const getPurchaseSettlementLabel = (
  row:
    | Pick<
        FinancialDocumentBalanceRow,
        "settlementStatus" | "paymentStatus" | "paidAmount" | "appliedReturnAmount"
      >
    | Pick<
        NonNullable<NonNullable<{ settlement?: FinancialDocumentBalanceRow | null }>["settlement"]>,
        "settlementStatus" | "paymentStatus" | "paidAmount" | "appliedReturnAmount"
      >,
) => {
  const status = getSettlementStatus(row);
  switch (status) {
    case "N_A":
      return "N/A";
    case "UNPAID":
      return "Unpaid";
    case "PARTIAL":
      return "Partial";
    case "PAID":
      if (row.paidAmount <= 0.01 && row.appliedReturnAmount > 0.01) {
        return "Settled by Return";
      }
      if (row.paidAmount > 0.01 && row.appliedReturnAmount > 0.01) {
        return "Settled";
      }
      return "Paid";
    case "OVERPAID":
      return "Supplier Credit";
  }
};

const getSettlementStatusClassName = (value: "N_A" | "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID") => {
  switch (value) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "OVERPAID":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
    case "N_A":
      return "border-border/70 bg-muted/55 text-muted-foreground";
    case "UNPAID":
    default:
      return "border-border/70 bg-muted/55 text-muted-foreground";
  }
};

const getPurchaseSettlementTitle = (
  row:
    | Pick<
        FinancialDocumentBalanceRow,
        "settlementStatus" | "paymentStatus" | "paidAmount" | "appliedReturnAmount" | "grossDocumentAmount"
      >
    | Pick<
        NonNullable<NonNullable<{ settlement?: FinancialDocumentBalanceRow | null }>["settlement"]>,
        "settlementStatus" | "paymentStatus" | "paidAmount" | "appliedReturnAmount" | "grossDocumentAmount"
      >,
) => {
  const status = getSettlementStatus(row);
  if (status === "OVERPAID") {
    return "Total payments and returns exceed the original invoice amount.";
  }
  if (status === "PAID" && row.paidAmount <= 0.01 && row.appliedReturnAmount > 0.01) {
    return "The invoice balance was fully settled by linked purchase returns without a cash payment.";
  }
  if (status === "PAID" && row.paidAmount > 0.01 && row.appliedReturnAmount > 0.01) {
    return "Payments and linked purchase returns together fully settled the invoice.";
  }
  return undefined;
};

const toPositivePurchaseQuantity = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const formatPurchaseQuantity = (value: number) => {
  const normalized = Math.max(0, value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : String(Number(normalized.toFixed(3)));
};

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);

const getPreferredFinancialAccountId = (accounts: FinancialAccountRow[]) =>
  accounts.find((account) => account.accountType === "CASH")?.id ??
  accounts.find((account) => account.accountType === "BANK")?.id ??
  accounts.find((account) => account.accountType === "UPI")?.id ??
  accounts[0]?.id ??
  "";

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
  const navigate = useNavigate();
  const rowMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const {
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
    isEditorRoute,
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
    supplierAddress,
    supplierId,
    supplierName,
    supplierOptions,
    supplierPhone,
    supplierTaxId,
    totals,
    transitionDocument,
  } = usePurchaseDocumentWorkspace({
    config,
    activeStore,
    activeLocationId,
    conversions: PURCHASE_DOCUMENT_CONVERSIONS,
  });
  const showSourceColumn = config.documentType !== "PURCHASE_ORDER";
  const showPaymentColumn = config.documentType === "PURCHASE_INVOICE";
  const supplierLookupHighlightClassName =
    !isViewingPostedDocument &&
    ((usesSettlementMode(config.documentType) &&
      settlementMode === "CREDIT" &&
      !supplierId) ||
      !supplierName.trim())
      ? "border-warning/45 bg-warning/10 focus:border-warning/60 focus:ring-warning/20"
      : undefined;
  const [financialBalance, setFinancialBalance] = useState<FinancialDocumentBalanceRow | null>(null);
  const viewedFinancialDocumentId = activeDocument?.id ?? null;
  const [prevViewedId, setPrevViewedId] = useState(viewedFinancialDocumentId);
  if (viewedFinancialDocumentId !== prevViewedId) {
    setPrevViewedId(viewedFinancialDocumentId);
    setFinancialBalance(null);
  }

  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountRow[]>([]);
  const [cashPostDialogOpen, setCashPostDialogOpen] = useState(false);
  const [cashPostError, setCashPostError] = useState<string | null>(null);
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState("");

  const [prevAccounts, setPrevAccounts] = useState(financialAccounts);
  if (financialAccounts !== prevAccounts) {
    setPrevAccounts(financialAccounts);
    if (financialAccounts.length === 0) {
      if (selectedFinancialAccountId !== "") {
        setSelectedFinancialAccountId("");
      }
    } else {
      const nextAccountId = financialAccounts.some((account) => account.id === selectedFinancialAccountId)
        ? selectedFinancialAccountId
        : getPreferredFinancialAccountId(financialAccounts);
      if (nextAccountId !== selectedFinancialAccountId) {
        setSelectedFinancialAccountId(nextAccountId);
      }
    }
  }

  const [paymentReferenceDraft, setPaymentReferenceDraft] = useState("");
  const [paymentDateDraft, setPaymentDateDraft] = useState(getTodayDateInputValue());
  const [paymentDateTouched, setPaymentDateTouched] = useState(false);
  const financialPurchaseDocumentType = isFinancialPurchaseDocumentType(config.documentType)
    ? config.documentType
    : null;
  const canRecordSettlement =
    isViewingPostedDocument &&
    config.documentType === "PURCHASE_INVOICE" &&
    Boolean(viewedFinancialDocumentId) &&
    !["CANCELLED", "VOID"].includes(activeDocument?.status ?? "") &&
    Boolean(financialBalance && financialBalance.outstandingAmount > 0.01);
  const isCashPurchaseInvoiceDraft =
    config.documentType === "PURCHASE_INVOICE" &&
    !isViewingPostedDocument &&
    settlementMode === "CASH";
  const cashPostingAccount = financialAccounts.find(
    (account) => account.id === selectedFinancialAccountId,
  );
  const paidAtPosting =
    Boolean(financialBalance?.lastPaymentAt) &&
    Boolean(financialBalance?.postedAt) &&
    financialBalance?.lastPaymentAt === financialBalance?.postedAt;
  const shouldShowCashSettlementRow = Boolean(
    financialBalance && financialBalance.paidAmount > 0.01,
  );
  const shouldShowPurchaseSettlementSummary =
    config.documentType === "PURCHASE_INVOICE" && Boolean(financialBalance);
  const settlementSummaryDate =
    shouldShowCashSettlementRow
      ? financialBalance?.fullySettledAt ?? financialBalance?.lastPaymentAt ?? null
      : null;
  const settlementSummaryDateLabel = settlementSummaryDate
    ? paidAtPosting
      ? "Paid"
      : financialBalance?.fullySettledAt
        ? "Settled"
        : "Last pay"
    : null;
  const settlementExplanation = financialBalance
    ? financialBalance.netOutstandingAmount < 0
      ? "Payments and returns exceed the invoice total. A supplier credit or refund is due."
      : financialBalance.paidAmount <= 0.01 && financialBalance.appliedReturnAmount > 0.01
        ? "This invoice is settled by linked purchase returns. No cash payment has been recorded."
        : financialBalance.paidAmount > 0.01 && financialBalance.appliedReturnAmount > 0.01
          ? "This invoice is settled by a combination of cash payments and linked purchase returns."
          : null
    : null;

  useEffect(() => {
    if (
      !activeStore ||
      !viewedFinancialDocumentId ||
      !isViewingPostedDocument ||
      !financialPurchaseDocumentType ||
      !isOnline
    ) {
      return;
    }

    let cancelled = false;
    void getFinancialDocumentBalance(
      activeStore,
      financialPurchaseDocumentType,
      viewedFinancialDocumentId,
    )
      .then((balance) => {
        if (!cancelled) {
          setFinancialBalance(balance);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setFinancialBalance(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStore,
    financialPurchaseDocumentType,
    isOnline,
    isViewingPostedDocument,
    viewedFinancialDocumentId,
  ]);

  useEffect(() => {
    if (!activeStore || config.documentType !== "PURCHASE_INVOICE") {
      return;
    }

    let cancelled = false;
    void listFinancialAccounts(activeStore)
      .then((accounts) => {
        if (cancelled) {
          return;
        }
        setFinancialAccounts(accounts.filter((account) => account.isActive));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setFinancialAccounts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, config.documentType]);



  const openCashPostDialog = () => {
    setCashPostError(null);
    setPaymentReferenceDraft("");
    setPaymentDateDraft(getTodayDateInputValue());
    setPaymentDateTouched(false);
    setSelectedFinancialAccountId(
      financialAccounts.some((account) => account.id === selectedFinancialAccountId)
        ? selectedFinancialAccountId
        : getPreferredFinancialAccountId(financialAccounts),
    );
    setCashPostDialogOpen(true);
  };

  const handlePostClick = async () => {
    if (!isCashPurchaseInvoiceDraft) {
      await persistDraft("post");
      return;
    }

    openCashPostDialog();
  };

  const handleConfirmCashPost = async () => {
    if (!selectedFinancialAccountId) {
      setCashPostError("Select the account used for payment before posting this cash invoice.");
      return;
    }

    if (paymentDateTouched && !paymentDateDraft) {
      setCashPostError("Select a valid payment date before confirming this cash invoice.");
      return;
    }

    const paymentDate = paymentDateTouched
      ? new Date(`${paymentDateDraft}T00:00:00.000Z`).toISOString()
      : undefined;

    const didPost = await persistDraft("post", {
      postInput: {
        financialAccountId: selectedFinancialAccountId,
        paymentReference: paymentReferenceDraft.trim() || undefined,
        paymentDate,
      },
      successMessage: `Purchase invoice posted and payment of ${formatCurrency(totals.grandTotal)} recorded from ${cashPostingAccount?.name ?? "the selected account"}.`,
    });
    if (didPost) {
      setCashPostDialogOpen(false);
    } else {
      setCashPostError("Unable to post and pay this purchase invoice. Review the details and try again.");
    }
  };

  const getParentDocumentNumber = (row: (typeof documentRows)[number]) => {
    if (!row.parentId) {
      return "None";
    }

    return (
      row.parentDocumentNumber ??
      documentRows.find((candidate) => candidate.id === row.parentId)?.billNumber ??
      "Unknown"
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background lg:overflow-hidden">
      <div
        className={`grid min-h-0 flex-1 gap-2 lg:overflow-hidden ${isEditorRoute ? "lg:grid-cols-1" : "lg:grid-cols-1"}`}
      >
        {!isEditorRoute ? (
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-border/85 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:overflow-hidden">
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
                setIsListRouteEditorOpen(false);
                navigate(createRoutePath);
              }}
            >
              {config.createActionLabel}
            </Button>
          </div>

          <div className="space-y-2 pt-2 lg:hidden">
            {documentsError ? (
              <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
                {documentsError}
              </div>
            ) : null}
            {documentsLoading ? (
              <div className="rounded-md border border-border/70 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {documentRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              documentRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/70 bg-card px-2 py-2 text-xs">
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
                  {showPaymentColumn && row.settlement ? (
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getSettlementStatusClassName(getSettlementStatus(row.settlement))}`}
                        title={getPurchaseSettlementTitle(row.settlement)}
                      >
                        {getPurchaseSettlementLabel(row.settlement)}
                      </span>
                    </div>
                  ) : null}
                  {showSourceColumn ? (
                    <div className="mt-2 truncate text-[10px] text-muted-foreground">
                      {`Source: ${getParentDocumentNumber(row)}`}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDocumentRow(row)}
                    >
                      {row.status === "DRAFT" ? "Open Draft" : "View"}
                    </Button>
                    <IconButton
                      type="button"
                      icon={MoreHorizontal}
                      variant="ghost"
                      className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-primary hover:bg-muted/70"
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
              <div className="mt-2 rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
                {documentsError}
              </div>
            ) : null}
            {documentsLoading ? (
              <div className="mt-2 rounded-md border border-border/70 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
                {`Loading ${config.pluralLabel}...`}
              </div>
            ) : null}
            {documentRows.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-border/80 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
                {config.listEmptyMessage}
              </div>
            ) : (
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn(showSourceColumn ? (showPaymentColumn ? "minmax(0,1fr) minmax(0,1.45fr) minmax(0,0.9fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem" : "minmax(0,1.1fr) minmax(0,1.55fr) minmax(0,0.95fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem") : (showPaymentColumn ? "minmax(0,1.1fr) minmax(0,1.55fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem" : "minmax(0,1.2fr) minmax(0,1.75fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,0.9fr) 4.5rem"))}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Number</TabularCell>
                      <TabularCell variant="header">Supplier</TabularCell>
                      {showSourceColumn ? (
                        <TabularCell variant="header">Source</TabularCell>
                      ) : null}
                      <TabularCell variant="header">Status</TabularCell>
                      {showPaymentColumn ? (
                        <TabularCell variant="header">Settlement</TabularCell>
                      ) : null}
                      <TabularCell variant="header" align="end">Total</TabularCell>
                      <TabularCell variant="header">Updated</TabularCell>
                      <TabularCell variant="header" align="center">Actions</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {documentRows.map((row, index) => (
                      <TabularRow key={row.id} columns={withTabularSerialNumberColumn(showSourceColumn ? (showPaymentColumn ? "minmax(0,1fr) minmax(0,1.45fr) minmax(0,0.9fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem" : "minmax(0,1.1fr) minmax(0,1.55fr) minmax(0,0.95fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem") : (showPaymentColumn ? "minmax(0,1.1fr) minmax(0,1.55fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.9fr) 4.5rem" : "minmax(0,1.2fr) minmax(0,1.75fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,0.9fr) 4.5rem"))} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={row.billNumber} className="font-semibold text-foreground">
                          {row.billNumber}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.supplierName}>{row.supplierName}</TabularCell>
                        {showSourceColumn ? (
                          <TabularCell truncate hoverTitle={getParentDocumentNumber(row)}>
                            {getParentDocumentNumber(row)}
                          </TabularCell>
                        ) : null}
                        <TabularCell>{row.status ?? "DRAFT"}</TabularCell>
                        {showPaymentColumn ? (
                          <TabularCell>
                            {row.settlement ? (
                              <span
                                className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getSettlementStatusClassName(getSettlementStatus(row.settlement))}`}
                                title={getPurchaseSettlementTitle(row.settlement)}
                              >
                                {getPurchaseSettlementLabel(row.settlement)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">N/A</span>
                            )}
                          </TabularCell>
                        ) : null}
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
                              className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-primary hover:bg-muted/70"
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
        <section className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:overflow-hidden">
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
                  <span className="hidden rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary lg:inline-flex">
                    Status: {activeDocument.status}
                  </span>
                ) : null}
                {financialBalance ? (
                  <span className={`hidden rounded-md border px-2 py-0.5 text-[10px] font-medium lg:inline-flex ${getSettlementStatusClassName(getSettlementStatus(financialBalance))}`}>
                    Settlement: {getPurchaseSettlementLabel(financialBalance)}
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
                  setIsListRouteEditorOpen(false);
                  navigate(config.routePath);
                }}
              >
                Back to Recent
              </Button>
              {canRecordSettlement ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    navigate(`/app/payments-made?documentId=${encodeURIComponent(viewedFinancialDocumentId!)}`)
                  }
                >
                  Record Payment
                </Button>
              ) : null}
              {!isViewingPostedDocument ? (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={draftMutationLoading} onClick={() => void persistDraft("save")}>
                    {draftMutationLoading ? "Saving..." : `Save Draft (${normalizeLines(lines).length || 1})`}
                  </Button>
                  <Button type="button" size="sm" disabled={draftMutationLoading || Boolean(postValidationMessage)} onClick={() => void handlePostClick()}>
                    {draftMutationLoading ? "Working..." : config.postActionLabel}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {duplicateMeta ? (
            <div className="pt-2">
              <DraftReviewPanel
                title={`Duplicate of ${formatPurchaseDocumentTypeLabel(duplicateMeta.sourceDocumentType)} ${duplicateMeta.sourceBillNumber}`}
                description="Original supplier pricing was preserved in this draft. Review any unavailable items or changed prices before saving or posting."
                alerts={duplicateWarningAlerts}
                actionLabel={
                  duplicateWarnings.priceDiscrepancies.length > 0
                    ? "Update to Current Prices"
                    : undefined
                }
                actionDisabled={duplicateWarnings.priceDiscrepancies.length === 0}
                onAction={
                  duplicateWarnings.priceDiscrepancies.length > 0
                    ? refreshDuplicatePricesToCurrent
                    : undefined
                }
              />
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-0.5 lg:overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 lg:overflow-hidden">
              <div className="flex flex-col gap-2 pt-0.5 md:flex-row md:items-start md:gap-2">
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
                <div className="space-y-1 md:min-w-0 md:flex-1">
                  <Label htmlFor="purchase-supplier">Supplier *</Label>
                  <div className="space-y-1">
                    <div className="flex flex-col gap-1 md:flex-row md:items-start md:gap-2">
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
                      inputClassName={supplierLookupHighlightClassName}
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
                      {!isViewingPostedDocument ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-fit border-input bg-card px-2 text-[11px] font-semibold text-primary shadow-none hover:bg-muted/65 md:mt-[1px] md:shrink-0"
                          onClick={openSupplierCreate}
                        >
                          Create supplier
                        </Button>
                      ) : null}
                    </div>
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
                {usesSettlementMode(config.documentType) ? (
                  <div className="space-y-1 md:w-[10rem] md:min-w-[10rem]">
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
                ) : null}
                {parentDocumentNumber ? (
                  <div className="space-y-1 md:w-[14rem] md:min-w-[14rem]">
                    <Label>Source</Label>
                    <div className="flex h-8 items-center rounded-md border border-border/80 bg-muted/45 px-2 text-xs text-muted-foreground">
                      {parentDocumentNumber}
                    </div>
                  </div>
                ) : null}
                {isStockAffectingDocument(config.documentType) ? (
                  <div className="space-y-1 md:w-[12rem] md:min-w-[12rem]">
                    <Label>Location</Label>
                    <div className="flex h-8 items-center px-1 text-xs text-muted-foreground">
                      {activeBusiness?.locations.find(
                        (entry) =>
                          entry.id === (activeLocationId ?? activeBusiness.defaultLocationId),
                      )?.name ??
                        activeBusiness?.locations.find((entry) => entry.isDefault)?.name ??
                        "Default location"}
                    </div>
                  </div>
                ) : null}
              </div>

              {lookupError ? (
                <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
                  {lookupError}
                </div>
              ) : null}
              {formError ? (
                <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
                  {formError}
                </div>
              ) : null}

              <PurchaseDocumentLineEditor
                config={config}
                lines={lines}
                linesCount={normalizeLines(lines).length || 1}
                itemOptions={itemOptions}
                lookupLoading={lookupLoading}
                isViewingPostedDocument={isViewingPostedDocument}
                onAppendLine={() => setLines((current) => [...current, createPurchaseLine()])}
                onApplyLineItem={(lineId, option) =>
                  setLines((current) => {
                    const currentLine = current.find((entry) => entry.id === lineId);
                    if (!currentLine) {
                      return current;
                    }

                    const existingLine = current.find(
                      (entry) =>
                        entry.variantId === option.variantId &&
                        entry.id !== lineId &&
                        !entry.sourceLineId &&
                        !currentLine.sourceLineId,
                    );

                    if (existingLine) {
                      const incrementBy = toPositivePurchaseQuantity(currentLine.quantity);
                      return current.map((entry) => {
                        if (entry.id === existingLine.id) {
                          return {
                            ...entry,
                            quantity: formatPurchaseQuantity(
                              toPositivePurchaseQuantity(entry.quantity) + incrementBy,
                            ),
                          };
                        }

                        if (entry.id === lineId) {
                          return createPurchaseLine({ id: lineId });
                        }

                        return entry;
                      });
                    }

                    return current.map((entry) =>
                      entry.id === lineId
                        ? {
                            ...entry,
                            variantId: option.variantId,
                            description: option.description,
                            unitPrice:
                              option.priceAmount !== null ? String(option.priceAmount) : "",
                            taxRate: `${option.taxRate}%`,
                            taxMode: option.taxMode,
                            unit: option.unit,
                          }
                        : entry,
                    );
                  })
                }
                onUpdateLine={(lineId, field, value) =>
                  setLines((current) =>
                    current.map((entry) =>
                      entry.id === lineId ? { ...entry, [field]: value } : entry,
                    ),
                  )
                }
                onRemoveLine={(lineId) =>
                  setLines((current) => {
                    if (current.length === 1) {
                      return buildPurchaseStarterLines();
                    }
                    return current.filter((entry) => entry.id !== lineId);
                  })
                }
              />

              <div className="flex flex-col gap-2 rounded-xl border border-border/85 bg-card p-1.5 md:flex-row md:items-start md:shrink-0">
                <div className="flex flex-col gap-1 md:min-h-0 md:flex-1">
                  <Label htmlFor="purchase-notes">Notes</Label>
                  <Textarea
                    id="purchase-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={isViewingPostedDocument}
                    rows={2}
                    placeholder="Optional internal note"
                    className="min-h-[2.75rem] max-h-[4.5rem] w-full resize-none overflow-y-auto rounded-lg border border-input bg-muted/55 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20 md:min-h-[3rem] md:px-2.5 md:py-1.5 md:text-[11px]"
                  />
                  <div className="min-h-[1.75rem]">
                    {postValidationMessage ? (
                      <div className="rounded-md border border-warning/35 bg-warning/12 px-2 py-1 text-[11px] text-warning">
                        {postValidationMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="w-full border-t border-border/70 pt-2 md:w-[280px] md:border-l md:border-t-0 md:pl-4 md:pt-0">
                  <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border/70 pb-2 text-[11px]">
                    <span className="shrink-0 font-semibold text-foreground">
                      {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Summary`}
                    </span>
                    <span className="shrink-0 text-muted-foreground">•</span>
                    <span className="truncate text-muted-foreground">{activeBusinessName}</span>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="space-y-1.5 px-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] leading-tight">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold text-foreground">{formatCurrency(totals.subTotal)}</span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] leading-tight">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-semibold text-foreground">{formatCurrency(totals.taxTotal)}</span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-muted/55 py-1.5 text-xs">
                        <span className="font-semibold text-foreground">Grand total</span>
                        <span className="text-[15px] font-extrabold text-foreground">{formatCurrency(totals.grandTotal)}</span>
                      </div>
                    </div>
                    {shouldShowPurchaseSettlementSummary ? <div className="border-t border-border/70" /> : null}
                    {shouldShowPurchaseSettlementSummary && financialBalance
                      ? (() => {
                          const settlement = financialBalance;
                          return (
                            <div className="space-y-1 rounded-lg border border-border/70 bg-muted/50 py-1.5">
                              <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                                Settlement
                              </div>
                              {shouldShowCashSettlementRow ? (
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 text-xs">
                                  <div className="mb-1.5 min-w-0">
                                    <div className="text-muted-foreground">
                                      {config.documentType === "PURCHASE_INVOICE"
                                        ? "Cash paid"
                                        : "Received back"}
                                    </div>
                                    {settlementSummaryDate && settlementSummaryDateLabel ? (
                                      <div className="text-[10px] leading-snug text-muted-foreground/75">
                                        {settlementSummaryDateLabel}:{" "}
                                        {new Date(settlementSummaryDate).toLocaleDateString()}
                                      </div>
                                    ) : null}
                                  </div>
                                  <span className="font-semibold text-foreground">
                                    {formatCurrency(settlement.paidAmount)}
                                  </span>
                                </div>
                              ) : null}
                              {settlement.appliedReturnAmount > 0 ? (
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 text-xs">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Returns applied</span>
                                    {settlementExplanation && settlement.netOutstandingAmount >= 0 ? (
                                      <span
                                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground/80"
                                        title={settlementExplanation}
                                        aria-label="Settlement explanation"
                                      >
                                        <Info className="h-2 w-2" aria-hidden="true" />
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="font-semibold text-foreground">
                                    {formatCurrency(settlement.appliedReturnAmount)}
                                  </span>
                                </div>
                              ) : null}
                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={
                                      settlement.netOutstandingAmount < 0
                                        ? "font-semibold text-fuchsia-700"
                                        : "font-semibold text-foreground"
                                    }
                                  >
                                    {settlement.netOutstandingAmount < 0
                                      ? "Supplier credit"
                                      : "Outstanding"}
                                  </span>
                                  {settlement.netOutstandingAmount < 0 ? (
                                    <span
                                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-fuchsia-200/80 bg-fuchsia-50/80 text-fuchsia-700/85"
                                      title={settlementExplanation ?? undefined}
                                      aria-label="Supplier credit explanation"
                                    >
                                      <Info className="h-2 w-2" aria-hidden="true" />
                                    </span>
                                  ) : null}
                                </div>
                                <span
                                  className={
                                    settlement.netOutstandingAmount < 0
                                      ? "font-semibold text-fuchsia-700"
                                      : "font-semibold text-foreground"
                                  }
                                >
                                  {formatCurrency(Math.abs(settlement.netOutstandingAmount))}
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      : null}
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
        <DocumentHistoryDialog
          title={`${config.createTitle.replace("Create ", "")} History`}
          description={`Lifecycle and conversion events for ${historyDocument.billNumber}.`}
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

      <PostCashInvoiceDialog
        open={cashPostDialogOpen}
        totalLabel={formatCurrency(totals.grandTotal)}
        documentLabel={billNumber.trim() || "this purchase invoice"}
        accountOptions={financialAccounts}
        selectedAccountId={selectedFinancialAccountId}
        paymentReference={paymentReferenceDraft}
        paymentDate={paymentDateDraft}
        loading={draftMutationLoading}
        error={cashPostError}
        onSelectedAccountIdChange={(value) => {
          setCashPostError(null);
          setSelectedFinancialAccountId(value);
        }}
        onPaymentReferenceChange={(value) => {
          setCashPostError(null);
          setPaymentReferenceDraft(value);
        }}
        onPaymentDateChange={(value) => {
          setCashPostError(null);
          setPaymentDateDraft(value);
          setPaymentDateTouched(true);
        }}
        onClose={() => {
          if (draftMutationLoading) {
            return;
          }
          setCashPostDialogOpen(false);
          setCashPostError(null);
        }}
        onConfirm={() => void handleConfirmCashPost()}
      />
    </div>
  );
}

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
