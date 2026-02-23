import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import { useSessionStore } from "../features/auth/session-store";
import {
  getLocalItemsForDisplay,
  type ItemDisplay,
} from "../features/sync/engine";

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

  useEffect(() => {
    if (!activeStore) {
      setItems([]);
      return;
    }

    void getLocalItemsForDisplay(activeStore).then((nextItems) => {
      setItems(nextItems);
    });
  }, [activeStore]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.variantSkus.some((sku) => sku.toLowerCase().includes(normalizedQuery));

      const matchesVariants =
        variantFilter === "all" ||
        (variantFilter === "single-variant" && item.variantCount <= 1) ||
        (variantFilter === "multi-variant" && item.variantCount > 1);

      return matchesQuery && matchesVariants;
    });
  }, [items, query, variantFilter]);

  return (
    <main className="min-h-screen w-full space-y-6 p-4 sm:p-6 lg:p-8 xl:p-10">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
            Items
          </h1>
        </div>
        <Button type="button" size="sm" onClick={() => navigate("/app/items/new")}>
          Add Item
        </Button>
      </section>

      <section>
        <div className="mb-4 grid gap-3 rounded-2xl border border-white/65 bg-white/55 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="items-search" className="block">
              Search
            </Label>
            <Input
              id="items-search"
              className={DENSE_INPUT_CLASS}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or SKU"
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

        {items.length === 0 ? (
          <div className="card text-sm text-muted-foreground">No items available.</div>
        ) : filteredItems.length === 0 ? (
          <div className="card text-sm text-muted-foreground">
            No items match your current filters.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredItems.map((item) => (
              <li
                key={item.entityId}
                className="card space-y-1.5 transition hover:border-accent/50 hover:bg-white/75 cursor-pointer"
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
                  {item.pending ? " (Pending)" : ""}
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
        )}
      </section>
    </main>
  );
}
