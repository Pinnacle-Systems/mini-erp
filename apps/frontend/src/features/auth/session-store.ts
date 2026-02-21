import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const STORE_CONTEXT_KEY = "mini_erp_store_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
};

export type Role = "USER" | "PLATFORM_ADMIN" | null;

type SessionState = {
  identityId: string | null;
  role: Role;
  isHydratingSession: boolean;
  stores: AssignedStore[];
  activeStore: string | null;
  isStoreSelected: boolean;
};

type SessionActions = {
  setHydratingSession: (value: boolean) => void;
  setUnauthenticated: () => void;
  setAdminSession: (identityId: string) => void;
  setUserSession: (payload: {
    identityId: string;
    stores: AssignedStore[];
    activeStore: string | null;
    isStoreSelected: boolean;
  }) => void;
  setActiveStore: (storeId: string | null) => void;
  setIsStoreSelected: (value: boolean) => void;
  clearSession: () => void;
};

const initialState: SessionState = {
  identityId: null,
  role: null,
  isHydratingSession: true,
  stores: [],
  activeStore: null,
  isStoreSelected: false,
};

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      ...initialState,
      setHydratingSession: (value) => {
        set({ isHydratingSession: value });
      },
      setUnauthenticated: () => {
        set({
          identityId: null,
          role: null,
          stores: [],
          activeStore: null,
          isStoreSelected: false,
        });
      },
      setAdminSession: (identityId) => {
        set({
          identityId,
          role: "PLATFORM_ADMIN",
          stores: [],
          activeStore: null,
          isStoreSelected: false,
        });
      },
      setUserSession: ({ identityId, stores, activeStore, isStoreSelected }) => {
        set({
          identityId,
          role: "USER",
          stores,
          activeStore,
          isStoreSelected,
        });
      },
      setActiveStore: (storeId) => {
        set({ activeStore: storeId });
      },
      setIsStoreSelected: (value) => {
        set({ isStoreSelected: value });
      },
      clearSession: () => {
        set({
          identityId: null,
          role: null,
          stores: [],
          activeStore: null,
          isStoreSelected: false,
          isHydratingSession: false,
        });
      },
    }),
    {
      name: STORE_CONTEXT_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        stores: state.stores,
        activeStore: state.activeStore,
      }),
    },
  ),
);

export const setAssignedStores = (stores: AssignedStore[]) => {
  useSessionStore.setState((state) => {
    const active =
      stores.find((store) => store.id === state.activeStore) ?? null;
    return {
      stores,
      activeStore: active?.id ?? null,
    };
  });
};

export const setPersistedActiveStore = (storeId: string) => {
  useSessionStore.getState().setActiveStore(storeId);
};

export const clearSessionStoreContext = () => {
  useSessionStore.setState({
    stores: [],
    activeStore: null,
    isStoreSelected: false,
  });
};
