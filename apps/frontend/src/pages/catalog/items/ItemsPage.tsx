import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import { Switch } from "../../../design-system/atoms/Switch";
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

export function ItemsPage() {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [query, setQuery] = useState("");
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

      const matchesStatus = includeInactive || item.isActive;

      return matchesQuery && matchesStatus;
    });
  }, [activeStore, includeInactive, items, query]);

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
            <Button
              type="button"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => navigate("/app/items/new")}
            >
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
              Refine items by search text and active status.
            </p>
            <div className="app-filter-row">
              <Input
                id="items-search"
                className={`${DENSE_INPUT_CLASS} w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, SKU, or category"
              />
              <div className="inline-flex min-h-8 items-center gap-2.5">
                <Switch
                  id="include-inactive-items"
                  aria-label="Include inactive items"
                  checked={includeInactive}
                  onCheckedChange={setIncludeInactive}
                  className="h-6 w-11 border border-[#b8cbe0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]"
                  checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                  uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                />
                <Label htmlFor="include-inactive-items" className="shrink-0 leading-none">
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
                  setIncludeInactive(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </fieldset>

          <div className="space-y-2 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pr-1">
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
      <div className="fixed bottom-[5.25rem] right-3 z-30 lg:hidden">
        <Button type="button" size="sm" className="h-10 px-4 shadow-sm" onClick={() => navigate("/app/items/new")}>
          Add Item
        </Button>
      </div>
    </section>
  );
}
