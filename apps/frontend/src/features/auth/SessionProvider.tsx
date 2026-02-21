import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { getMe, type MePayload } from "./client";
import { useSessionStore } from "./session-store";
import { getLocalProducts } from "../sync/engine";
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
  const setLocalProducts = useUserAppStore((state) => state.setLocalProducts);
  const resetUserAppState = useUserAppStore((state) => state.resetUserAppState);

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
        await loadProducts(selected);
      } else {
        setLocalProducts([]);
      }

      return me;
    } catch {
      setUnauthenticated();
      return null;
    }
  }, [
    loadProducts,
    resetUserAppState,
    setAdminSession,
    setLocalProducts,
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
