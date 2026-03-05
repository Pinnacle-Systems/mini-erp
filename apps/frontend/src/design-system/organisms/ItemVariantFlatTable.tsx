import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, type LucideIcon } from "lucide-react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../molecules/DenseTable";
import { DENSE_TABLE_COLUMN_WIDTHS } from "../molecules/denseTableColumns";
import {
  getLocalItemDetailForDisplay,
  getLocalItemPricingRowsForDisplay,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../../features/sync/engine";
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
  sku: string;
  category: string;
  unit?: string;
  itemType?: "PRODUCT" | "SERVICE";
  hsnSac?: string;
  salesPrice?: number | null;
  purchasePrice?: number | null;
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

const formatPrice = (amount: number | null, currency: string) => {
  if (amount === null || !Number.isFinite(amount)) return "-";
  const normalizedCurrency = currency.trim().toUpperCase() || "INR";
  return `${normalizedCurrency} ${amount.toFixed(2)}`;
};

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
  actionLabel = "View",
  actionIcon = Eye,
  actionClassName,
  mobileActionTrigger = "card",
  mobileActionButtonClassName,
  onAction,
  onOpenItem,
}: ItemVariantFlatTableProps) {
  const [detailsByItemId, setDetailsByItemId] = useState<Record<string, ItemDetailDisplay | null>>({});
  const [salesPriceByVariantId, setSalesPriceByVariantId] = useState<
    Record<string, { amount: number | null; currency: string }>
  >({});
  const [purchasePriceByVariantId, setPurchasePriceByVariantId] = useState<
    Record<string, { amount: number | null; currency: string }>
  >({});
  const { lastSyncCompletedAt } = useSyncActions();
  const hasAction = Boolean(onAction || onOpenItem);

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
          sku: pendingVariant.sku || item.sku || item.variantSkus[0] || "",
          category: item.category || "",
          unit: item.unit,
          itemType: item.itemType,
          hsnSac: item.hsnSac,
              salesPrice: pendingVariant.salesPrice,
              purchasePrice: pendingVariant.purchasePrice,
              currency: "INR",
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
          sku: item.sku || item.variantSkus[0] || "",
          category: item.category || "",
          unit: item.unit,
          itemType: item.itemType,
          hsnSac: item.hsnSac,
          salesPrice: null,
          purchasePrice: null,
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
          sku: variant.sku || "",
          category: item.category || "",
          unit: item.unit,
          itemType: item.itemType,
          hsnSac: item.hsnSac,
          salesPrice: salesPriceByVariantId[variant.id]?.amount ?? null,
          purchasePrice: purchasePriceByVariantId[variant.id]?.amount ?? null,
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

  if (!loading && visibleRows.length === 0) {
    return <div className="card text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="space-y-2 lg:hidden">
        {loading ? (
          <div className="card text-sm text-muted-foreground">Loading variants...</div>
        ) : (
          visibleRows.map((row) => (
            hasAction && mobileActionTrigger === "card" ? (
              <button
                key={row.key}
                type="button"
                className="block w-full space-y-2 rounded-xl border border-border/70 bg-white p-3 text-left transition hover:bg-white/90"
                onClick={() => handleAction(row)}
                aria-label={`${actionLabel} ${row.itemName}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{row.itemName}</p>
                    <p className="text-xs text-muted-foreground">{row.variantName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      SKU: <span className="font-mono">{row.sku || "-"}</span>
                    </p>
                    {showUnit ? (
                      <p className="text-[11px] text-muted-foreground">Unit: {row.unit || "-"}</p>
                    ) : null}
                    {showCommercialFields ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          {taxCodeLabel}: {row.hsnSac || "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Sales: {formatPrice(row.salesPrice ?? null, row.currency ?? "INR")}
                        </p>
                        {showPurchasePrice ? (
                          <p className="text-[11px] text-muted-foreground">
                            Purchase: {formatPrice(row.purchasePrice ?? null, row.currency ?? "INR")}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {showCategory ? (
                      <p className="text-[11px] text-muted-foreground">Category: {row.category || "-"}</p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </button>
            ) : (
              <div key={row.key} className="space-y-2 rounded-xl border border-border/70 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{row.itemName}</p>
                    <p className="text-xs text-muted-foreground">{row.variantName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      SKU: <span className="font-mono">{row.sku || "-"}</span>
                    </p>
                    {showUnit ? (
                      <p className="text-[11px] text-muted-foreground">Unit: {row.unit || "-"}</p>
                    ) : null}
                    {showCommercialFields ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          {taxCodeLabel}: {row.hsnSac || "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Sales: {formatPrice(row.salesPrice ?? null, row.currency ?? "INR")}
                        </p>
                        {showPurchasePrice ? (
                          <p className="text-[11px] text-muted-foreground">
                            Purchase: {formatPrice(row.purchasePrice ?? null, row.currency ?? "INR")}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {showCategory ? (
                      <p className="text-[11px] text-muted-foreground">Category: {row.category || "-"}</p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {hasAction && mobileActionTrigger === "button" ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={
                        mobileActionButtonClassName ??
                        "h-8 gap-1.5 px-3 text-[11px] text-[#7a1f1f] hover:bg-[#fff5f5]"
                      }
                      onClick={() => handleAction(row)}
                    >
                      {actionIcon ? <actionIcon aria-hidden="true" /> : null}
                      <span>{actionLabel}</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          ))
        )}
      </div>

      <DenseTable tableClassName="text-xs">
        <DenseTableHead className="bg-slate-50/95">
          <tr>
            <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.item} px-2`}>Item</DenseTableHeaderCell>
            <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.variant} px-2`}>Variant</DenseTableHeaderCell>
            <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.sku} px-2`}>SKU</DenseTableHeaderCell>
            {showUnit ? (
              <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.unit} px-2`}>Unit</DenseTableHeaderCell>
            ) : null}
            {showCommercialFields ? (
              <DenseTableHeaderCell className="w-24 px-2">{taxCodeLabel}</DenseTableHeaderCell>
            ) : null}
            {showCommercialFields ? (
              <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.price}>Sales</DenseTableHeaderCell>
            ) : null}
            {showCommercialFields && showPurchasePrice ? (
              <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.price}>Purchase</DenseTableHeaderCell>
            ) : null}
            {showCategory ? (
              <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.category} px-2`}>Category</DenseTableHeaderCell>
            ) : null}
            <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.status} px-2`}>Status</DenseTableHeaderCell>
            {hasAction ? (
              <DenseTableHeaderCell className={`${DENSE_TABLE_COLUMN_WIDTHS.action} text-right`}>Actions</DenseTableHeaderCell>
            ) : null}
          </tr>
        </DenseTableHead>
        <DenseTableBody>
          {loading ? (
            <DenseTableRow>
              <DenseTableCell
                className="px-2 py-3 text-muted-foreground"
                colSpan={
                  (showCommercialFields ? 3 : 0) +
                  (showCommercialFields && !showPurchasePrice ? -1 : 0) +
                  (showUnit ? 1 : 0) +
                  (showCategory ? 1 : 0) +
                  (hasAction ? 1 : 0) +
                  4
                }
              >
                Loading variants...
              </DenseTableCell>
            </DenseTableRow>
          ) : (
            visibleRows.map((row) => (
              <DenseTableRow key={row.key} className="align-top">
                <DenseTableCell className="truncate px-2 py-2.5 font-medium text-foreground">{row.itemName}</DenseTableCell>
                <DenseTableCell className="truncate px-2 py-2.5 text-muted-foreground">{row.variantName}</DenseTableCell>
                <DenseTableCell className="truncate px-2 py-2.5 font-mono text-[11px]">{row.sku || "-"}</DenseTableCell>
                {showUnit ? <DenseTableCell className="truncate px-2 py-2.5">{row.unit || "-"}</DenseTableCell> : null}
                {showCommercialFields ? (
                  <DenseTableCell className="truncate px-2 py-2.5">{row.hsnSac || "-"}</DenseTableCell>
                ) : null}
                {showCommercialFields ? (
                  <DenseTableCell className="truncate px-2 py-2.5">
                    {formatPrice(row.salesPrice ?? null, row.currency ?? "INR")}
                  </DenseTableCell>
                ) : null}
                {showCommercialFields && showPurchasePrice ? (
                  <DenseTableCell className="truncate px-2 py-2.5">
                    {formatPrice(row.purchasePrice ?? null, row.currency ?? "INR")}
                  </DenseTableCell>
                ) : null}
                {showCategory ? <DenseTableCell className="truncate px-2 py-2.5">{row.category || "-"}</DenseTableCell> : null}
                <DenseTableCell className="px-2 py-2.5">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </DenseTableCell>
                {hasAction ? (
                  <DenseTableCell className="px-2 py-2.5 text-right">
                    <IconButton
                      type="button"
                      icon={actionIcon}
                      variant="ghost"
                      onClick={() => handleAction(row)}
                      className={
                        actionClassName ??
                        "h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                      }
                      aria-label={`${actionLabel} ${row.itemName}`}
                      title={actionLabel}
                    />
                  </DenseTableCell>
                ) : null}
              </DenseTableRow>
            ))
          )}
        </DenseTableBody>
      </DenseTable>
    </>
  );
}
