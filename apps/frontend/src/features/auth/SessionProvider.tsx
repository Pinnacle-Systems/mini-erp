import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { getMe, type MePayload } from "./client";
import { useSessionStore } from "./session-business";
import { getLocalItemLabels } from "../sync/engine";
import { useUserAppStore } from "../sync/user-app-business";

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
      const items = await getLocalItemLabels(tenantId);
      setLocalItems(items);
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

      const fallbackStores = useSessionStore.getState().businesses;
      const cachedSession = useSessionStore.getState();
      const businesses = me.businesses ?? fallbackStores;
      const cachedActiveStore =
        cachedSession.activeStore &&
        businesses.some((business) => business.id === cachedSession.activeStore)
          ? cachedSession.activeStore
          : null;
      const cachedStoreNeedsValidation = cachedActiveStore
        ? cachedSession.pendingOnlineLicenseValidationByStore[cachedActiveStore] === true
        : false;
      const selected =
        cachedStoreNeedsValidation
          ? cachedActiveStore
          : me.tenantId ?? cachedActiveStore ?? null;
      const selectedModules =
        me.modules ??
        (selected ? cachedSession.businessModulesById[selected] ?? null : null);
      setUserSession({
        identityId: me.identityId,
        businesses,
        activeStore: selected,
        activeBusinessModules: selectedModules,
        isBusinessSelected: Boolean(selected),
      });

      if (selected) {
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
        if (cachedSession.activeStore && cachedSession.isBusinessSelected) {
          await loadItems(cachedSession.activeStore);
        } else {
          setLocalItems([]);
        }
        return {
          success: true,
          role: cachedSession.role,
          identityId: cachedSession.identityId,
          tenantId: cachedSession.activeStore,
          businesses: cachedSession.businesses,
          modules: cachedSession.activeBusinessModules,
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
