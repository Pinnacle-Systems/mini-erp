import { create } from "zustand";

type UserAppState = {
  localItems: string[];
  sku: string;
  name: string;
  description: string;
};

type UserAppActions = {
  setLocalItems: (value: string[]) => void;
  setSku: (value: string) => void;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  clearDraft: () => void;
  resetUserAppState: () => void;
};

const initialState: UserAppState = {
  localItems: [],
  sku: "",
  name: "",
  description: "",
};

export const useUserAppStore = create<UserAppState & UserAppActions>((set) => ({
  ...initialState,
  setLocalItems: (value) => {
    set({ localItems: value });
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
