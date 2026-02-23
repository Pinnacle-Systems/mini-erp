import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const STORE_CONTEXT_KEY = "mini_erp_store_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
};

export type StoreModules = {
  catalog: boolean;
  inventory: boolean;
  pricing: boolean;
};

export type Role = "USER" | "PLATFORM_ADMIN" | null;

type SessionState = {
  identityId: string | null;
  role: Role;
  isHydratingSession: boolean;
  stores: AssignedStore[];
  activeStore: string | null;
  activeStoreModules: StoreModules | null;
  storeModulesById: Record<string, StoreModules>;
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
    activeStoreModules?: StoreModules | null;
    isStoreSelected: boolean;
  }) => void;
  setActiveStore: (storeId: string | null) => void;
  setActiveStoreModules: (modules: StoreModules | null) => void;
  setIsStoreSelected: (value: boolean) => void;
  clearSession: () => void;
};

const initialState: SessionState = {
  identityId: null,
  role: null,
  isHydratingSession: true,
  stores: [],
  activeStore: null,
  activeStoreModules: null,
  storeModulesById: {},
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
          activeStoreModules: null,
          storeModulesById: {},
          isStoreSelected: false,
        });
      },
      setAdminSession: (identityId) => {
        set({
          identityId,
          role: "PLATFORM_ADMIN",
          stores: [],
          activeStore: null,
          activeStoreModules: null,
          storeModulesById: {},
          isStoreSelected: false,
        });
      },
      setUserSession: ({ identityId, stores, activeStore, activeStoreModules, isStoreSelected }) => {
        set((state) => {
          const nextModulesById = { ...state.storeModulesById };
          if (activeStore && activeStoreModules) {
            nextModulesById[activeStore] = activeStoreModules;
          }

          return {
            identityId,
            role: "USER",
            stores,
            activeStore,
            activeStoreModules:
              activeStore && nextModulesById[activeStore]
                ? nextModulesById[activeStore]
                : activeStoreModules ?? null,
            storeModulesById: nextModulesById,
            isStoreSelected,
          };
        });
      },
      setActiveStore: (storeId) => {
        set((state) => ({
          activeStore: storeId,
          activeStoreModules: storeId ? state.storeModulesById[storeId] ?? null : null,
        }));
      },
      setActiveStoreModules: (modules) => {
        set((state) => {
          const nextModulesById = { ...state.storeModulesById };
          if (state.activeStore && modules) {
            nextModulesById[state.activeStore] = modules;
          }
          return {
            activeStoreModules: modules,
            storeModulesById: nextModulesById,
          };
        });
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
          activeStoreModules: null,
          storeModulesById: {},
          isStoreSelected: false,
          isHydratingSession: false,
        });
      },
    }),
    {
      name: STORE_CONTEXT_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        identityId: state.identityId,
        role: state.role,
        stores: state.stores,
        activeStore: state.activeStore,
        activeStoreModules: state.activeStoreModules,
        storeModulesById: state.storeModulesById,
        isStoreSelected: state.isStoreSelected,
      }),
    },
  ),
);

export const setAssignedStores = (stores: AssignedStore[]) => {
  useSessionStore.setState((state) => {
    const active =
      stores.find((store) => store.id === state.activeStore) ?? null;
    const allowedStoreIds = new Set(stores.map((store) => store.id));
    const filteredModulesById = Object.fromEntries(
      Object.entries(state.storeModulesById).filter(([storeId]) =>
        allowedStoreIds.has(storeId),
      ),
    ) as Record<string, StoreModules>;

    return {
      stores,
      activeStore: active?.id ?? null,
      activeStoreModules: active?.id ? filteredModulesById[active.id] ?? null : null,
      storeModulesById: filteredModulesById,
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
    activeStoreModules: null,
    storeModulesById: {},
    isStoreSelected: false,
  });
};
