import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSessionStore } from "../auth/session-store";
import { useUserAppStore } from "./user-app-store";
import { getLocalProducts, queueProductCreate, syncOnce } from "./engine";

type SyncContextValue = {
  loading: boolean;
  onQueueProductCreate: () => Promise<void>;
  onSyncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

type SyncProviderProps = {
  children: ReactNode;
};

export function SyncProvider({ children }: SyncProviderProps) {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const description = useUserAppStore((state) => state.description);
  const setLocalProducts = useUserAppStore((state) => state.setLocalProducts);
  const clearDraft = useUserAppStore((state) => state.clearDraft);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(
    async (tenantId: string) => {
      const items = await getLocalProducts(tenantId);
      setLocalProducts(
        items
          .filter((item) => !item.deletedAt)
          .map(
            (item) =>
              `${String(item.data.sku ?? "")}: ${String(item.data.name ?? "")}`,
          ),
      );
    },
    [setLocalProducts],
  );

  const onQueueProductCreate = useCallback(async () => {
    if (!activeStore || !identityId || !isStoreSelected) return;
    if (!sku || !name) return;

    setLoading(true);
    try {
      await queueProductCreate(activeStore, identityId, {
        sku,
        name,
        description,
        unit: "PCS",
      });
      clearDraft();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeStore, clearDraft, description, identityId, isStoreSelected, name, sku]);

  const onSyncNow = useCallback(async () => {
    if (!activeStore || !isStoreSelected) return;

    setLoading(true);
    try {
      await syncOnce(activeStore);
      await loadProducts(activeStore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeStore, isStoreSelected, loadProducts]);

  useEffect(() => {
    if (!activeStore || role !== "USER" || !isStoreSelected) return;

    const interval = window.setInterval(() => {
      void syncOnce(activeStore)
        .then(() => loadProducts(activeStore))
        .catch((error: unknown) => {
          console.error(error);
        });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeStore, isStoreSelected, loadProducts, role]);

  return (
    <SyncContext.Provider value={{ loading, onQueueProductCreate, onSyncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncActions() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncActions must be used within SyncProvider");
  }
  return context;
}
