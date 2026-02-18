"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearPendingStoreSelection,
  getAssignedStores,
  queuePendingStoreSelection,
  setActiveStore,
  setAssignedStores,
} from "@/features/auth/client/store-context";

type Store = {
  id: string;
  name: string;
};

type StoresResponse = {
  success: boolean;
  message?: string;
  stores?: Store[];
};

type SelectionResponse = {
  success: boolean;
  message?: string;
};

export default function StoreSelectionPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectingStoreId, setIsSelectingStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadStores = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!window.navigator.onLine) {
          if (active) {
            setStores(getAssignedStores());
          }
          return;
        }

        const response = await fetch("/api/auth/stores", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        const payload = (await response.json()) as StoresResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? "Unable to load assigned stores.");
        }

        if (active) {
          const assignedStores = payload.stores ?? [];
          setStores(assignedStores);
          setAssignedStores(assignedStores);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load assigned stores.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadStores();

    return () => {
      active = false;
    };
  }, []);

  const handleSelectStore = async (storeId: string) => {
    if (isSelectingStoreId) {
      return;
    }

    setIsSelectingStoreId(storeId);
    setError(null);

    const selectedStore = stores.find((store) => store.id === storeId);

    if (!window.navigator.onLine) {
      setActiveStore(storeId, selectedStore?.name ?? null);
      queuePendingStoreSelection(storeId);
      router.replace("/");
      router.refresh();
      return;
    }

    try {
      const response = await fetch("/api/auth/store-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId }),
      });

      const payload = (await response.json()) as SelectionResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to select store.");
      }

      setActiveStore(storeId, selectedStore?.name ?? null);
      clearPendingStoreSelection();
      router.replace("/");
      router.refresh();
    } catch (selectionError) {
      const message =
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to select store.";
      setError(message);
    } finally {
      setIsSelectingStoreId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold tracking-tight">Select Store</h1>
        <p className="mt-2 text-sm text-slate-600">Loading assigned stores...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-xl font-semibold tracking-tight">Select Store</h1>
      <p className="mt-1 text-sm text-slate-600">
        Choose the store you want to work in for this session.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {stores.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No stores are assigned to your account yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => void handleSelectStore(store.id)}
              disabled={Boolean(isSelectingStoreId)}
              className="flex h-11 items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{store.name}</span>
              <span className="text-xs text-slate-500">
                {isSelectingStoreId === store.id ? "Selecting..." : "Select"}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
