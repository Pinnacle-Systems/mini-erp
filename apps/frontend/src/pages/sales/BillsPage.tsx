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
import {
  type SalesDocumentType,
} from "./sales-invoices-api";
import { SalesDocumentListView } from "./SalesDocumentListView";
import { SalesDocumentLineEditor } from "./SalesDocumentLineEditor";
import { PosQuickAddBar } from "./PosQuickAddBar";
import { SalesDocumentSummaryPanel } from "./SalesDocumentSummaryPanel";
import { SalesDocumentWorkspaceHeader } from "./SalesDocumentWorkspaceHeader";
import {
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
  } = useSalesDocumentWorkspace({
    activeStore,
    activeLocationId,
    config,
    conversionConfig: SALES_DOCUMENT_CONVERSION_CONFIG,
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
        linesCount={normalizeLines(lines).length}
        subTotal={totals.subTotal}
        grandTotal={totals.grandTotal}
        onValueChange={setQuickAddItemQuery}
        onAddItem={quickAddLineItem}
      />
    ) : null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-1 lg:overflow-hidden">
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
          onOpenList={() => setViewMode("list")}
          onSaveDraft={() => {
            void saveDraft();
          }}
          onPostDraft={() => {
            void postDraft();
          }}
        />

        {duplicateMeta ? (
          <div className="pt-2">
            <DraftReviewPanel
              title={`Duplicate of estimate ${duplicateMeta.sourceBillNumber}`}
              description="Original line pricing was preserved in this draft. Review any unavailable items or stale prices before posting."
              alerts={duplicateWarningAlerts}
              actionLabel={
                duplicateWarnings.priceDiscrepancies.length > 0
                  ? "Refresh to Current Price"
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
              readOnly={isViewingPostedDocument || isPosMode}
              disabled={isViewingPostedDocument || isPosMode}
              onChange={(event) => {
                setBillNumber(event.target.value);
                setNumberConflict(null);
              }}
            />
            {isPosMode ? (
              <div className="text-[11px] text-muted-foreground">
                POS uses the next invoice number automatically for faster checkout.
              </div>
            ) : null}
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
              <div className="text-[11px] text-muted-foreground">
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
          <SalesDocumentLineEditor
            config={config}
            lines={lines}
            itemOptions={itemOptions}
            lookupLoading={lookupLoading}
            isViewingPostedDocument={isViewingPostedDocument}
            shouldShowOriginBadges={shouldShowOriginBadges}
            lineHeaderSlot={posLineHeader}
            onAppendLine={appendLine}
            onApplyLineItem={applyLineItem}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onHandleLineNavigation={handleSalesLineNavigation}
            getLinkedLineCap={getLinkedLineCap}
            getLineOriginTitle={getLineOriginTitle}
            getOriginBadgeClassName={getOriginBadgeClassName}
            getSameItemMixedOriginHint={getSameItemMixedOriginHint}
          />

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
            <SalesDocumentSummaryPanel
              config={config}
              activeBusinessName={activeBusinessName}
              totals={totals}
              linesCountSource={lines}
              validUntil={validUntil}
              dispatchDate={dispatchDate}
              dispatchReference={dispatchReference}
              dispatchCarrier={dispatchCarrier}
              isPosMode={isPosMode}
              invoiceRows={invoiceRows}
              onOpenInvoiceRow={(row) =>
                row.source === "local"
                  ? loadDraft(row.draft)
                  : loadServerDraft(row.invoice)
              }
              onOpenList={() => setViewMode("list")}
            />
          </div>
        </div>
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
    </section>
  );
}
