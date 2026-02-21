import { useMemo } from "react";
import { useUserAppStore } from "../features/sync/user-app-store";
import { useSessionStore } from "../features/auth/session-store";

export function ItemsPage() {
  const localItems = useUserAppStore((state) => state.localItems);
  const activeStore = useSessionStore((state) => state.activeStore);
  const stores = useSessionStore((state) => state.stores);
  const activeStoreName = useMemo(
    () =>
      stores.find((store) => store.id === activeStore)?.name ??
      "No store selected",
    [activeStore, stores],
  );

  return (
    <main className="min-h-screen w-full space-y-6 p-4 sm:p-6 md:p-10">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
          Items
        </h1>
        <p className="text-sm text-muted-foreground">
          Store: <span className="font-medium text-foreground">{activeStoreName}</span>
        </p>
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
