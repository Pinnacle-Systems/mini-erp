import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import {
  THEME_MANAGED_KEYS,
} from "./theme-registry";
import { useThemeStore } from "./theme-store";

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);

  useLayoutEffect(() => {
    const root = document.documentElement;

    for (const key of THEME_MANAGED_KEYS) {
      root.style.removeProperty(`--${key}`);
    }

    root.dataset.theme = theme;
  }, [theme]);

  return <>{children}</>;
}
