import { create } from "zustand";
import type {
  AdminStore,
  AdminBusinessesPagination,
  BundleKey,
  CapabilityKey,
} from "./businesses";

type AdminBusinessesState = {
  businesses: AdminStore[];
  page: number;
  pagination: AdminBusinessesPagination;
  filterBusinessName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  error: string | null;
  newBusinessName: string;
  newOwnerPhone: string;
  newPhoneNumber: string;
  newGstin: string;
  newEmail: string;
  newBusinessType: string;
  newBusinessCategory: string;
  newState: string;
  newPincode: string;
  newAddress: string;
  newLogo: string;
  newLicenseBeginsOn: string;
  newLicenseEndsOn: string;
  newLicenseBundleKey: BundleKey;
  newLicenseAddOnCapabilities: CapabilityKey[];
  newLicenseRemovedCapabilities: CapabilityKey[];
  newLicenseUserLimitType: "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS";
  newLicenseUserLimitValue: string;
};

type AdminBusinessesActions = {
  setBusinessesPage: (payload: {
    businesses: AdminStore[];
    pagination: AdminBusinessesPagination;
  }) => void;
  setFilterBusinessName: (value: string) => void;
  setFilterOwnerPhone: (value: string) => void;
  setFilterIncludeDeleted: (value: boolean) => void;
  clearFilters: () => void;
  setError: (value: string | null) => void;
  setNewBusinessName: (value: string) => void;
  setNewOwnerPhone: (value: string) => void;
  setNewPhoneNumber: (value: string) => void;
  setNewGstin: (value: string) => void;
  setNewEmail: (value: string) => void;
  setNewBusinessType: (value: string) => void;
  setNewBusinessCategory: (value: string) => void;
  setNewState: (value: string) => void;
  setNewPincode: (value: string) => void;
  setNewAddress: (value: string) => void;
  setNewLogo: (value: string) => void;
  setNewLicenseBeginsOn: (value: string) => void;
  setNewLicenseEndsOn: (value: string) => void;
  setNewLicenseBundleKey: (value: BundleKey) => void;
  setNewLicenseAddOnCapabilities: (value: CapabilityKey[]) => void;
  setNewLicenseRemovedCapabilities: (value: CapabilityKey[]) => void;
  setNewLicenseUserLimitType: (
    value: "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS",
  ) => void;
  setNewLicenseUserLimitValue: (value: string) => void;
  clearCreateDraft: () => void;
  resetAdminBusinessesState: () => void;
};

const initialPagination: AdminBusinessesPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

const initialState: AdminBusinessesState = {
  businesses: [],
  page: 1,
  pagination: initialPagination,
  filterBusinessName: "",
  filterOwnerPhone: "",
  filterIncludeDeleted: false,
  error: null,
  newBusinessName: "",
  newOwnerPhone: "",
  newPhoneNumber: "",
  newGstin: "",
  newEmail: "",
  newBusinessType: "",
  newBusinessCategory: "",
  newState: "",
  newPincode: "",
  newAddress: "",
  newLogo: "",
  newLicenseBeginsOn: "",
  newLicenseEndsOn: "",
  newLicenseBundleKey: "SALES_LITE",
  newLicenseAddOnCapabilities: [],
  newLicenseRemovedCapabilities: [],
  newLicenseUserLimitType: "UNLIMITED",
  newLicenseUserLimitValue: "",
};

export const useAdminBusinessesStore = create<AdminBusinessesState & AdminBusinessesActions>(
  (set) => ({
    ...initialState,
    setBusinessesPage: ({ businesses, pagination }) => {
      set({
        businesses,
        page: pagination.page,
        pagination,
      });
    },
    setFilterBusinessName: (value) => {
      set({ filterBusinessName: value });
    },
    setFilterOwnerPhone: (value) => {
      set({ filterOwnerPhone: value });
    },
    setFilterIncludeDeleted: (value) => {
      set({ filterIncludeDeleted: value });
    },
    clearFilters: () => {
      set({
        filterBusinessName: "",
        filterOwnerPhone: "",
        filterIncludeDeleted: false,
      });
    },
    setError: (value) => {
      set({ error: value });
    },
    setNewBusinessName: (value) => {
      set({ newBusinessName: value });
    },
    setNewOwnerPhone: (value) => {
      set({ newOwnerPhone: value });
    },
    setNewPhoneNumber: (value) => {
      set({ newPhoneNumber: value });
    },
    setNewGstin: (value) => {
      set({ newGstin: value });
    },
    setNewEmail: (value) => {
      set({ newEmail: value });
    },
    setNewBusinessType: (value) => {
      set({ newBusinessType: value });
    },
    setNewBusinessCategory: (value) => {
      set({ newBusinessCategory: value });
    },
    setNewState: (value) => {
      set({ newState: value });
    },
    setNewPincode: (value) => {
      set({ newPincode: value });
    },
    setNewAddress: (value) => {
      set({ newAddress: value });
    },
    setNewLogo: (value) => {
      set({ newLogo: value });
    },
    setNewLicenseBeginsOn: (value) => {
      set({ newLicenseBeginsOn: value });
    },
    setNewLicenseEndsOn: (value) => {
      set({ newLicenseEndsOn: value });
    },
    setNewLicenseBundleKey: (value) => {
      set({ newLicenseBundleKey: value });
    },
    setNewLicenseAddOnCapabilities: (value) => {
      set({ newLicenseAddOnCapabilities: value });
    },
    setNewLicenseRemovedCapabilities: (value) => {
      set({ newLicenseRemovedCapabilities: value });
    },
    setNewLicenseUserLimitType: (value) => {
      set((state) => ({
        newLicenseUserLimitType: value,
        newLicenseUserLimitValue:
          value === "UNLIMITED" ? "" : state.newLicenseUserLimitValue,
      }));
    },
    setNewLicenseUserLimitValue: (value) => {
      set({ newLicenseUserLimitValue: value });
    },
    clearCreateDraft: () => {
      set({
        newBusinessName: "",
        newOwnerPhone: "",
        newPhoneNumber: "",
        newGstin: "",
        newEmail: "",
        newBusinessType: "",
        newBusinessCategory: "",
        newState: "",
        newPincode: "",
        newAddress: "",
        newLogo: "",
        newLicenseBeginsOn: "",
        newLicenseEndsOn: "",
        newLicenseBundleKey: "SALES_LITE",
        newLicenseAddOnCapabilities: [],
        newLicenseRemovedCapabilities: [],
        newLicenseUserLimitType: "UNLIMITED",
        newLicenseUserLimitValue: "",
      });
    },
    resetAdminBusinessesState: () => {
      set(initialState);
    },
  }),
);
