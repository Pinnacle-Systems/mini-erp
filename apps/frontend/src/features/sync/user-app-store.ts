import { create } from "zustand";

type UserAppState = {
  localProducts: string[];
  sku: string;
  name: string;
  description: string;
};

type UserAppActions = {
  setLocalProducts: (value: string[]) => void;
  setSku: (value: string) => void;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  clearDraft: () => void;
  resetUserAppState: () => void;
};

const initialState: UserAppState = {
  localProducts: [],
  sku: "",
  name: "",
  description: "",
};

export const useUserAppStore = create<UserAppState & UserAppActions>((set) => ({
  ...initialState,
  setLocalProducts: (value) => {
    set({ localProducts: value });
  },
  setSku: (value) => {
    set({ sku: value });
  },
  setName: (value) => {
    set({ name: value });
  },
  setDescription: (value) => {
    set({ description: value });
  },
  clearDraft: () => {
    set({
      sku: "",
      name: "",
      description: "",
    });
  },
  resetUserAppState: () => {
    set(initialState);
  },
}));
