import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  APP_DEFAULT_THEME,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "./theme-registry";

type ThemeState = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  resetTheme: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: APP_DEFAULT_THEME,
      setTheme: (theme) => set({ theme }),
      resetTheme: () => set({ theme: APP_DEFAULT_THEME }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !isThemeId(state.theme)) {
          state.theme = APP_DEFAULT_THEME;
        }
      },
    },
  ),
);
