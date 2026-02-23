import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { useSessionStore } from "../features/auth/session-store";
import {
  getLocalItemsForDisplay,
  type ItemDisplay,
} from "../features/sync/engine";

export function ItemsPage() {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);

  useEffect(() => {
    if (!activeStore) {
      setItems([]);
      return;
    }

    void getLocalItemsForDisplay(activeStore).then((nextItems) => {
      setItems(nextItems);
    });
  }, [activeStore]);

  return (
    <main className="min-h-screen w-full space-y-6 p-4 sm:p-6 md:p-10">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
            Items
          </h1>
        </div>
        <Button type="button" onClick={() => navigate("/app/items/new")}>
          Add Item
        </Button>
      </section>

      <section>
        {items.length === 0 ? (
          <div className="card text-sm text-muted-foreground">No items available.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.entityId} className="card space-y-1.5">
                <h2 className="text-base font-semibold text-foreground">
                  {item.name}
                  {item.pending ? " (Pending)" : ""}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {item.description || "No description"}
                </p>
                <p className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
                  {item.variantCount > 1
                    ? `Variants: ${item.variantCount}`
                    : `SKU: ${item.sku || "Not set"}`}
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/app/items/${item.entityId}`)}
                  >
                    Manage Variants
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
