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
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../../features/sync/engine";

type ItemVariantFlatTableProps = {
  items?: ItemDisplay[];
  activeStore: string | null;
  rows?: ItemVariantFlatRow[];
  loading?: boolean;
  emptyMessage?: string;
  showCategory?: boolean;
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
  isActive: boolean;
  pending: boolean;
  actionId?: string;
};

const toVariantLabel = (variantName: string) => {
  const trimmed = variantName.trim();
  if (trimmed) return trimmed;
  return "-";
};

export function ItemVariantFlatTable({
  items = [],
  activeStore,
  rows,
  loading = false,
  emptyMessage = "No variants found.",
  showCategory = true,
  actionLabel = "View",
  actionIcon = Eye,
  actionClassName,
  mobileActionTrigger = "card",
  mobileActionButtonClassName,
  onAction,
  onOpenItem,
}: ItemVariantFlatTableProps) {
  const [detailsByItemId, setDetailsByItemId] = useState<Record<string, ItemDetailDisplay | null>>({});
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
  }, [activeStore, items, rows]);

  const derivedRows = useMemo<ItemVariantFlatRow[]>(() => {
    const flatRows: ItemVariantFlatRow[] = [];
    for (const item of items) {
      const detail = detailsByItemId[item.entityId];
      const variants = detail?.variants ?? [];
      if (variants.length === 0) {
        flatRows.push({
          key: `${item.entityId}:single`,
          itemId: item.entityId,
          itemName: item.name,
          variantName: toVariantLabel(""),
          sku: item.sku || item.variantSkus[0] || "",
          category: item.category || "",
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
          isActive: variant.isActive,
          pending: item.pending || variant.pending,
        });
      }
    }

    return flatRows;
  }, [detailsByItemId, items]);
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
                colSpan={showCategory ? (hasAction ? 6 : 5) : (hasAction ? 5 : 4)}
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
