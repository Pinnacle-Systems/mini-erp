import { SUPPORTED_THEMES } from "./theme-registry";
import { useThemeStore } from "./theme-store";

export function useTheme() {
  const { theme, setTheme, resetTheme } = useThemeStore();

  return {
    theme,
    availableThemes: Object.values(SUPPORTED_THEMES),
    setTheme,
    resetTheme,
  };
}
