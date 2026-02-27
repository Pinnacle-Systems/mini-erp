import { useEffect, useMemo, useState } from "react";
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
import { ItemVariantFlatTable } from "../../../design-system/organisms/ItemVariantFlatTable";
import { useSessionStore } from "../../../features/auth/session-business";
import {
  getLocalItemsForDisplay,
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
  const [includeInactive, setIncludeInactive] = useState(false);

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
      const matchesStatus = includeInactive || item.isActive;

      return matchesQuery && matchesVariants && matchesStatus;
    });
  }, [activeStore, includeInactive, items, query, variantFilter]);

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-0">
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
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">
              Filters
            </legend>
            <p className="app-filter-help">
              Refine items by search text, variant count, and active status.
            </p>
            <div className="app-filter-row">
              <Input
                id="items-search"
                className={`${DENSE_INPUT_CLASS} w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, SKU, or category"
              />
              <Select
                id="items-variant-filter"
                className={`w-full min-[642px]:w-auto min-[642px]:min-w-[12rem] ${DENSE_SELECT_CLASS}`}
                value={variantFilter}
                onChange={(event) =>
                  setVariantFilter(
                    event.target.value as "all" | "single-variant" | "multi-variant",
                  )
                }
              >
                <option value="all">All variants</option>
                <option value="single-variant">Single variant</option>
                <option value="multi-variant">Multiple variants</option>
              </Select>
              <div className="inline-flex items-center gap-2">
                <button
                  id="include-inactive-items"
                  type="button"
                  role="switch"
                  aria-checked={includeInactive}
                  aria-label="Include inactive items"
                  onClick={() => setIncludeInactive((current) => !current)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 ${
                    includeInactive
                      ? "border-[#2f6fb7] bg-[#4a8dd9]"
                      : "border-[#b8cbe0] bg-[#e7eff8]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      includeInactive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <Label htmlFor="include-inactive-items" className="shrink-0">
                  Include inactive
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full min-[642px]:w-auto"
                onClick={() => {
                  setQuery("");
                  setVariantFilter("all");
                  setIncludeInactive(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </fieldset>

          <div className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {items.length === 0 ? (
              <div className="card text-sm text-muted-foreground">No items available.</div>
            ) : filteredItems.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No items match your current filters.
              </div>
            ) : (
              <ItemVariantFlatTable
                items={filteredItems}
                activeStore={activeStore}
                actionLabel="View"
                onOpenItem={(itemId) => navigate(`/app/items/${itemId}`)}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
