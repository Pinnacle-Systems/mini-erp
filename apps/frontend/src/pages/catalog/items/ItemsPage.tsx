import { Fragment, useEffect, useMemo, useState } from "react";
import { CircleMinus, CirclePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import { Select } from "../../../design-system/atoms/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../design-system/molecules/Card";
import { useSessionStore } from "../../../features/auth/session-business";
import {
  getLocalItemDetailForDisplay,
  getLocalItemsForDisplay,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../../../features/sync/engine";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";
const DENSE_SELECT_CLASS = "h-8 rounded-lg px-3 text-xs";

export function ItemsPage() {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [query, setQuery] = useState("");
  const [variantFilter, setVariantFilter] = useState<
    "all" | "single-variant" | "multi-variant"
  >("all");
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDetailDisplay>>({});
  const [loadingDetailsById, setLoadingDetailsById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    let cancelled = false;
    void getLocalItemsForDisplay(activeStore).then((nextItems) => {
      if (cancelled) return;
      setItems(nextItems);
    });

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  useEffect(() => {
    queueMicrotask(() => {
      setExpandedItemIds([]);
      setItemDetailsById({});
      setLoadingDetailsById({});
    });
  }, [activeStore]);

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

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const list = activeStore ? items : [];

    return list.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.variantSkus.some((sku) => sku.toLowerCase().includes(normalizedQuery));

      const matchesVariants =
        variantFilter === "all" ||
        (variantFilter === "single-variant" && item.variantCount <= 1) ||
        (variantFilter === "multi-variant" && item.variantCount > 1);

      return matchesQuery && matchesVariants;
    });
  }, [activeStore, items, query, variantFilter]);

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">Items</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Browse, filter, and expand variants for catalog items.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={() => navigate("/app/items/new")}>
              Add Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <div className="grid gap-2 rounded-xl border border-white/65 bg-white/55 p-2 sm:grid-cols-2 lg:shrink-0 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="items-search" className="block">
                Search
              </Label>
              <Input
                id="items-search"
                className={DENSE_INPUT_CLASS}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, SKU, or category"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="items-variant-filter" className="block">
                Variants
              </Label>
              <Select
                id="items-variant-filter"
                className={`w-full ${DENSE_SELECT_CLASS}`}
                value={variantFilter}
                onChange={(event) =>
                  setVariantFilter(
                    event.target.value as "all" | "single-variant" | "multi-variant",
                  )
                }
              >
                <option value="all">All</option>
                <option value="single-variant">Single variant</option>
                <option value="multi-variant">Multiple variants</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setQuery("");
                  setVariantFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {items.length === 0 ? (
              <div className="card text-sm text-muted-foreground">No items available.</div>
            ) : filteredItems.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No items match your current filters.
              </div>
            ) : (
              <>
                <ul className="grid gap-2 sm:grid-cols-2 lg:hidden">
                  {filteredItems.map((item) => (
                    <li
                      key={item.entityId}
                      className="card cursor-pointer space-y-1.5 transition hover:border-accent/50 hover:bg-white/75"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/app/items/${item.entityId}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/app/items/${item.entityId}`);
                        }
                      }}
                    >
                      <h2 className="text-sm font-semibold text-foreground">
                        {item.name}
                      </h2>
                      <p className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
                        {item.variantCount > 1
                          ? `Variants: ${item.variantCount}`
                          : `SKU: ${item.sku || "Not set"}`}
                      </p>
                      <p className="pt-2 text-xs text-muted-foreground">Click to view details</p>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-hidden rounded-xl border border-white/65 bg-white/55 lg:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead className="bg-white/70 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                      <tr>
                        <th className="w-14 px-3 py-2">Open</th>
                        <th className="px-3 py-2">Item</th>
                        <th className="w-40 px-3 py-2">Category</th>
                        <th className="w-44 px-3 py-2">Default SKU</th>
                        <th className="w-28 px-3 py-2">Variants</th>
                        <th className="w-28 px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const isExpanded = expandedItemIds.includes(item.entityId);
                        const detail = itemDetailsById[item.entityId];
                        const variants = detail?.variants ?? [];
                        const isLoading = Boolean(loadingDetailsById[item.entityId]);

                        return (
                          <Fragment key={item.entityId}>
                            <tr className="border-t border-white/60 text-sm">
                              <td className="px-3 py-2 align-middle">
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
                              </td>
                              <td className="px-3 py-2 align-middle font-medium text-foreground">
                                {item.name}
                              </td>
                              <td className="truncate px-3 py-2 align-middle text-muted-foreground">
                                {item.category || "Uncategorized"}
                              </td>
                              <td className="truncate px-3 py-2 align-middle text-muted-foreground">
                                {item.sku || "Not set"}
                              </td>
                              <td className="px-3 py-2 align-middle text-muted-foreground">
                                {item.variantCount}
                              </td>
                              <td className="px-3 py-2 text-right align-middle">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/app/items/${item.entityId}`)}
                                >
                                  Manage
                                </Button>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="border-t border-white/40 bg-white/40 text-sm">
                                <td colSpan={6} className="px-3 py-3">
                                  {isLoading ? (
                                    <p className="text-xs text-muted-foreground">Loading variants...</p>
                                  ) : variants.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No variants found.</p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-lg border border-white/65 bg-white/70">
                                      <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                                        <thead className="bg-white/75 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                                          <tr>
                                            <th className="w-20 px-2 py-1.5">Default</th>
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
                                                  {variant.isDefault ? "Yes" : "No"}
                                                </td>
                                                <td className="px-2 py-1.5 text-muted-foreground">
                                                  {variant.isActive ? "Yes" : "No"}
                                                </td>
                                                <td className="truncate px-2 py-1.5">{variant.name || "-"}</td>
                                                <td className="truncate px-2 py-1.5">{variant.sku || "-"}</td>
                                                <td className="truncate px-2 py-1.5">{variant.barcode || "-"}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground">
                                                  {optionPairs.length === 0
                                                    ? "-"
                                                    : optionPairs
                                                        .map(([key, value]) => `${key}: ${value}`)
                                                        .join(", ")}
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
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
