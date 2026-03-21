import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const BUSINESS_CONTEXT_KEY = "mini_erp_business_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
  defaultLocationId: string | null;
  locations: Array<{
    id: string;
    name: string;
    isDefault: boolean;
  }>;
  license?: {
    beginsOn: string;
    endsOn: string;
    bundleKey: "SALES_LITE" | "SALES_STOCK_OUT" | "TRADING" | "SERVICE_BILLING" | "CUSTOM";
    addOnCapabilities: Array<
      | "BUSINESS_LOCATIONS"
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
      | "BUSINESS_LOCATIONS"
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
  purchases: boolean;
  sales: boolean;
  pricing: boolean;
};

type SessionLicense = NonNullable<AssignedStore["license"]>;

export type BusinessCapability = SessionLicense["addOnCapabilities"][number];

const BUNDLE_CAPABILITY_MAP: Record<SessionLicense["bundleKey"], BusinessCapability[]> = {
  SALES_LITE: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  SALES_STOCK_OUT: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "INV_STOCK_OUT",
    "FINANCE_RECEIVABLES",
  ],
  TRADING: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "PARTIES_SUPPLIERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "TXN_PURCHASE_CREATE",
    "TXN_PURCHASE_RETURN",
    "INV_STOCK_OUT",
    "INV_STOCK_IN",
    "INV_ADJUSTMENT",
    "INV_TRANSFER",
    "FINANCE_RECEIVABLES",
    "FINANCE_PAYABLES",
  ],
  SERVICE_BILLING: [
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  CUSTOM: [],
};

export const hasAssignedStoreCapability = (
  store: AssignedStore | null | undefined,
  capability: BusinessCapability,
) => {
  const license = store?.license;
  if (!license) {
    return false;
  }

  const effective = new Set<BusinessCapability>(BUNDLE_CAPABILITY_MAP[license.bundleKey]);
  for (const key of license.addOnCapabilities) effective.add(key);
  for (const key of license.removedCapabilities) effective.delete(key);
  return effective.has(capability);
};

export type Role = "USER" | "PLATFORM_ADMIN" | null;

type SessionState = {
  identityId: string | null;
  role: Role;
  isHydratingSession: boolean;
  businesses: AssignedStore[];
  activeStore: string | null;
  activeLocationId: string | null;
  activeLocationByStore: Record<string, string | null>;
  activeMemberRole: "OWNER" | "MANAGER" | "CASHIER" | null;
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
    activeLocationId?: string | null;
    activeMemberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
    activeBusinessModules?: BusinessModules | null;
    isBusinessSelected: boolean;
  }) => void;
  setActiveStore: (businessId: string | null) => void;
  setActiveLocation: (businessId: string, locationId: string | null) => void;
  setActiveMemberRole: (role: "OWNER" | "MANAGER" | "CASHIER" | null) => void;
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
  activeLocationId: null,
  activeLocationByStore: {},
  activeMemberRole: null,
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
          activeLocationId: null,
          activeLocationByStore: {},
          activeMemberRole: null,
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
          activeLocationId: null,
          activeLocationByStore: {},
          activeMemberRole: null,
          activeBusinessModules: null,
          businessModulesById: {},
          pendingOnlineLicenseValidationByStore: {},
          isBusinessSelected: false,
        });
      },
      setUserSession: ({
        identityId,
        businesses,
        activeStore,
        activeLocationId,
        activeMemberRole,
        activeBusinessModules,
        isBusinessSelected,
      }) => {
        set((state) => {
          const nextModulesById = { ...state.businessModulesById };
          const nextLocationsByStore = { ...state.activeLocationByStore };
          if (activeStore && activeBusinessModules) {
            nextModulesById[activeStore] = activeBusinessModules;
          }
          if (activeStore) {
            const activeBusiness =
              businesses.find((business) => business.id === activeStore) ?? null;
            nextLocationsByStore[activeStore] =
              activeLocationId ??
              nextLocationsByStore[activeStore] ??
              activeBusiness?.defaultLocationId ??
              null;
          }

          return {
            identityId,
            role: "USER",
            businesses,
            activeStore,
            activeLocationId: activeStore
              ? nextLocationsByStore[activeStore] ?? null
              : null,
            activeLocationByStore: nextLocationsByStore,
            activeMemberRole: activeMemberRole ?? null,
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
          activeLocationId: businessId
            ? state.activeLocationByStore[businessId] ??
              state.businesses.find((business) => business.id === businessId)?.defaultLocationId ??
              null
            : null,
          activeBusinessModules: businessId ? state.businessModulesById[businessId] ?? null : null,
        }));
      },
      setActiveLocation: (businessId, locationId) => {
        set((state) => ({
          activeLocationId: state.activeStore === businessId ? locationId : state.activeLocationId,
          activeLocationByStore: {
            ...state.activeLocationByStore,
            [businessId]: locationId,
          },
        }));
      },
      setActiveMemberRole: (role) => {
        set({ activeMemberRole: role });
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
          activeLocationId: null,
          activeLocationByStore: {},
          activeMemberRole: null,
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
        activeLocationId: state.activeLocationId,
        activeLocationByStore: state.activeLocationByStore,
        activeMemberRole: state.activeMemberRole,
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
      defaultLocationId: business.defaultLocationId ?? null,
      locations: business.locations ?? [],
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
      activeLocationId: active?.id
        ? state.activeLocationByStore[active.id] ?? active.defaultLocationId ?? null
        : null,
      activeLocationByStore: Object.fromEntries(
        normalizedBusinesses.map((business) => [
          business.id,
          state.activeLocationByStore[business.id] ?? business.defaultLocationId ?? null,
        ]),
      ) as Record<string, string | null>,
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
    activeLocationId: null,
    activeLocationByStore: {},
    activeMemberRole: null,
    activeBusinessModules: null,
    businessModulesById: {},
    pendingOnlineLicenseValidationByStore: {},
    isBusinessSelected: false,
  });
};
