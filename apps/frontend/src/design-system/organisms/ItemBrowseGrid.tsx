import { Fragment, useEffect, useState } from "react";
import { CircleMinus, CirclePlus, Eye } from "lucide-react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { VariantOptionPills } from "../molecules/VariantOptionPills";
import {
  getLocalItemDetailForDisplay,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../../features/sync/engine";

type ItemBrowseGridProps = {
  items: ItemDisplay[];
  activeStore: string | null;
  onOpenItem: (itemId: string) => void;
  showCategory?: boolean;
};

const getSkuSummary = (item: ItemDisplay) => {
  const primarySku = item.variantSkus[0] || item.sku || "Not set";
  if (item.variantCount <= 1) {
    return {
      primary: primarySku,
      moreCount: 0,
      title: primarySku,
    };
  }

  return {
    primary: primarySku === "Not set" ? "Multiple" : primarySku,
    moreCount: Math.max(item.variantCount - 1, 0),
    title:
      item.variantSkus.length > 0
        ? item.variantSkus.join(", ")
        : "No SKU set for variants",
  };
};

export function ItemBrowseGrid({
  items,
  activeStore,
  onOpenItem,
  showCategory = true,
}: ItemBrowseGridProps) {
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDetailDisplay>>({});
  const [loadingDetailsById, setLoadingDetailsById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedItemIds([]);
    setItemDetailsById({});
    setLoadingDetailsById({});
  }, [activeStore, items]);

  const toggleExpand = (itemId: string) => {
    const isExpanded = expandedItemIds.includes(itemId);
    if (isExpanded) {
      setExpandedItemIds((current) => current.filter((id) => id !== itemId));
      return;
    }

    setExpandedItemIds((current) => [...current, itemId]);
    if (!activeStore || itemDetailsById[itemId] || loadingDetailsById[itemId]) {
      return;
    }

    setLoadingDetailsById((current) => ({ ...current, [itemId]: true }));
    void getLocalItemDetailForDisplay(activeStore, itemId)
      .then((detail) => {
        if (!detail) return;
        setItemDetailsById((current) => ({ ...current, [itemId]: detail }));
      })
      .finally(() => {
        setLoadingDetailsById((current) => ({ ...current, [itemId]: false }));
      });
  };

  const expandColSpan = showCategory ? 7 : 6;

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2 lg:hidden">
        {items.map((item) => (
          <li
            key={item.entityId}
            className={`card cursor-pointer space-y-1.5 transition hover:border-accent/50 hover:bg-white/75 ${
              item.isActive ? "" : "border-[#f3c3c0] bg-[#fff5f5]"
            }`}
            role="button"
            tabIndex={0}
            onClick={() => onOpenItem(item.entityId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenItem(item.entityId);
              }
            }}
          >
            {(() => {
              const skuSummary = getSkuSummary(item);
              return (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      {item.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        item.isActive
                          ? "bg-[#e8f2ff] text-[#24507e]"
                          : "bg-[#fce8e8] text-[#8a2b2b]"
                      }`}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs tracking-[0.01em] text-muted-foreground">
                    SKU: <span className="font-medium">{skuSummary.primary}</span>
                    {skuSummary.moreCount > 0 ? (
                      <span>{` +${skuSummary.moreCount} more`}</span>
                    ) : null}
                  </p>
                  {showCategory ? (
                    <p className="text-xs tracking-[0.01em] text-muted-foreground">
                      Category:{" "}
                      <span className="font-medium">
                        {item.category || "Uncategorized"}
                      </span>
                    </p>
                  ) : null}
                </>
              );
            })()}
            <p className="pt-2 text-xs text-muted-foreground">Click to view details</p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-white/65 bg-white/55 lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-white/70 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            <tr>
              <th className="w-14 px-3 py-1.5 font-semibold" aria-label="Expand variants" />
              <th className="px-3 py-1.5 font-semibold">Item</th>
              {showCategory ? (
                <th className="w-40 px-3 py-1.5 font-semibold">Category</th>
              ) : null}
              <th className="w-44 px-3 py-1.5 font-semibold">SKU</th>
              <th className="w-28 px-3 py-1.5 font-semibold">Variants</th>
              <th className="w-28 px-3 py-1.5 font-semibold">Status</th>
              <th className="w-28 px-3 py-1.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isExpanded = expandedItemIds.includes(item.entityId);
              const hasMultipleVariants = item.variantCount > 1;
              const detail = itemDetailsById[item.entityId];
              const variants = detail?.variants ?? [];
              const isLoading = Boolean(loadingDetailsById[item.entityId]);
              const skuSummary = getSkuSummary(item);

              return (
                <Fragment key={item.entityId}>
                  <tr
                    className={`h-9 border-t border-white/60 align-middle text-xs ${
                      item.isActive ? "" : "bg-[#fff7f7]"
                    }`}
                  >
                    <td className="px-3 py-0 align-middle">
                      {hasMultipleVariants ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-[#2f6fb7] hover:bg-[#e9f2ff]"
                          onClick={() => toggleExpand(item.entityId)}
                          aria-label={isExpanded ? "Collapse variants" : "Expand variants"}
                        >
                          {isExpanded ? <CircleMinus /> : <CirclePlus />}
                        </Button>
                      ) : null}
                    </td>
                    <td className="px-3 py-0 align-middle font-semibold text-foreground">
                      {item.name}
                    </td>
                    {showCategory ? (
                      <td className="truncate px-3 py-0 align-middle text-foreground/90">
                        {item.category || "Uncategorized"}
                      </td>
                    ) : null}
                    <td
                      className="truncate px-3 py-0 align-middle text-foreground/90"
                      title={skuSummary.title}
                    >
                      <span className="truncate">{skuSummary.primary}</span>
                      {skuSummary.moreCount > 0 ? (
                        <span className="ml-1 text-muted-foreground">
                          +{skuSummary.moreCount} more
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-0 align-middle text-foreground/90">
                      {item.variantCount}
                    </td>
                    <td className="px-3 py-0 align-middle">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.isActive
                            ? "bg-[#e8f2ff] text-[#24507e]"
                            : "bg-[#fce8e8] text-[#8a2b2b]"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-0 text-right align-middle">
                      <IconButton
                        icon={Eye}
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenItem(item.entityId)}
                        className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                        aria-label={`View details for ${item.name}`}
                        title="View details"
                      />
                    </td>
                  </tr>
                  {isExpanded && hasMultipleVariants ? (
                    <tr className="border-t border-white/40 bg-white/40 text-sm">
                      <td colSpan={expandColSpan} className="px-3 py-3">
                        {isLoading ? (
                          <p className="text-xs text-muted-foreground">Loading variants...</p>
                        ) : variants.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No variants found.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-white/65 bg-white/70">
                            <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                              <thead className="bg-white/75 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                                <tr>
                                  <th className="w-20 px-2 py-1.5">Active</th>
                                  <th className="px-2 py-1.5">Variant Name</th>
                                  <th className="px-2 py-1.5">SKU</th>
                                  <th className="px-2 py-1.5">Barcode</th>
                                  <th className="px-2 py-1.5">Options</th>
                                  <th className="w-20 px-2 py-1.5">Usage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {variants.map((variant) => {
                                  const optionPairs = Object.entries(variant.optionValues);
                                  return (
                                    <tr key={variant.id} className="border-t border-white/60 text-xs">
                                      <td className="px-2 py-1.5 text-muted-foreground">
                                        {variant.isActive ? "Yes" : "No"}
                                      </td>
                                      <td className="truncate px-2 py-1.5">{variant.name || "-"}</td>
                                      <td className="truncate px-2 py-1.5">{variant.sku || "-"}</td>
                                      <td className="truncate px-2 py-1.5">{variant.barcode || "-"}</td>
                                      <td className="px-2 py-1.5">
                                        <VariantOptionPills
                                          options={optionPairs.map(([key, value]) => ({
                                            key,
                                            value,
                                          }))}
                                          emptyLabel="-"
                                        />
                                      </td>
                                      <td className="px-2 py-1.5 text-muted-foreground">
                                        {variant.usageCount}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
