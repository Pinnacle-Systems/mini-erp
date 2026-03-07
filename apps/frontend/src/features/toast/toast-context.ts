import { createContext } from "react";
import type { ToastTone } from "../../design-system/organisms/ToastViewport";

export type ShowToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  dedupeKey?: string;
};

export type ToastContextValue = {
  showToast: (options: ShowToastOptions) => void;
  dismissToast: (toastId: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
