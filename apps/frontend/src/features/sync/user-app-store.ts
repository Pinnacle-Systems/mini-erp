import { create } from "zustand";

type UserAppState = {
  localItems: string[];
  sku: string;
  name: string;
};

type UserAppActions = {
  setLocalItems: (value: string[]) => void;
  setSku: (value: string) => void;
  setName: (value: string) => void;
  clearDraft: () => void;
  resetUserAppState: () => void;
};

const initialState: UserAppState = {
  localItems: [],
  sku: "",
  name: "",
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
  clearDraft: () => {
    set({
      sku: "",
      name: "",
    });
  },
  resetUserAppState: () => {
    set(initialState);
  },
}));
