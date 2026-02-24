import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const BUSINESS_CONTEXT_KEY = "mini_erp_business_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
};

export type BusinessModules = {
  catalog: boolean;
  inventory: boolean;
  pricing: boolean;
};

export type Role = "USER" | "PLATFORM_ADMIN" | null;

type SessionState = {
  identityId: string | null;
  role: Role;
  isHydratingSession: boolean;
  businesses: AssignedStore[];
  activeStore: string | null;
  activeBusinessModules: BusinessModules | null;
  businessModulesById: Record<string, BusinessModules>;
  isBusinessSelected: boolean;
};

type SessionActions = {
  setHydratingSession: (value: boolean) => void;
  setUnauthenticated: () => void;
  setAdminSession: (identityId: string) => void;
  setUserSession: (payload: {
    identityId: string;
    businesses: AssignedStore[];
    activeStore: string | null;
    activeBusinessModules?: BusinessModules | null;
    isBusinessSelected: boolean;
  }) => void;
  setActiveStore: (businessId: string | null) => void;
  setActiveBusinessModules: (modules: BusinessModules | null) => void;
  setIsBusinessSelected: (value: boolean) => void;
  clearSession: () => void;
};

const initialState: SessionState = {
  identityId: null,
  role: null,
  isHydratingSession: true,
  businesses: [],
  activeStore: null,
  activeBusinessModules: null,
  businessModulesById: {},
  isBusinessSelected: false,
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
          businesses: [],
          activeStore: null,
          activeBusinessModules: null,
          businessModulesById: {},
          isBusinessSelected: false,
        });
      },
      setAdminSession: (identityId) => {
        set({
          identityId,
          role: "PLATFORM_ADMIN",
          businesses: [],
          activeStore: null,
          activeBusinessModules: null,
          businessModulesById: {},
          isBusinessSelected: false,
        });
      },
      setUserSession: ({ identityId, businesses, activeStore, activeBusinessModules, isBusinessSelected }) => {
        set((state) => {
          const nextModulesById = { ...state.businessModulesById };
          if (activeStore && activeBusinessModules) {
            nextModulesById[activeStore] = activeBusinessModules;
          }

          return {
            identityId,
            role: "USER",
            businesses,
            activeStore,
            activeBusinessModules:
              activeStore && nextModulesById[activeStore]
                ? nextModulesById[activeStore]
                : activeBusinessModules ?? null,
            businessModulesById: nextModulesById,
            isBusinessSelected,
          };
        });
      },
      setActiveStore: (businessId) => {
        set((state) => ({
          activeStore: businessId,
          activeBusinessModules: businessId ? state.businessModulesById[businessId] ?? null : null,
        }));
      },
      setActiveBusinessModules: (modules) => {
        set((state) => {
          const nextModulesById = { ...state.businessModulesById };
          if (state.activeStore && modules) {
            nextModulesById[state.activeStore] = modules;
          }
          return {
            activeBusinessModules: modules,
            businessModulesById: nextModulesById,
          };
        });
      },
      setIsBusinessSelected: (value) => {
        set({ isBusinessSelected: value });
      },
      clearSession: () => {
        set({
          identityId: null,
          role: null,
          businesses: [],
          activeStore: null,
          activeBusinessModules: null,
          businessModulesById: {},
          isBusinessSelected: false,
          isHydratingSession: false,
        });
      },
    }),
    {
      name: BUSINESS_CONTEXT_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        identityId: state.identityId,
        role: state.role,
        businesses: state.businesses,
        activeStore: state.activeStore,
        activeBusinessModules: state.activeBusinessModules,
        businessModulesById: state.businessModulesById,
        isBusinessSelected: state.isBusinessSelected,
      }),
    },
  ),
);

export const setAssignedStores = (businesses: AssignedStore[]) => {
  useSessionStore.setState((state) => {
    const active =
      businesses.find((business) => business.id === state.activeStore) ?? null;
    const allowedBusinessIds = new Set(businesses.map((business) => business.id));
    const filteredModulesById = Object.fromEntries(
      Object.entries(state.businessModulesById).filter(([businessId]) =>
        allowedBusinessIds.has(businessId),
      ),
    ) as Record<string, BusinessModules>;

    return {
      businesses,
      activeStore: active?.id ?? null,
      activeBusinessModules: active?.id ? filteredModulesById[active.id] ?? null : null,
      businessModulesById: filteredModulesById,
    };
  });
};

export const setPersistedActiveStore = (businessId: string) => {
  useSessionStore.getState().setActiveStore(businessId);
};

export const clearSessionBusinessContext = () => {
  useSessionStore.setState({
    businesses: [],
    activeStore: null,
    activeBusinessModules: null,
    businessModulesById: {},
    isBusinessSelected: false,
  });
};
