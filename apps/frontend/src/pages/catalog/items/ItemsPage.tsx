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
import { useDebouncedValue } from "../../../lib/useDebouncedValue";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";

type ItemsPageProps = {
  itemType: "PRODUCT" | "SERVICE";
  title: string;
  singularLabel: string;
  routeBasePath: string;
};

export function ItemsPage({
  itemType,
  title,
  singularLabel,
  routeBasePath,
}: ItemsPageProps) {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const typedItems = useMemo(
    () => (activeStore ? items.filter((item) => item.itemType === itemType) : []),
    [activeStore, itemType, items],
  );

  useEffect(() => {
    if (!activeStore) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setLoading(true);
      setLoadError(null);
    });
    void getLocalItemsForDisplay(activeStore)
      .then((nextItems) => {
        if (cancelled) return;
        setItems(nextItems);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (cancelled) return;
        setItems([]);
        setLoadError("Unable to load items right now.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = (query.trim().length === 0 ? "" : debouncedQuery).trim().toLowerCase();
    const list = typedItems;

    return list.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.hsnSac.toLowerCase().includes(normalizedQuery) ||
        item.unit.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.variantSkus.some((sku) => sku.toLowerCase().includes(normalizedQuery));

      const matchesStatus = includeInactive || item.isActive;

      return matchesQuery && matchesStatus;
    });
  }, [debouncedQuery, includeInactive, query, typedItems]);

  const isLoading = activeStore ? loading : false;
  const visibleLoadError = activeStore ? loadError : null;

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Browse, filter, and expand variants for catalog {title.toLowerCase()}.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => navigate(`${routeBasePath}/new`)}
            >
              Add {singularLabel}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">
              Filters
            </legend>
            <p className="app-filter-help">
              Refine {title.toLowerCase()} by search text and active status.
            </p>
            <Label htmlFor="items-search" className="text-[11px] font-medium lg:text-[10px]">
              Search {title.toLowerCase()}
            </Label>
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
            {isLoading ? (
              <div className="card text-sm text-muted-foreground">Loading items...</div>
            ) : visibleLoadError ? (
              <div className="card text-sm text-red-600">{visibleLoadError}</div>
            ) : typedItems.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No {title.toLowerCase()} available.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No {title.toLowerCase()} match your current filters.
              </div>
            ) : (
              <ItemVariantFlatTable
                items={filteredItems}
                activeStore={activeStore}
                showUnit
                taxCodeLabel={itemType === "SERVICE" ? "SAC" : "HSN"}
                showCommercialFields
                showPurchasePrice={itemType !== "SERVICE"}
                actionLabel="View"
                onOpenItem={(itemId) => navigate(`${routeBasePath}/${itemId}`)}
              />
            )}
          </div>
        </CardContent>
      </Card>
      <div className="fixed bottom-[5.25rem] right-3 z-30 lg:hidden">
        <Button
          type="button"
          size="sm"
          className="h-10 px-4 shadow-sm"
          onClick={() => navigate(`${routeBasePath}/new`)}
        >
          Add {singularLabel}
        </Button>
      </div>
    </section>
  );
}
