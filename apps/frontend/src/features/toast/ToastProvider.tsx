import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ToastViewport,
  type ToastItem,
} from "../../design-system/organisms/ToastViewport";
import {
  ToastContext,
  type ShowToastOptions,
} from "./toast-context";

type ToastRecord = ToastItem & {
  dedupeKey: string | null;
  durationMs: number;
};

const DEFAULT_DURATION_MS = 5000;

let toastSequence = 0;

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));

    const timeout = timeoutsRef.current.get(toastId);
    if (timeout) {
      window.clearTimeout(timeout);
      timeoutsRef.current.delete(toastId);
    }
  }, []);

  const scheduleDismiss = useCallback(
    (toastId: string, durationMs: number) => {
      const existingTimeout = timeoutsRef.current.get(toastId);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      const timeout = window.setTimeout(() => {
        dismissToast(toastId);
      }, durationMs);
      timeoutsRef.current.set(toastId, timeout);
    },
    [dismissToast],
  );

  const showToast = useCallback(
    ({
      title,
      description,
      tone = "info",
      durationMs = DEFAULT_DURATION_MS,
      dedupeKey,
    }: ShowToastOptions) => {
      setToasts((current) => {
        const existing =
          dedupeKey ? current.find((toast) => toast.dedupeKey === dedupeKey) : null;

        if (existing) {
          return current.map((toast) =>
            toast.id === existing.id
              ? { ...toast, title, description, tone, durationMs }
              : toast,
          );
        }

        toastSequence += 1;
        const toastId = `toast-${toastSequence}`;
        return [
          ...current,
          {
            id: toastId,
            title,
            description,
            tone,
            durationMs,
            dedupeKey: dedupeKey ?? null,
          },
        ];
      });

    },
    [],
  );

  useEffect(() => {
    for (const toast of toasts) {
      scheduleDismiss(toast.id, toast.durationMs);
    }
  }, [scheduleDismiss, toasts]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const timeout of timeouts.values()) {
        window.clearTimeout(timeout);
      }
      timeouts.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
