import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSessionStore } from "../auth/session-business";
import { useToast } from "../toast/useToast";
import { useUserAppStore } from "./user-app-business";
import {
  type SyncResultRecord,
  getLocalItemLabels,
  getSyncRejectionFromError,
  queueItemCreate,
  SyncHttpError,
  syncOnce,
} from "./engine";

type SyncContextValue = {
  loading: boolean;
  lastSyncCompletedAt: number | null;
  onQueueItemCreate: () => Promise<void>;
  onSyncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const toUserSyncErrorMessage = (error: unknown) => {
  const fallback = "Sync failed. Please try again.";
  const rejection = getSyncRejectionFromError(error);
  if (
    rejection?.reasonCode === "VERSION_CONFLICT" &&
    rejection.entity === "item_price"
  ) {
    return "You made an offline pricing update that was rejected because the server had a newer change.";
  }
  if (rejection) {
    return rejection.message || fallback;
  }
  if (!(error instanceof Error)) return fallback;
  const message = error.message || "";
  return message || fallback;
};

const toPermanentSyncToast = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection) {
    return {
      title: "Sync update rejected",
      description: toUserSyncErrorMessage(error),
      dedupeKey: `sync-rejection:${rejection.reasonCode}:${rejection.entity}:${rejection.entityId}`,
      durationMs: 5000,
    };
  }

  if (error instanceof SyncHttpError && error.status === 401) {
    return {
      title: "Sync needs sign-in",
      description: "Session refresh did not recover sync. Sign in again if this keeps happening.",
      dedupeKey: "sync-auth-401",
      durationMs: 7000,
    };
  }

  if (error instanceof SyncHttpError) {
    return {
      title: "Sync failed",
      description: toUserSyncErrorMessage(error),
      dedupeKey: `sync-http:${error.operation}:${error.status}`,
      durationMs: 5000,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Sync failed",
      description: toUserSyncErrorMessage(error),
      dedupeKey: `sync-error:${error.message}`,
      durationMs: 5000,
    };
  }

  return {
    title: "Sync failed",
    description: "Please try again.",
    dedupeKey: "sync-error:unknown",
    durationMs: 5000,
  };
};

const getToastableAppliedResults = (results: SyncResultRecord[]) =>
  results.filter(
    (result) =>
      result.resultStatus === "applied" &&
      Boolean(result.outcome) &&
      ((result.outcome?.archived.length ?? 0) > 0 || (result.outcome?.purged.length ?? 0) > 0),
  );

type SyncProviderProps = {
  children: ReactNode;
};

export function SyncProvider({ children }: SyncProviderProps) {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const isHydratingSession = useSessionStore((state) => state.isHydratingSession);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const clearDraft = useUserAppStore((state) => state.clearDraft);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastSyncCompletedAt, setLastSyncCompletedAt] = useState<number | null>(null);

  const reportSyncError = useCallback(
    (error: unknown) => {
      if (isHydratingSession) {
        return;
      }

      if (error instanceof SyncHttpError && error.status === 401 && !identityId) {
        return;
      }

      const toast = toPermanentSyncToast(error);
      showToast({
        title: toast.title,
        description: toast.description,
        tone: "error",
        dedupeKey: toast.dedupeKey,
        durationMs: toast.durationMs,
      });
    },
    [identityId, isHydratingSession, showToast],
  );

  const reportAppliedSyncResults = useCallback(
    (results: SyncResultRecord[]) => {
      for (const result of getToastableAppliedResults(results)) {
        showToast({
          title:
            result.outcome?.category === "hybrid_delete"
              ? "Delete completed"
              : "Sync update applied",
          description: result.summary,
          tone: "success",
          dedupeKey: `sync-result:${result.mutationId}`,
          durationMs: 5000,
        });
      }
    },
    [showToast],
  );

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
      reportSyncError(error);
    } finally {
      setLoading(false);
    }
  }, [activeStore, clearDraft, identityId, isBusinessSelected, name, reportSyncError, sku]);

  const onSyncNow = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      const result = await syncOnce(activeStore);
      setLastSyncCompletedAt(Date.now());
      reportAppliedSyncResults(result?.appliedResults ?? []);
      await loadItems(activeStore);
    } catch (error) {
      console.error(error);
      reportSyncError(error);
    } finally {
      setLoading(false);
    }
  }, [activeStore, isBusinessSelected, loadItems, reportAppliedSyncResults, reportSyncError]);

  useEffect(() => {
    if (!activeStore || role !== "USER" || !isBusinessSelected || isHydratingSession) return;

    let cancelled = false;

    void syncOnce(activeStore)
      .then((result) => {
        if (cancelled) return;
        setLastSyncCompletedAt(Date.now());
        reportAppliedSyncResults(result?.appliedResults ?? []);
        return loadItems(activeStore);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          reportSyncError(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected, isHydratingSession, loadItems, reportAppliedSyncResults, reportSyncError, role]);

  useEffect(() => {
    if (!activeStore || role !== "USER" || !isBusinessSelected || isHydratingSession) return;

    const interval = window.setInterval(() => {
      void syncOnce(activeStore)
        .then((result) => {
          setLastSyncCompletedAt(Date.now());
          reportAppliedSyncResults(result?.appliedResults ?? []);
          return loadItems(activeStore);
        })
        .catch((error: unknown) => {
          console.error(error);
          reportSyncError(error);
        });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeStore, isBusinessSelected, isHydratingSession, loadItems, reportAppliedSyncResults, reportSyncError, role]);

  return (
    <SyncContext.Provider
      value={{
        loading,
        lastSyncCompletedAt,
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
