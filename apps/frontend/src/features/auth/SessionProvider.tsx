import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { getMe, type MePayload } from "./client";
import { useSessionStore } from "./session-store";
import { getLocalItems } from "../sync/engine";
import { useUserAppStore } from "../sync/user-app-store";

type SessionHydrationContextValue = {
  refreshSession: () => Promise<MePayload | null>;
};

const SessionHydrationContext = createContext<SessionHydrationContextValue | null>(
  null,
);

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const setHydratingSession = useSessionStore(
    (state) => state.setHydratingSession,
  );
  const setUnauthenticated = useSessionStore((state) => state.setUnauthenticated);
  const setAdminSession = useSessionStore((state) => state.setAdminSession);
  const setUserSession = useSessionStore((state) => state.setUserSession);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const resetUserAppState = useUserAppStore((state) => state.resetUserAppState);

  const loadItems = useCallback(
    async (tenantId: string) => {
      const items = await getLocalItems(tenantId);
      setLocalItems(
        items
          .filter((item) => !item.deletedAt)
          .map(
            (item) =>
              `${String(item.data.sku ?? "")}: ${String(item.data.name ?? "")}`,
          ),
      );
    },
    [setLocalItems],
  );

  const refreshSession = useCallback(async (): Promise<MePayload | null> => {
    try {
      const me = await getMe();
      if (!me.identityId) {
        setUnauthenticated();
        return null;
      }

      if (me.role === "PLATFORM_ADMIN") {
        setAdminSession(me.identityId);
        resetUserAppState();
        return me;
      }

      const fallbackStores = useSessionStore.getState().stores;
      const stores = me.stores ?? fallbackStores;
      const selected = me.tenantId ?? null;
      setUserSession({
        identityId: me.identityId,
        stores,
        activeStore: selected,
        isStoreSelected: Boolean(me.tenantId),
      });

      if (selected && me.tenantId) {
        await loadItems(selected);
      } else {
        setLocalItems([]);
      }

      return me;
    } catch (error) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : undefined;
      const isNetworkFailure =
        !navigator.onLine || error instanceof TypeError || status === 0;
      const cachedSession = useSessionStore.getState();

      if (
        isNetworkFailure &&
        cachedSession.identityId &&
        cachedSession.role === "USER"
      ) {
        if (cachedSession.activeStore && cachedSession.isStoreSelected) {
          await loadItems(cachedSession.activeStore);
        } else {
          setLocalItems([]);
        }
        return {
          success: true,
          role: cachedSession.role,
          identityId: cachedSession.identityId,
          tenantId: cachedSession.activeStore,
          stores: cachedSession.stores,
        };
      }

      setUnauthenticated();
      return null;
    }
  }, [
    loadItems,
    resetUserAppState,
    setAdminSession,
    setLocalItems,
    setUnauthenticated,
    setUserSession,
  ]);

  useEffect(() => {
    void refreshSession().finally(() => {
      setHydratingSession(false);
    });
  }, [refreshSession, setHydratingSession]);

  return (
    <SessionHydrationContext.Provider value={{ refreshSession }}>
      {children}
    </SessionHydrationContext.Provider>
  );
}

export function useSessionHydration() {
  const context = useContext(SessionHydrationContext);
  if (!context) {
    throw new Error("useSessionHydration must be used within SessionProvider");
  }
  return context;
}
