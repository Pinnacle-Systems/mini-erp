import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSessionStore } from "../auth/session-business";
import { useUserAppStore } from "./user-app-business";
import { getLocalItemLabels, queueItemCreate, syncOnce } from "./engine";

type SyncContextValue = {
  loading: boolean;
  lastSyncError: string | null;
  clearSyncError: () => void;
  onQueueItemCreate: () => Promise<void>;
  onSyncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const toUserSyncErrorMessage = (error: unknown) => {
  const fallback = "Sync failed. Please try again.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message || "";
  if (message.includes("Version conflict for item_price")) {
    return "You made an offline pricing update that was rejected because the server had a newer change.";
  }
  return message || fallback;
};

type SyncProviderProps = {
  children: ReactNode;
};

export function SyncProvider({ children }: SyncProviderProps) {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const clearDraft = useUserAppStore((state) => state.clearDraft);
  const [loading, setLoading] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (tenantId: string) => {
      const items = await getLocalItemLabels(tenantId);
      setLocalItems(items);
    },
    [setLocalItems],
  );

  const onQueueItemCreate = useCallback(async () => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    if (!sku || !name) return;

    setLoading(true);
    try {
      await queueItemCreate(activeStore, identityId, {
        name,
        unit: "PCS",
        itemType: "PRODUCT",
        variants: [
          {
            sku,
          },
        ],
      });
      clearDraft();
    } catch (error) {
      console.error(error);
      setLastSyncError(toUserSyncErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeStore, clearDraft, identityId, isBusinessSelected, name, sku]);

  const onSyncNow = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      await syncOnce(activeStore);
      setLastSyncError(null);
      await loadItems(activeStore);
    } catch (error) {
      console.error(error);
      setLastSyncError(toUserSyncErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeStore, isBusinessSelected, loadItems]);

  useEffect(() => {
    if (!activeStore || role !== "USER" || !isBusinessSelected) return;

    let cancelled = false;

    void syncOnce(activeStore)
      .then(() => {
        if (cancelled) return;
        setLastSyncError(null);
        return loadItems(activeStore);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          setLastSyncError(toUserSyncErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected, loadItems, role]);

  useEffect(() => {
    if (!activeStore || role !== "USER" || !isBusinessSelected) return;

    const interval = window.setInterval(() => {
      void syncOnce(activeStore)
        .then(() => {
          setLastSyncError(null);
          return loadItems(activeStore);
        })
        .catch((error: unknown) => {
          console.error(error);
          setLastSyncError(toUserSyncErrorMessage(error));
        });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeStore, isBusinessSelected, loadItems, role]);

  return (
    <SyncContext.Provider
      value={{
        loading,
        lastSyncError,
        clearSyncError: () => setLastSyncError(null),
        onQueueItemCreate,
        onSyncNow,
      }}
    >
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
