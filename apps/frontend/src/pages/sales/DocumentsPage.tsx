import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Switch } from "../../design-system/atoms/Switch";
import { Textarea } from "../../design-system/atoms/Textarea";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import {
  DraftReviewPanel,
} from "../../design-system/organisms/DraftReviewPanel";
import {
  FloatingActionMenu,
} from "../../design-system/organisms/FloatingActionMenu";
import { useSessionStore } from "../../features/auth/session-business";
import { useToast } from "../../features/toast/useToast";
import { useEffect, useState } from "react";
import {
  type SalesDocumentType,
} from "./sales-documents-api";
import { SalesDocumentListView } from "./SalesDocumentListView";
import { SalesDocumentLineEditor } from "./SalesDocumentLineEditor";
import { PosQuickAddBar } from "./PosQuickAddBar";
import { PosPaymentModal } from "./PosPaymentModal";
import {
  PrintableReceipt,
  type PrintableReceiptData,
} from "./PrintableReceipt";
import { SalesDocumentSummaryPanel } from "./SalesDocumentSummaryPanel";
import { SalesDocumentWorkspaceHeader } from "./SalesDocumentWorkspaceHeader";
import { usePosHotkeys } from "./usePosHotkeys";
import {
  formatCurrency,
  formatSalesDocumentTypeLabel,
  getLineTotals,
  normalizeLines,
  type SalesDocumentPageConfig,
  usesTransactionType,
  useSalesDocumentWorkspace,
} from "./useSalesDocumentWorkspace";

