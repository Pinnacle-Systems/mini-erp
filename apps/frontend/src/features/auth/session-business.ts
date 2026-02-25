import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const BUSINESS_CONTEXT_KEY = "mini_erp_business_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
  license?: {
    beginsOn: string;
    endsOn: string;
    bundleKey: "SALES_LITE" | "SALES_STOCK_OUT" | "TRADING" | "SERVICE_BILLING" | "CUSTOM";
    addOnCapabilities: Array<
      | "ITEM_PRODUCTS"
      | "ITEM_SERVICES"
      | "PARTIES_CUSTOMERS"
      | "PARTIES_SUPPLIERS"
      | "TXN_SALE_CREATE"
      | "TXN_SALE_RETURN"
      | "TXN_PURCHASE_CREATE"
      | "TXN_PURCHASE_RETURN"
      | "INV_STOCK_OUT"
      | "INV_STOCK_IN"
      | "INV_ADJUSTMENT"
      | "INV_TRANSFER"
      | "FINANCE_RECEIVABLES"
      | "FINANCE_PAYABLES"
    >;
    removedCapabilities: Array<
      | "ITEM_PRODUCTS"
      | "ITEM_SERVICES"
      | "PARTIES_CUSTOMERS"
      | "PARTIES_SUPPLIERS"
      | "TXN_SALE_CREATE"
      | "TXN_SALE_RETURN"
      | "TXN_PURCHASE_CREATE"
      | "TXN_PURCHASE_RETURN"
      | "INV_STOCK_OUT"
      | "INV_STOCK_IN"
      | "INV_ADJUSTMENT"
      | "INV_TRANSFER"
      | "FINANCE_RECEIVABLES"
      | "FINANCE_PAYABLES"
    >;
    userLimitType: "MAX_USERS" | "MAX_CONCURRENT_USERS" | null;
    userLimitValue: number | null;
    fetchedAt: string;
  } | null;
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
  pendingOnlineLicenseValidationByStore: Record<string, boolean>;
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
  setStoreNeedsOnlineLicenseValidation: (businessId: string, needsValidation: boolean) => void;
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
  pendingOnlineLicenseValidationByStore: {},
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
          pendingOnlineLicenseValidationByStore: {},
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
          pendingOnlineLicenseValidationByStore: {},
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
            pendingOnlineLicenseValidationByStore:
              state.pendingOnlineLicenseValidationByStore,
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
      setStoreNeedsOnlineLicenseValidation: (businessId, needsValidation) => {
        set((state) => ({
          pendingOnlineLicenseValidationByStore: {
            ...state.pendingOnlineLicenseValidationByStore,
            [businessId]: needsValidation,
          },
        }));
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
          pendingOnlineLicenseValidationByStore: {},
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
        pendingOnlineLicenseValidationByStore: state.pendingOnlineLicenseValidationByStore,
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
    const filteredPendingValidationByStore = Object.fromEntries(
      Object.entries(state.pendingOnlineLicenseValidationByStore).filter(([businessId]) =>
        allowedBusinessIds.has(businessId),
      ),
    ) as Record<string, boolean>;
    const nowIso = new Date().toISOString();
    const normalizedBusinesses = businesses.map((business) => ({
      ...business,
      license: business.license
        ? {
            ...business.license,
            fetchedAt: business.license.fetchedAt || nowIso,
          }
        : null,
    }));

    return {
      businesses: normalizedBusinesses,
      activeStore: active?.id ?? null,
      activeBusinessModules: active?.id ? filteredModulesById[active.id] ?? null : null,
      businessModulesById: filteredModulesById,
      pendingOnlineLicenseValidationByStore: filteredPendingValidationByStore,
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
    pendingOnlineLicenseValidationByStore: {},
    isBusinessSelected: false,
  });
};
