import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { useUserAppStore } from "../features/sync/user-app-store";
import { useSessionStore } from "../features/auth/session-store";
import { getLocalItems } from "../features/sync/engine";

export function ItemsPage() {
  const navigate = useNavigate();
  const localItems = useUserAppStore((state) => state.localItems);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const activeStore = useSessionStore((state) => state.activeStore);
  const stores = useSessionStore((state) => state.stores);
  const activeStoreName = useMemo(
    () =>
      stores.find((store) => store.id === activeStore)?.name ??
      "No store selected",
    [activeStore, stores],
  );

  useEffect(() => {
    if (!activeStore) {
      setLocalItems([]);
      return;
    }

    void getLocalItems(activeStore).then((items) => {
      setLocalItems(
        items
          .filter((item) => !item.deletedAt)
          .map((item) => `${String(item.data.sku ?? "")}: ${String(item.data.name ?? "")}`),
      );
    });
  }, [activeStore, setLocalItems]);

  return (
    <main className="min-h-screen w-full space-y-6 p-4 sm:p-6 md:p-10">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
            Items
          </h1>
          <p className="text-sm text-muted-foreground">
            Store: <span className="font-medium text-foreground">{activeStoreName}</span>
          </p>
        </div>
        <Button type="button" onClick={() => navigate("/app/items/new")}>
          Add Item
        </Button>
      </section>

      <section className="card">
        <p className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
          Local items
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground">
          {localItems.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-white/80 bg-white/65 px-3 py-2"
            >
              {item}
            </li>
          ))}
          {localItems.length === 0 ? (
            <li className="text-muted-foreground">No items available.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
