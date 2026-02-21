import { create } from "zustand";
import type { AdminStore, AdminStoresPagination } from "./stores";

type AdminStoresState = {
  stores: AdminStore[];
  page: number;
  pagination: AdminStoresPagination;
  filterStoreName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  error: string | null;
  newStoreName: string;
  newOwnerPhone: string;
};

type AdminStoresActions = {
  setStoresPage: (payload: {
    stores: AdminStore[];
    pagination: AdminStoresPagination;
  }) => void;
  setFilterStoreName: (value: string) => void;
  setFilterOwnerPhone: (value: string) => void;
  setFilterIncludeDeleted: (value: boolean) => void;
  clearFilters: () => void;
  setError: (value: string | null) => void;
  setNewStoreName: (value: string) => void;
  setNewOwnerPhone: (value: string) => void;
  clearCreateDraft: () => void;
  resetAdminStoresState: () => void;
};

const initialPagination: AdminStoresPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

const initialState: AdminStoresState = {
  stores: [],
  page: 1,
  pagination: initialPagination,
  filterStoreName: "",
  filterOwnerPhone: "",
  filterIncludeDeleted: false,
  error: null,
  newStoreName: "",
  newOwnerPhone: "",
};

export const useAdminStoresStore = create<AdminStoresState & AdminStoresActions>(
  (set) => ({
    ...initialState,
    setStoresPage: ({ stores, pagination }) => {
      set({
        stores,
        page: pagination.page,
        pagination,
      });
    },
    setFilterStoreName: (value) => {
      set({ filterStoreName: value });
    },
    setFilterOwnerPhone: (value) => {
      set({ filterOwnerPhone: value });
    },
    setFilterIncludeDeleted: (value) => {
      set({ filterIncludeDeleted: value });
    },
    clearFilters: () => {
      set({
        filterStoreName: "",
        filterOwnerPhone: "",
        filterIncludeDeleted: false,
      });
    },
    setError: (value) => {
      set({ error: value });
    },
    setNewStoreName: (value) => {
      set({ newStoreName: value });
    },
    setNewOwnerPhone: (value) => {
      set({ newOwnerPhone: value });
    },
    clearCreateDraft: () => {
      set({
        newStoreName: "",
        newOwnerPhone: "",
      });
    },
    resetAdminStoresState: () => {
      set(initialState);
    },
  }),
);