type SalesDocumentConversionConfig = {
  targetDocumentType: SalesDocumentType;
  targetRoutePath: string;
  actionLabel: string;
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
    defaultTransactionType: "CREDIT",
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

const SALES_POS_PAGE_CONFIG: SalesDocumentPageConfig = {
  documentType: "SALES_INVOICE",
  routePath: "/app/sales-pos",
  listTitle: "Recent POS Sales",
  createTitle: "Create POS Sale",
  singularLabel: "POS sale",
  pluralLabel: "POS sales",
  listEmptyMessage:
    "No recent POS sales yet. Start a sale to create the first invoice.",
  createActionLabel: "Start Sale",
  postActionLabel: "Post Sale",
  routeAppDraftLabel: "POS sale",
  numberPrefix: "INV-",
  storageKeyPrefix: "mini_erp_sales_pos_drafts_v1",
  workspaceVariant: "pos",
  defaultTransactionType: "CASH",
  openEditorByDefault: true,
};

const SALES_DOCUMENT_CONVERSION_CONFIG: Partial<
  Record<SalesDocumentType, SalesDocumentConversionConfig[]>
> = {
  SALES_ESTIMATE: [
    {
      targetDocumentType: "SALES_ORDER",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_ORDER.routePath,
      actionLabel: "Convert to Order",
    },
    {
      targetDocumentType: "SALES_INVOICE",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE.routePath,
      actionLabel: "Convert to Invoice",
    },
  ],
  SALES_ORDER: [
    {
      targetDocumentType: "DELIVERY_CHALLAN",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.DELIVERY_CHALLAN.routePath,
      actionLabel: "Create Challan",
    },
    {
      targetDocumentType: "SALES_INVOICE",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE.routePath,
      actionLabel: "Convert to Invoice",
    },
  ],
  DELIVERY_CHALLAN: [
    {
      targetDocumentType: "SALES_INVOICE",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE.routePath,
      actionLabel: "Create Invoice",
    },
    {
      targetDocumentType: "SALES_RETURN",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_RETURN.routePath,
      actionLabel: "Create Return",
    },
  ],
  SALES_INVOICE: [
    {
      targetDocumentType: "SALES_RETURN",
      targetRoutePath: SALES_DOCUMENT_PAGE_CONFIG.SALES_RETURN.routePath,
      actionLabel: "Create Return",
    },
  ],
};

export function BillsPage() {
  return (
    <SalesDocumentPage config={SALES_DOCUMENT_PAGE_CONFIG.SALES_INVOICE} />
  );
}
export function PosPage() {
  return <SalesDocumentPage config={SALES_POS_PAGE_CONFIG} />;
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
  const activeLocationId = useSessionStore((state) => state.activeLocationId);
  return (
    <SalesDocumentWorkspace
      key={`${config.documentType}:${activeStore ?? "no-store"}:${activeLocationId ?? "default-location"}`}
      activeStore={activeStore}
      activeLocationId={activeLocationId}
      config={config}
    />
  );
}

function SalesDocumentWorkspace({
  activeStore,
  activeLocationId,
  config,
}: {
  activeStore: string | null;
  activeLocationId: string | null;
  config: SalesDocumentPageConfig;
}) {
  const { showToast } = useToast();
  const {
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
    invoiceRows,
    isOnline,
    isPosMode,
    isViewingPostedDocument,
    itemOptions,
    lines,
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
    parentDocumentNumber,
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
  } = useSalesDocumentWorkspace({
    activeStore,
    activeLocationId,
    config,
    conversionConfig: SALES_DOCUMENT_CONVERSION_CONFIG,
  });
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [posQuickAddFocusSignal, setPosQuickAddFocusSignal] = useState(0);
  const [isPosPaymentOpen, setIsPosPaymentOpen] = useState(false);
  const [posPaymentError, setPosPaymentError] = useState<string | null>(null);
  const [isPosNotesOpen, setIsPosNotesOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PrintableReceiptData | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("pos_autoprint") === "true";
  });
  const effectiveActiveLineId =
    activeLineId && lines.some((line) => line.id === activeLineId)
      ? activeLineId
      : lines[0]?.id ?? null;
  const validLineCount = normalizeLines(lines).length;

  const buildPosCheckoutNotes = (amountTendered: number) => {
    const paymentSnapshot = `[POS Checkout] Cash Tendered: ${formatCurrency(
      amountTendered,
    )} | Change: ${formatCurrency(Math.max(0, amountTendered - totals.grandTotal))}`;
    return notes.trim() ? `${notes.trim()}\n${paymentSnapshot}` : paymentSnapshot;
  };

  const focusPosQuickAdd = () => {
    setPosQuickAddFocusSignal((current) => current + 1);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("pos_autoprint", String(autoPrintEnabled));
  }, [autoPrintEnabled]);

  const handleAppendLine = () => {
    const nextLineId = appendLine();
    if (isPosMode && nextLineId) {
      setActiveLineId(nextLineId);
    }
  };

  const handleQuickAddLineItem = (option: (typeof itemOptions)[number]) => {
    const targetLineId = quickAddLineItem(option);
    if (isPosMode && targetLineId) {
      setActiveLineId(targetLineId);
    }
  };

  const handleSaveDraft = () => {
    void saveDraft();
  };

  const handlePostDraft = () => {
    if (isPosMode) {
      if (validLineCount === 0) {
        return;
      }
      setPosPaymentError(null);
      setIsPosPaymentOpen(true);
      return;
    }
    void postDraft();
  };

  const handleOpenPosPayment = () => {
    if (!isPosMode || validLineCount === 0) {
      return;
    }

    setPosPaymentError(null);
    setIsPosPaymentOpen(true);
  };

  const handleClosePosPayment = () => {
    setIsPosPaymentOpen(false);
    setPosPaymentError(null);
    focusPosQuickAdd();
  };

  const handleCompletePosPayment = async (amountTendered: number) => {
    const result = await postDraft({
      notesOverride: buildPosCheckoutNotes(amountTendered),
    });

    if (result.ok) {
      const locationName =
        result.receipt.locationId && activeBusiness?.locations
          ? (activeBusiness.locations.find(
              (location) => location.id === result.receipt.locationId,
            )?.name ?? null)
          : null;
      const changeDue = Math.max(0, amountTendered - result.receipt.grandTotal);
      setLastReceipt({
        businessName: activeBusinessName,
        billNumber: result.receipt.billNumber,
        postedAt: result.receipt.postedAt,
        customerName: result.receipt.customerName,
        locationName,
        lines: result.receipt.lines.map((line) => ({
          id: line.id,
          description: line.description || "Untitled item",
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: getLineTotals(line).total,
        })),
        subTotal: result.receipt.subTotal,
        taxTotal: result.receipt.taxTotal,
        grandTotal: result.receipt.grandTotal,
        amountTendered,
        changeDue,
      });
      setIsPosPaymentOpen(false);
      setPosPaymentError(null);
      focusPosQuickAdd();
      showToast({
        title: `Sale completed: ${result.receipt.billNumber}`,
        description: `Change due ${formatCurrency(changeDue)}.`,
        durationMs: 3000,
        dedupeKey: `sales-pos-success:${result.receipt.billNumber}`,
      });
      if (autoPrintEnabled) {
        window.setTimeout(() => {
          window.print();
        }, 100);
      }
      return;
    }

    setPosPaymentError(result.errorMessage);
  };

  const handleRemoveActivePosLine = () => {
    if (!isPosMode || isViewingPostedDocument || !effectiveActiveLineId) {
      return;
    }

    const currentIndex = lines.findIndex((line) => line.id === effectiveActiveLineId);
    const fallbackLineId =
      lines[currentIndex + 1]?.id ??
      lines[currentIndex - 1]?.id ??
      null;
    removeLine(effectiveActiveLineId);
    setActiveLineId(fallbackLineId);
  };

  const handleClearPosSearch = () => {
    if (!isPosMode) {
      return;
    }

    if (isPosPaymentOpen) {
      handleClosePosPayment();
      return;
    }

    setQuickAddItemQuery("");
    focusPosQuickAdd();
  };

  usePosHotkeys({
    enabled: isPosMode && viewMode === "editor" && !isViewingPostedDocument,
    onSaveDraft: handleSaveDraft,
    onOpenPayment: handleOpenPosPayment,
    onClearSearch: handleClearPosSearch,
    onRemoveActiveLine: handleRemoveActivePosLine,
  });

  if (viewMode === "list") {
    return (
      <>
        <SalesDocumentListView
          config={config}
          saveMessage={saveMessage}
          serverInvoicesError={serverInvoicesError}
          serverInvoicesLoading={serverInvoicesLoading}
          invoiceRows={invoiceRows}
          activeDraftId={activeDraftId}
          openRowMenuId={openRowMenuId}
          onOpenNewDraft={openNewDraft}
          onToggleRowMenu={toggleRowMenu}
          getRowMenuActions={getRowMenuActions}
        />
        {openRowMenuId && openRowMenuAnchorRect && openRowMenuItems.length > 0 ? (
          <FloatingActionMenu
            anchorRect={openRowMenuAnchorRect}
            items={openRowMenuItems}
            onClose={() => {
              setOpenRowMenuId(null);
              setOpenRowMenuAnchorRect(null);
            }}
          />
        ) : null}
        {pendingActionDialogs}
      </>
    );
  }

  const posLineHeader =
    isPosMode ? (
      <PosQuickAddBar
        value={quickAddItemQuery}
        disabled={isViewingPostedDocument}
        lookupLoading={lookupLoading}
        itemOptions={itemOptions}
        focusSignal={posQuickAddFocusSignal}
        actionSlot={
          !isViewingPostedDocument ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAppendLine}
            >
              Add Line
            </Button>
          ) : null
        }
        onValueChange={setQuickAddItemQuery}
        onAddItem={handleQuickAddLineItem}
      />
    ) : null;

  const customerLookupHighlightClassName =
    !isViewingPostedDocument &&
    usesTransactionType(config.documentType) &&
    transactionType === "CREDIT" &&
    !activeCustomer
      ? "border-warning/45 bg-warning/10 focus:border-warning/60 focus:ring-warning/20"
      : undefined;

  const transactionField = usesTransactionType(config.documentType) ? (
    <div className={isPosMode ? "space-y-0.5" : "space-y-1"}>
      <Label htmlFor="sales-bill-transaction-switch">Transaction</Label>
      <div className="flex h-8 w-max items-center gap-2 rounded-lg border border-input bg-card px-3 text-xs text-foreground lg:h-7 lg:text-[11px]">
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
          className="h-6 w-11 border border-border/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
          checkedTrackClassName="border-primary/60 bg-primary/80"
          uncheckedTrackClassName="border-border/80 bg-muted"
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
  ) : null;

  const billNumberField = (
    <div className={`${isPosMode ? "space-y-0.5 md:w-36" : "space-y-1 md:w-48"}`}>
      <Label htmlFor="sales-bill-number">
        {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number`}
      </Label>
      <Input
        id="sales-bill-number"
        value={billNumber}
        readOnly={isViewingPostedDocument || isPosMode}
        disabled={isViewingPostedDocument || isPosMode}
        onChange={(event) => {
          setBillNumber(event.target.value);
          setNumberConflict(null);
        }}
      />
      {isPosMode ? (
        <div className="text-[10px] text-muted-foreground">
          Auto-assigned
        </div>
      ) : null}
      {numberConflict ? (
        <div className="rounded-md border border-warning/35 bg-warning/12 px-2 py-1.5 text-[11px] text-warning">
          {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} number`}{" "}
          <span className="font-semibold">{numberConflict.requested}</span> is already
          used. Suggested:{" "}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-[11px] font-semibold text-primary underline underline-offset-2 hover:bg-transparent"
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
  );

  const customerField = (
    <div
      className={`space-y-1 ${
        isPosMode ? "min-w-0" : "md:w-[28rem] md:max-w-[28rem]"
      }`}
    >
      <Label htmlFor="sales-bill-customer">
        {usesTransactionType(config.documentType) ? "Customer" : "Customer *"}
      </Label>
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:gap-2">
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
          inputClassName={customerLookupHighlightClassName}
          onOptionSelect={applyCustomer}
          getOptionKey={(customer) => customer.entityId}
          getOptionSearchText={(customer) =>
            `${customer.name} ${customer.phone} ${customer.email} ${customer.gstNo}`
          }
          renderOption={(customer) => (
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">{customer.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {[customer.phone, customer.gstNo].filter(Boolean).join("  |  ") ||
                  "No phone or GST"}
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
            onClick={openCustomerCreate}
          >
            Create customer
          </Button>
        ) : null}
      </div>
      {!isViewingPostedDocument &&
      usesTransactionType(config.documentType) &&
      transactionType === "CASH" &&
      !activeCustomer ? (
        <>
          {canQuickCreateFromPhone ? (
            <div className="flex flex-wrap items-center gap-3 text-[10px] leading-tight">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 py-0 text-[11px] font-semibold text-primary hover:bg-transparent"
                onClick={() => {
                  void quickCreateCustomerFromPhone();
                }}
                disabled={customerActionLoading}
              >
                {customerActionLoading ? "Creating..." : "Quick create from phone"}
              </Button>
            </div>
          ) : null}
        </>
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
          {activeCustomer?.address || customerAddress || "No billing address"}
        </div>
      ) : null}
    </div>
  );

  const posDesktopWorkspaceHeader =
    isPosMode && !isViewingPostedDocument ? (
      <div className="hidden gap-2 border-b border-border/70 pb-2 lg:flex lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">New Sale</h1>
            <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              #{billNumber}
            </span>
          </div>
          <div className="flex h-7 shrink-0 items-center gap-2 rounded-lg border border-input bg-card px-2 text-[11px] text-foreground">
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
              id="sales-bill-transaction-switch-desktop-pos"
              checked={transactionType === "CREDIT"}
              disabled={isViewingPostedDocument}
              onCheckedChange={(checked) =>
                setTransactionType(checked ? "CREDIT" : "CASH")
              }
              aria-label="Toggle cash or credit transaction"
              className="h-6 w-11 border border-border/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
              checkedTrackClassName="border-primary/60 bg-primary/80"
              uncheckedTrackClassName="border-border/80 bg-muted"
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
          <div className="min-w-0 flex-[1.35]">
            <LookupDropdownInput
              id="sales-bill-customer-desktop-pos"
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
              placeholder="Search or create customer"
              inputClassName={customerLookupHighlightClassName}
              onOptionSelect={applyCustomer}
              getOptionKey={(customer) => customer.entityId}
              getOptionSearchText={(customer) =>
                `${customer.name} ${customer.phone} ${customer.email} ${customer.gstNo}`
              }
              renderOption={(customer) => (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">{customer.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {[customer.phone, customer.gstNo].filter(Boolean).join("  |  ") ||
                      "No phone or GST"}
                  </div>
                </div>
              )}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-input bg-card px-2 text-[11px] font-semibold text-primary shadow-none hover:bg-muted/65"
              onClick={openCustomerCreate}
            >
              Create customer
            </Button>
            {transactionType === "CASH" && !activeCustomer && canQuickCreateFromPhone ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-0 text-[11px] font-semibold text-primary hover:bg-transparent"
                onClick={() => {
                  void quickCreateCustomerFromPhone();
                }}
                disabled={customerActionLoading}
              >
                {customerActionLoading ? "Creating..." : "Quick create"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setViewMode("list")}
          >
            Recent Sales
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={draftMutationLoading}
          >
            <span>
              {draftMutationLoading ? "Saving..." : `Save Draft (${validLineCount || 1})`}
            </span>
            {!draftMutationLoading ? (
              <span className="ml-2 rounded border border-border/80 bg-muted/60 px-1 py-0 text-[10px] font-medium text-muted-foreground">
                Ctrl+S
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
        {posDesktopWorkspaceHeader}
        {isPosMode && !isViewingPostedDocument ? (
          <div className="lg:hidden">
            <SalesDocumentWorkspaceHeader
              config={config}
              isViewingPostedDocument={isViewingPostedDocument}
              activeDraftId={activeDraftId}
              isPosMode={isPosMode}
              documentStatus={activeServerDocument?.status}
              isOnline={isOnline}
              draftMutationLoading={draftMutationLoading}
              linesCount={normalizeLines(lines).length}
              postValidationMessage={postValidationMessage}
              postActionLabel={isPosMode && !postValidationMessage ? "Pay Now" : undefined}
              saveShortcutHint={isPosMode ? "Ctrl+S" : undefined}
              postShortcutHint={isPosMode ? "Ctrl+Enter" : undefined}
              showNewSaleAction={isPosMode && isViewingPostedDocument}
              newSaleActionLabel="Start New Sale"
              onOpenList={() => setViewMode("list")}
              onOpenNewSale={isPosMode ? openNewDraft : undefined}
              onSaveDraft={handleSaveDraft}
              onPostDraft={handlePostDraft}
            />
          </div>
        ) : (
          <SalesDocumentWorkspaceHeader
            config={config}
            isViewingPostedDocument={isViewingPostedDocument}
            activeDraftId={activeDraftId}
            isPosMode={isPosMode}
            documentStatus={activeServerDocument?.status}
            isOnline={isOnline}
            draftMutationLoading={draftMutationLoading}
            linesCount={normalizeLines(lines).length}
            postValidationMessage={postValidationMessage}
            postActionLabel={isPosMode && !postValidationMessage ? "Pay Now" : undefined}
            saveShortcutHint={isPosMode ? "Ctrl+S" : undefined}
            postShortcutHint={isPosMode ? "Ctrl+Enter" : undefined}
            showNewSaleAction={isPosMode && isViewingPostedDocument}
            newSaleActionLabel="Start New Sale"
            onOpenList={() => setViewMode("list")}
            onOpenNewSale={isPosMode ? openNewDraft : undefined}
            onSaveDraft={handleSaveDraft}
            onPostDraft={handlePostDraft}
          />
        )}

        {duplicateMeta ? (
          <div className="pt-2">
            <DraftReviewPanel
              title={`Duplicate of ${formatSalesDocumentTypeLabel(duplicateMeta.sourceDocumentType)} ${duplicateMeta.sourceBillNumber}`}
              description="Original line pricing was preserved in this draft. Review any unavailable items or stale prices before posting."
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

        {isPosMode ? (
          <div className="grid gap-3 pb-2 pt-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch lg:gap-2 lg:pb-0">
            <div className="flex min-h-0 flex-col gap-3 lg:h-full">
              <div className="grid gap-1.5 rounded-xl border border-border/70 bg-muted/55 px-2 py-1.5 lg:hidden lg:grid-cols-[auto_auto] lg:items-start">
                {transactionField}
                {billNumberField}
              </div>
              {lookupError ? (
                <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-1.5 text-[11px] text-destructive">
                  {lookupError}
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/80 bg-card p-2 shadow-sm lg:h-full lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                <SalesDocumentLineEditor
                  config={config}
                  lines={lines}
                  itemOptions={itemOptions}
                  lookupLoading={lookupLoading}
                  isViewingPostedDocument={isViewingPostedDocument}
                  isPosMode={isPosMode}
                  shouldShowOriginBadges={shouldShowOriginBadges}
                  activeLineId={effectiveActiveLineId}
                  lineHeaderSlot={posLineHeader}
                  onActiveLineChange={setActiveLineId}
                  onAppendLine={handleAppendLine}
                  onApplyLineItem={applyLineItem}
                  onUpdateLine={updateLine}
                  onRemoveLine={(lineId) => {
                    const currentIndex = lines.findIndex((line) => line.id === lineId);
                    const fallbackLineId =
                      lines[currentIndex + 1]?.id ??
                      lines[currentIndex - 1]?.id ??
                      null;
                    removeLine(lineId);
                    if (lineId === effectiveActiveLineId) {
                      setActiveLineId(fallbackLineId);
                    }
                  }}
                  getLinkedLineCap={getLinkedLineCap}
                  getLineOriginTitle={getLineOriginTitle}
                  getOriginBadgeClassName={getOriginBadgeClassName}
                  getSameItemMixedOriginHint={getSameItemMixedOriginHint}
                />
              </div>
            </div>

            <div className="lg:flex lg:min-h-0 lg:h-full lg:flex-col lg:border-l lg:border-border/60 lg:pl-1">
              <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-2 shadow-sm lg:min-h-0 lg:h-full lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                <SalesDocumentSummaryPanel
                  config={config}
                  activeBusinessName={activeBusinessName}
                  totals={totals}
                  linesCountSource={lines}
                  sourceDocumentNumber={parentDocumentNumber}
                  validUntil={validUntil}
                  dispatchDate={dispatchDate}
                  dispatchReference={dispatchReference}
                  dispatchCarrier={dispatchCarrier}
                  isPosMode={isPosMode}
                  isPosting={draftMutationLoading}
                  canCheckout={validLineCount > 0}
                  onOpenPosPayment={isPosMode ? handleOpenPosPayment : undefined}
                  desktopRailInset={false}
                  className="border-t-0 pt-0 md:w-full md:border-l-0 md:pl-0"
                />
                <div className="flex flex-col gap-1">
                  {isPosMode && !isViewingPostedDocument ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-fit rounded-md border border-transparent px-2 text-[11px] font-medium text-primary hover:border-border/70 hover:bg-muted/55"
                      onClick={() => setIsPosNotesOpen((current) => !current)}
                    >
                      {isPosNotesOpen || notes.trim()
                        ? "Hide internal note"
                        : "+ Add internal note"}
                    </Button>
                  ) : null}
                  {!isPosMode || isViewingPostedDocument || isPosNotesOpen || notes.trim() ? (
                    <Textarea
                      id="sales-bill-notes"
                      value={notes}
                      readOnly={isViewingPostedDocument}
                      disabled={isViewingPostedDocument}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional internal note"
                      rows={2}
                      className="w-full resize-none overflow-y-auto"
                    />
                  ) : null}
                </div>
                <div className="min-h-[1.75rem]">
                  {!isViewingPostedDocument && numberConflict ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warning/35 bg-warning/12 px-2 py-1 text-[11px] text-warning">
                      <span>
                        Requested number{" "}
                        <span className="font-semibold">{numberConflict.requested}</span>{" "}
                        is unavailable.
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 text-[11px] font-semibold text-primary hover:bg-transparent"
                        onClick={() => {
                          void applySuggestedInvoiceNumber();
                        }}
                        disabled={draftMutationLoading}
                      >
                        Use {numberConflict.suggested}
                      </Button>
                    </div>
                  ) : !isViewingPostedDocument && postValidationMessage ? (
                    <div className="rounded-md border border-warning/35 bg-warning/12 px-2 py-1 text-[11px] text-warning">
                      {postValidationMessage}
                    </div>
                  ) : saveMessage ? (
                    <div className="rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[11px] text-muted-foreground">
                      {saveMessage}
                    </div>
                  ) : null}
                </div>
                <div className="lg:hidden">{customerField}</div>
                {!isPosMode ? (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="sales-bill-notes">Notes</Label>
                    {!isViewingPostedDocument || notes.trim() ? (
                      <Textarea
                        id="sales-bill-notes"
                        value={notes}
                        readOnly={isViewingPostedDocument}
                        disabled={isViewingPostedDocument}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional internal note"
                        rows={2}
                        className="w-full resize-none overflow-y-auto rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 py-2 text-xs text-[#15314e] placeholder:text-[#6d829b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#5d95d6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/20 md:px-2.5 md:py-1.5 md:text-[11px]"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
        <>
        <div className="flex flex-col gap-2 pb-1 pt-0.5 md:flex-row md:items-start md:gap-2">
          {transactionField}
          {billNumberField}
          {customerField}
          {parentDocumentNumber ? (
            <div className="space-y-1 md:w-[14rem] md:min-w-[14rem]">
              <Label>Source</Label>
              <div className="flex h-8 items-center rounded-md border border-border/80 bg-card px-2 text-xs text-muted-foreground">
                {parentDocumentNumber}
              </div>
            </div>
          ) : null}
          {config.documentType === "DELIVERY_CHALLAN" ||
          config.documentType === "SALES_RETURN" ? (
            <div className="space-y-1 md:w-[17rem] md:min-w-[17rem]">
              <Label htmlFor={`${config.documentType}-location`}>Location</Label>
              <Select
                id={`${config.documentType}-location`}
                value={documentLocationId ?? ""}
                disabled={isViewingPostedDocument}
                onChange={(event) =>
                  setDocumentLocationId(event.target.value || null)
                }
              >
                <option value="">Select location</option>
                {(activeBusiness?.locations ?? []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </Select>
              <div className="text-[11px] leading-tight text-muted-foreground md:text-[10px]">
                {config.documentType === "SALES_RETURN"
                  ? "Stock is restored or reversed at this return location."
                  : "Stock is deducted from this dispatch location."}
              </div>
            </div>
          ) : null}
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
              <div className="text-[11px] leading-tight text-muted-foreground md:text-[10px]">
                Choose the last date this estimate should remain valid.
              </div>
            </div>
          ) : null}
        </div>

        {lookupError ? (
          <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-1.5 text-[11px] text-destructive">
            {lookupError}
          </div>
        ) : null}

        {config.documentType === "DELIVERY_CHALLAN" ? (
          <div className="grid gap-2 rounded-xl border border-border/80 bg-muted/55 p-2 md:grid-cols-3">
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

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 pt-1 md:overflow-hidden">
          <SalesDocumentLineEditor
            config={config}
            lines={lines}
            itemOptions={itemOptions}
            lookupLoading={lookupLoading}
            isViewingPostedDocument={isViewingPostedDocument}
            isPosMode={isPosMode}
            shouldShowOriginBadges={shouldShowOriginBadges}
            activeLineId={effectiveActiveLineId}
            lineHeaderSlot={posLineHeader}
            onActiveLineChange={setActiveLineId}
            onAppendLine={handleAppendLine}
            onApplyLineItem={applyLineItem}
            onUpdateLine={updateLine}
            onRemoveLine={(lineId) => {
              const currentIndex = lines.findIndex((line) => line.id === lineId);
              const fallbackLineId =
                lines[currentIndex + 1]?.id ??
                lines[currentIndex - 1]?.id ??
                null;
              removeLine(lineId);
              if (lineId === effectiveActiveLineId) {
                setActiveLineId(fallbackLineId);
              }
            }}
            getLinkedLineCap={getLinkedLineCap}
            getLineOriginTitle={getLineOriginTitle}
            getOriginBadgeClassName={getOriginBadgeClassName}
            getSameItemMixedOriginHint={getSameItemMixedOriginHint}
          />

          <div className="flex flex-col gap-2 rounded-xl border border-border/85 bg-card p-1.5 md:flex-row md:items-start md:shrink-0">
            <div className="flex flex-col gap-1 md:min-h-0 md:flex-1">
              {isPosMode && !isViewingPostedDocument ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-fit px-0 py-0 text-[11px] font-medium text-primary hover:bg-transparent"
                  onClick={() => setIsPosNotesOpen((current) => !current)}
                >
                  {isPosNotesOpen || notes.trim()
                    ? "Hide note"
                    : "Add note (optional)"}
                </Button>
              ) : (
                <Label htmlFor="sales-bill-notes">Notes</Label>
              )}
              {!isPosMode || isViewingPostedDocument || isPosNotesOpen || notes.trim() ? (
                <Textarea
                  id="sales-bill-notes"
                  value={notes}
                  readOnly={isViewingPostedDocument}
                  disabled={isViewingPostedDocument}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional internal note"
                  rows={isPosMode ? 2 : 2}
                  className="min-h-[2.75rem] max-h-[4.5rem] w-full resize-none overflow-y-auto md:min-h-[3rem]"
                />
              ) : null}
              <div className="min-h-[1.75rem]">
                {!isViewingPostedDocument && numberConflict ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warning/35 bg-warning/12 px-2 py-1 text-[11px] text-warning">
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
            <SalesDocumentSummaryPanel
              config={config}
              activeBusinessName={activeBusinessName}
              totals={totals}
              linesCountSource={lines}
              sourceDocumentNumber={parentDocumentNumber}
              validUntil={validUntil}
              dispatchDate={dispatchDate}
              dispatchReference={dispatchReference}
              dispatchCarrier={dispatchCarrier}
              isPosMode={isPosMode}
              isPosting={draftMutationLoading}
              canCheckout={validLineCount > 0}
              onOpenPosPayment={isPosMode ? handleOpenPosPayment : undefined}
            />
          </div>
        </div>
        </>
        )}
      </div>
      {openRowMenuId && openRowMenuAnchorRect && openRowMenuItems.length > 0 ? (
        <FloatingActionMenu
          anchorRect={openRowMenuAnchorRect}
          items={openRowMenuItems}
          onClose={() => {
            setOpenRowMenuId(null);
            setOpenRowMenuAnchorRect(null);
          }}
        />
      ) : null}
      {pendingActionDialogs}
      <PrintableReceipt receipt={lastReceipt} />
      {isPosMode && isPosPaymentOpen ? (
        <PosPaymentModal
          total={totals.grandTotal}
          posting={draftMutationLoading}
          errorMessage={posPaymentError}
          autoPrintEnabled={autoPrintEnabled}
          onClose={handleClosePosPayment}
          onAutoPrintChange={setAutoPrintEnabled}
          onComplete={(amountTendered) => {
            void handleCompletePosPayment(amountTendered);
          }}
        />
      ) : null}
    </section>
  );
}
