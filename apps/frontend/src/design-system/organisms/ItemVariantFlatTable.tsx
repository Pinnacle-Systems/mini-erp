import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, type LucideIcon } from "lucide-react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import {
  TabularBody,
  TabularCell,
  TabularFooter,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../molecules/tabularSerialNumbers";
import { tabularNumericClassName } from "../molecules/tabularTokens";
import {
  getLocalItemDetailForDisplay,
  getLocalItemPricingRowsForDisplay,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../../features/sync/engine";
import { formatCurrencyDisplay } from "../../lib/currency-display";
import { formatGstSlabLabel } from "../../lib/gst-slabs";
import { useSyncActions } from "../../features/sync/SyncProvider";

type ItemVariantFlatTableProps = {
  items?: ItemDisplay[];
  activeStore: string | null;
  rows?: ItemVariantFlatRow[];
  loading?: boolean;
  emptyMessage?: string;
  showCategory?: boolean;
  showUnit?: boolean;
  taxCodeLabel?: "HSN" | "SAC";
  showCommercialFields?: boolean;
  showPurchasePrice?: boolean;
  showStatus?: boolean;
  highlightInactiveRows?: boolean;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  actionClassName?: string;
  // Use "button" for destructive mobile actions so the card surface itself stays non-destructive.
  mobileActionTrigger?: "card" | "button";
  mobileActionButtonClassName?: string;
  onAction?: (row: ItemVariantFlatRow) => void;
  onOpenItem?: (itemId: string) => void;
};

export type ItemVariantFlatRow = {
  key: string;
  itemId: string;
  itemName: string;
  variantName: string;
  hasMultipleVariants?: boolean;
  sku: string;
  category: string;
  unit?: string;
  itemType?: "PRODUCT" | "SERVICE";
  hsnSac?: string;
  gstSlab?: string | null;
  salesPrice?: number | null;
  salesTaxMode?: "EXCLUSIVE" | "INCLUSIVE";
  purchasePrice?: number | null;
  purchaseTaxMode?: "EXCLUSIVE" | "INCLUSIVE";
  currency?: string;
  isActive: boolean;
  pending: boolean;
  actionId?: string;
};

const toVariantLabel = (variantName: string) => {
  const trimmed = variantName.trim();
  if (trimmed) return trimmed;
  return "-";
};

const getPrimaryName = (row: ItemVariantFlatRow) => {
  const hasMultipleVariants =
    row.hasMultipleVariants ??
    (row.variantName.trim().length > 0 &&
      row.variantName.trim() !== "-" &&
      row.variantName.trim() !== row.itemName.trim());
  return hasMultipleVariants ? row.variantName : row.itemName;
};

const getGstSlabDisplay = (value: string | null | undefined) => formatGstSlabLabel(value) || "-";
const getTaxModeDisplay = (value: "EXCLUSIVE" | "INCLUSIVE" | undefined) =>
  value === "INCLUSIVE" ? "Incl." : "Excl.";
const groupedHeaderRows = "1.65rem 1.2rem";
const groupedParentHeaderClassName = "h-full justify-center text-center";
const groupedSubHeaderClassName =
  "h-full text-[9px] font-medium tracking-[0.03em] text-muted-foreground";

export function ItemVariantFlatTable({
  items = [],
  activeStore,
  rows,
  loading = false,
  emptyMessage = "No variants found.",
  showCategory = true,
  showUnit = false,
  taxCodeLabel = "HSN",
  showCommercialFields = false,
  showPurchasePrice = true,
  showStatus = true,
  highlightInactiveRows = false,
  actionLabel = "View",
  actionIcon = Eye,
  actionClassName,
  mobileActionTrigger = "card",
  mobileActionButtonClassName,
  onAction,
  onOpenItem,
}: ItemVariantFlatTableProps) {
  const ActionIcon = actionIcon;
  const [detailsByItemId, setDetailsByItemId] = useState<Record<string, ItemDetailDisplay | null>>({});
  const [salesPriceByVariantId, setSalesPriceByVariantId] = useState<
    Record<
      string,
      {
        amount: number | null;
        currency: string;
        gstSlab: string | null;
        taxMode: "EXCLUSIVE" | "INCLUSIVE";
      }
    >
  >({});
  const [purchasePriceByVariantId, setPurchasePriceByVariantId] = useState<
    Record<string, { amount: number | null; currency: string; taxMode: "EXCLUSIVE" | "INCLUSIVE" }>
  >({});
  const { lastSyncCompletedAt } = useSyncActions();
  const hasAction = Boolean(onAction || onOpenItem);
  const desktopGridTemplate = useMemo(() => {
    const tracks = [
      showCategory ? "minmax(6.75rem, 1fr)" : null,
      "minmax(9rem, 1.5fr)",
      "minmax(6.25rem, 0.9fr)",
      showUnit ? "3.5rem" : null,
      showCommercialFields ? "4.5rem" : null,
      showCommercialFields ? "minmax(5.25rem, 0.8fr)" : null,
      showCommercialFields ? "minmax(4.25rem, 0.45fr)" : null,
      showCommercialFields && showPurchasePrice ? "minmax(5.25rem, 0.8fr)" : null,
      showCommercialFields && showPurchasePrice ? "minmax(4.25rem, 0.45fr)" : null,
      showCommercialFields ? "4rem" : null,
      showStatus ? "minmax(7.5rem, 0.9fr)" : null,
      hasAction ? "3rem" : null,
    ].filter(Boolean);
    return withTabularSerialNumberColumn(tracks.join(" "));
  }, [hasAction, showCategory, showCommercialFields, showPurchasePrice, showStatus, showUnit]);

  useEffect(() => {
    if (rows) return;
    if (!activeStore || items.length === 0) return;

    let cancelled = false;
    void Promise.all(
      items.map(async (item) => {
        const detail = await getLocalItemDetailForDisplay(activeStore, item.entityId).catch(() => null);
        return [item.entityId, detail] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setDetailsByItemId(Object.fromEntries(pairs));
    });

    return () => {
      cancelled = true;
    };
  }, [activeStore, items, lastSyncCompletedAt, rows]);

  useEffect(() => {
    if (rows) return;
    if (!activeStore || items.length === 0) return;

    let cancelled = false;
    void Promise.all([
      getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "SALES"),
      getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "PURCHASE"),
    ]).then(([salesRows, purchaseRows]) => {
      if (cancelled) return;
      setSalesPriceByVariantId(
        Object.fromEntries(
          salesRows.map((row) => [
            row.variantId,
            {
              amount: row.amount,
              currency: row.currency,
              gstSlab: row.gstSlab,
              taxMode: row.taxMode,
            },
          ]),
        ),
      );
      setPurchasePriceByVariantId(
        Object.fromEntries(
          purchaseRows.map((row) => [
            row.variantId,
            {
              amount: row.amount,
              currency: row.currency,
              taxMode: row.taxMode,
            },
          ]),
        ),
      );
    }).catch(() => {
      if (cancelled) return;
      setSalesPriceByVariantId({});
      setPurchasePriceByVariantId({});
    });

    return () => {
      cancelled = true;
    };
  }, [activeStore, items, lastSyncCompletedAt, rows]);

  const derivedRows = useMemo<ItemVariantFlatRow[]>(() => {
    const flatRows: ItemVariantFlatRow[] = [];
    for (const item of items) {
      const detail = detailsByItemId[item.entityId];
      const variants = detail?.variants ?? [];
      if (variants.length === 0) {
        const pendingVariantDrafts = item.pendingVariantDrafts ?? [];
        if (item.pending && pendingVariantDrafts.length > 0) {
          for (const pendingVariant of pendingVariantDrafts) {
            flatRows.push({
              key: pendingVariant.id,
              itemId: item.entityId,
              itemName: item.name,
              variantName: toVariantLabel(pendingVariant.name),
              hasMultipleVariants: pendingVariantDrafts.length > 1,
              sku: pendingVariant.sku || item.sku || item.variantSkus[0] || "",
              category: item.category || "",
              unit: item.unit,
              itemType: item.itemType,
              hsnSac: item.hsnSac,
              salesPrice: salesPriceByVariantId[pendingVariant.id]?.amount ?? pendingVariant.salesPrice,
              salesTaxMode: salesPriceByVariantId[pendingVariant.id]?.taxMode ?? "EXCLUSIVE",
              purchasePrice:
                purchasePriceByVariantId[pendingVariant.id]?.amount ?? pendingVariant.purchasePrice,
              purchaseTaxMode: purchasePriceByVariantId[pendingVariant.id]?.taxMode ?? "EXCLUSIVE",
              gstSlab: salesPriceByVariantId[pendingVariant.id]?.gstSlab ?? null,
              currency:
                salesPriceByVariantId[pendingVariant.id]?.currency ??
                purchasePriceByVariantId[pendingVariant.id]?.currency ??
                "INR",
              isActive: pendingVariant.isActive,
              pending: true,
            });
          }
          continue;
        }

        flatRows.push({
          key: `${item.entityId}:single`,
          itemId: item.entityId,
          itemName: item.name,
          variantName: toVariantLabel(""),
          hasMultipleVariants: false,
          sku: item.sku || item.variantSkus[0] || "",
          category: item.category || "",
          unit: item.unit,
          itemType: item.itemType,
          hsnSac: item.hsnSac,
          salesPrice: null,
          salesTaxMode: "EXCLUSIVE",
          purchasePrice: null,
          purchaseTaxMode: "EXCLUSIVE",
          gstSlab: null,
          currency: "INR",
          isActive: item.isActive,
          pending: item.pending,
        });
        continue;
      }

      for (const variant of variants) {
        flatRows.push({
          key: variant.id,
          itemId: item.entityId,
          itemName: item.name,
          variantName: toVariantLabel(variant.name),
          hasMultipleVariants: variants.length > 1,
          sku: variant.sku || "",
          category: item.category || "",
          unit: item.unit,
          itemType: item.itemType,
          hsnSac: item.hsnSac,
          gstSlab: salesPriceByVariantId[variant.id]?.gstSlab ?? null,
          salesPrice: salesPriceByVariantId[variant.id]?.amount ?? null,
          salesTaxMode: salesPriceByVariantId[variant.id]?.taxMode ?? "EXCLUSIVE",
          purchasePrice: purchasePriceByVariantId[variant.id]?.amount ?? null,
          purchaseTaxMode: purchasePriceByVariantId[variant.id]?.taxMode ?? "EXCLUSIVE",
          currency:
            salesPriceByVariantId[variant.id]?.currency ??
            purchasePriceByVariantId[variant.id]?.currency ??
            "INR",
          isActive: variant.isActive,
          pending: item.pending || variant.pending,
        });
      }
    }

    return flatRows;
  }, [detailsByItemId, items, purchasePriceByVariantId, salesPriceByVariantId]);
  const visibleRows = rows ?? derivedRows;

  const handleAction = useCallback(
    (row: ItemVariantFlatRow) => {
      if (onAction) {
        onAction(row);
        return;
      }
      if (onOpenItem) {
        onOpenItem(row.itemId);
      }
    },
    [onAction, onOpenItem],
  );

  const renderGroupedHeaderCells = () => {
    const cells: ReactNode[] = [];
    let column = 1;

    const rowSpanStyle = (targetColumn: number) => ({
      gridColumn: String(targetColumn),
      gridRow: "1 / span 2",
    });
    const firstRowStyle = (targetColumn: number, span = 1) => ({
      gridColumn: span > 1 ? `${targetColumn} / span ${span}` : String(targetColumn),
      gridRow: "1",
    });
    const secondRowStyle = (targetColumn: number) => ({
      gridColumn: String(targetColumn),
      gridRow: "2",
    });

    cells.push(
      <TabularSerialNumberHeaderCell key="serial" rowSpan={2} style={rowSpanStyle(column)} />,
    );
    column += 1;

    if (showCategory) {
      cells.push(
        <TabularCell key="category" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
          Category
        </TabularCell>,
      );
      column += 1;
    }

    cells.push(
      <TabularCell key="name" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
        Name
      </TabularCell>,
    );
    column += 1;

    cells.push(
      <TabularCell key="sku" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
        SKU
      </TabularCell>,
    );
    column += 1;

    if (showUnit) {
      cells.push(
        <TabularCell key="unit" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
          Unit
        </TabularCell>,
      );
      column += 1;
    }

    cells.push(
      <TabularCell key="tax-code" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
        {taxCodeLabel}
      </TabularCell>,
    );
    column += 1;

    cells.push(
      <TabularCell
        key="sales"
        variant="header"
        align="center"
        span={2}
        className={groupedParentHeaderClassName}
        style={firstRowStyle(column, 2)}
      >
        Sales
      </TabularCell>,
      <TabularCell
        key="sales-price"
        variant="header"
        align="end"
        className={groupedSubHeaderClassName}
        style={secondRowStyle(column)}
      >
        Price
      </TabularCell>,
      <TabularCell
        key="sales-tax"
        variant="header"
        align="center"
        className={groupedSubHeaderClassName}
        style={secondRowStyle(column + 1)}
      >
        Tax
      </TabularCell>,
    );
    column += 2;

    if (showPurchasePrice) {
      cells.push(
        <TabularCell
          key="purchase"
          variant="header"
          align="center"
          span={2}
          className={groupedParentHeaderClassName}
          style={firstRowStyle(column, 2)}
        >
          Purchase
        </TabularCell>,
        <TabularCell
          key="purchase-price"
          variant="header"
          align="end"
          className={groupedSubHeaderClassName}
          style={secondRowStyle(column)}
        >
          Price
        </TabularCell>,
        <TabularCell
          key="purchase-tax"
          variant="header"
          align="center"
          className={groupedSubHeaderClassName}
          style={secondRowStyle(column + 1)}
        >
          Tax
        </TabularCell>,
      );
      column += 2;
    }

    cells.push(
      <TabularCell key="gst" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
        GST %
      </TabularCell>,
    );
    column += 1;

    if (showStatus) {
      cells.push(
        <TabularCell key="status" variant="header" rowSpan={2} style={rowSpanStyle(column)}>
          Status
        </TabularCell>,
      );
      column += 1;
    }

    if (hasAction) {
      cells.push(
        <TabularCell
          key="actions"
          variant="header"
          align="center"
          rowSpan={2}
          style={rowSpanStyle(column)}
        >
          Actions
        </TabularCell>,
      );
    }

    return cells;
  };

  if (!loading && visibleRows.length === 0) {
    return <div className="card app-shell-description">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="space-y-2 lg:hidden">
        {loading ? (
          <div className="card app-shell-description">Loading variants...</div>
        ) : (
          visibleRows.map((row) => (
            hasAction && mobileActionTrigger === "card" ? (
              <button
                key={row.key}
                type="button"
                className={`app-mobile-record-card block w-full ${
                  highlightInactiveRows && !row.isActive
                    ? "border-amber-400 bg-amber-100 hover:bg-amber-100"
                    : "border-border/70 bg-white hover:bg-white/90"
                }`}
                onClick={() => handleAction(row)}
                aria-label={`${actionLabel} ${getPrimaryName(row)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="app-mobile-record-title">{getPrimaryName(row)}</p>
                    <p className="app-mobile-record-meta">
                      SKU: <span className="font-mono">{row.sku || "-"}</span>
                    </p>
                    {showUnit ? (
                      <p className="app-mobile-record-meta">Unit: {row.unit || "-"}</p>
                    ) : null}
                    {showCommercialFields ? (
                      <>
                        <p className="app-mobile-record-meta">
                          {taxCodeLabel}: {row.hsnSac || "-"}
                        </p>
                        <p className="app-mobile-record-meta">
                          Sales: {formatCurrencyDisplay(row.salesPrice ?? null, row.currency)}
                        </p>
                        <p className="app-mobile-record-meta">
                          Sales tax: {getTaxModeDisplay(row.salesTaxMode)}
                        </p>
                        {showPurchasePrice ? (
                          <>
                            <p className="app-mobile-record-meta">
                              Purchase: {formatCurrencyDisplay(row.purchasePrice ?? null, row.currency)}
                            </p>
                            <p className="app-mobile-record-meta">
                              Purchase tax: {getTaxModeDisplay(row.purchaseTaxMode)}
                            </p>
                          </>
                        ) : null}
                        <p className="app-mobile-record-meta">
                          GST %: {getGstSlabDisplay(row.gstSlab)}
                        </p>
                      </>
                    ) : null}
                    {showCategory ? (
                      <p className="app-mobile-record-meta">Category: {row.category || "-"}</p>
                    ) : null}
                  </div>
                  {showStatus ? (
                    <span
                      className={`app-mobile-record-status ${
                        row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  ) : null}
                </div>
              </button>
            ) : (
              <div
                key={row.key}
                className={`app-mobile-record-card ${
                  highlightInactiveRows && !row.isActive
                    ? "border-amber-400 bg-amber-100"
                    : "border-border/70 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="app-mobile-record-title">{getPrimaryName(row)}</p>
                    <p className="app-mobile-record-meta">
                      SKU: <span className="font-mono">{row.sku || "-"}</span>
                    </p>
                    {showUnit ? (
                      <p className="app-mobile-record-meta">Unit: {row.unit || "-"}</p>
                    ) : null}
                    {showCommercialFields ? (
                      <>
                        <p className="app-mobile-record-meta">
                          {taxCodeLabel}: {row.hsnSac || "-"}
                        </p>
                        <p className="app-mobile-record-meta">
                          Sales: {formatCurrencyDisplay(row.salesPrice ?? null, row.currency)}
                        </p>
                        <p className="app-mobile-record-meta">
                          Sales tax: {getTaxModeDisplay(row.salesTaxMode)}
                        </p>
                        {showPurchasePrice ? (
                          <>
                            <p className="app-mobile-record-meta">
                              Purchase: {formatCurrencyDisplay(row.purchasePrice ?? null, row.currency)}
                            </p>
                            <p className="app-mobile-record-meta">
                              Purchase tax: {getTaxModeDisplay(row.purchaseTaxMode)}
                            </p>
                          </>
                        ) : null}
                        <p className="app-mobile-record-meta">
                          GST %: {getGstSlabDisplay(row.gstSlab)}
                        </p>
                      </>
                    ) : null}
                    {showCategory ? (
                      <p className="app-mobile-record-meta">Category: {row.category || "-"}</p>
                    ) : null}
                  </div>
                  {showStatus ? (
                    <span
                      className={`app-mobile-record-status ${
                        row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  ) : null}
                </div>
                {hasAction && mobileActionTrigger === "button" ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={
                        mobileActionButtonClassName ??
                        "app-shell-header-control gap-1.5 px-3 text-[#7a1f1f] hover:bg-[#fff5f5]"
                      }
                      onClick={() => handleAction(row)}
                    >
                      <ActionIcon aria-hidden="true" />
                      <span>{actionLabel}</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          ))
        )}
      </div>

      <TabularSurface
        role="grid"
        aria-label="Item list"
        className="hidden overflow-hidden bg-white lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
      >
        <TabularHeader>
          {showCommercialFields ? (
            <TabularRow columns={desktopGridTemplate} rows={groupedHeaderRows}>
              {renderGroupedHeaderCells()}
            </TabularRow>
          ) : (
            <TabularRow columns={desktopGridTemplate}>
              <TabularSerialNumberHeaderCell />
              {showCategory ? <TabularCell variant="header">Category</TabularCell> : null}
              <TabularCell variant="header">Name</TabularCell>
              <TabularCell variant="header">SKU</TabularCell>
              {showUnit ? <TabularCell variant="header">Unit</TabularCell> : null}
              {showStatus ? <TabularCell variant="header">Status</TabularCell> : null}
              {hasAction ? <TabularCell variant="header" align="center">Actions</TabularCell> : null}
            </TabularRow>
          )}
        </TabularHeader>
        <TabularBody className="overflow-y-auto">
          {loading ? (
            <TabularRow columns="minmax(0, 1fr)">
              <TabularCell className="text-muted-foreground">Loading variants...</TabularCell>
            </TabularRow>
          ) : (
            visibleRows.map((row, index) => (
              <TabularRow
                key={row.key}
                columns={desktopGridTemplate}
                interactive
                className={highlightInactiveRows && !row.isActive ? "[&>div]:!bg-amber-100" : undefined}
              >
                <TabularSerialNumberCell index={index} />
                {showCategory ? (
                  <TabularCell truncate hoverTitle={row.category || "-"} className="font-normal">
                    {row.category || "-"}
                  </TabularCell>
                ) : null}
                <TabularCell truncate hoverTitle={getPrimaryName(row)} className="font-normal text-foreground">
                  {getPrimaryName(row)}
                </TabularCell>
                <TabularCell
                  truncate
                  hoverTitle={row.sku || "-"}
                  className="font-normal [font-feature-settings:var(--tabular-num-features)]"
                >
                  {row.sku || "-"}
                </TabularCell>
                {showUnit ? (
                  <TabularCell truncate hoverTitle={row.unit || "-"} align="center">
                    {row.unit || "-"}
                  </TabularCell>
                ) : null}
                {showCommercialFields ? (
                  <TabularCell
                    truncate
                    hoverTitle={row.hsnSac || "-"}
                    className="font-normal [font-feature-settings:var(--tabular-num-features)]"
                  >
                    {row.hsnSac || "-"}
                  </TabularCell>
                ) : null}
                {showCommercialFields ? (
                  <TabularCell
                    align="end"
                    className={tabularNumericClassName}
                    title={formatCurrencyDisplay(row.salesPrice ?? null, row.currency)}
                  >
                    {formatCurrencyDisplay(row.salesPrice ?? null, row.currency)}
                  </TabularCell>
                ) : null}
                {showCommercialFields ? (
                  <TabularCell align="center" title={getTaxModeDisplay(row.salesTaxMode)}>
                    {getTaxModeDisplay(row.salesTaxMode)}
                  </TabularCell>
                ) : null}
                {showCommercialFields && showPurchasePrice ? (
                  <TabularCell
                    align="end"
                    className={tabularNumericClassName}
                    title={formatCurrencyDisplay(row.purchasePrice ?? null, row.currency)}
                  >
                    {formatCurrencyDisplay(row.purchasePrice ?? null, row.currency)}
                  </TabularCell>
                ) : null}
                {showCommercialFields && showPurchasePrice ? (
                  <TabularCell align="center" title={getTaxModeDisplay(row.purchaseTaxMode)}>
                    {getTaxModeDisplay(row.purchaseTaxMode)}
                  </TabularCell>
                ) : null}
                {showCommercialFields ? (
                  <TabularCell align="center" title={getGstSlabDisplay(row.gstSlab)}>
                    {getGstSlabDisplay(row.gstSlab)}
                  </TabularCell>
                ) : null}
                {showStatus ? (
                  <TabularCell>
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TabularCell>
                ) : null}
                {hasAction ? (
                  <TabularCell align="center">
                    <div className="flex justify-center">
                      <IconButton
                        type="button"
                        icon={actionIcon}
                        variant="ghost"
                        onClick={() => handleAction(row)}
                        className={
                          actionClassName ??
                          "h-7 w-7 rounded-none border-none bg-transparent p-0 text-[#1f4167] hover:bg-slate-50"
                        }
                        aria-label={`${actionLabel} ${getPrimaryName(row)}`}
                        title={actionLabel}
                      />
                    </div>
                  </TabularCell>
                ) : null}
              </TabularRow>
            ))
          )}
        </TabularBody>
        <TabularFooter className="border-t border-[var(--tabular-grid-line-color)] px-2">
          <span>
            {loading ? "Loading items..." : `${visibleRows.length} ${visibleRows.length === 1 ? "item" : "items"}`}
          </span>
        </TabularFooter>
      </TabularSurface>
    </>
  );
}
