import { create } from "zustand";
import type { AdminStore, AdminBusinessesPagination } from "./businesses";

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
    clearCreateDraft: () => {
      set({
        newBusinessName: "",
        newOwnerPhone: "",
      });
    },
    resetAdminBusinessesState: () => {
      set(initialState);
    },
  }),
);
