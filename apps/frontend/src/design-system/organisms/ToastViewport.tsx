import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { IconButton } from "../atoms/IconButton";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (toastId: string) => void;
};

const toneStyles: Record<
  ToastTone,
  { container: string; icon: typeof Info; dismissButton: string }
> = {
  info: {
    container: "border-slate-300 bg-slate-50 text-slate-900",
    icon: Info,
    dismissButton: "text-slate-700 hover:bg-slate-200/60 hover:text-slate-900",
  },
  success: {
    container: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: CheckCircle2,
    dismissButton: "text-emerald-800 hover:bg-emerald-200/60 hover:text-emerald-950",
  },
  error: {
    container: "border-rose-300 bg-rose-50 text-rose-950",
    icon: AlertCircle,
    dismissButton: "text-rose-800 hover:bg-rose-200/60 hover:text-rose-950",
  },
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (typeof document === "undefined" || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-end px-2 sm:top-[4.25rem] sm:px-3 md:px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => {
          const tone = toneStyles[toast.tone];
          const Icon = tone.icon;

          return (
            <section
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-xl border shadow-[0_8px_24px_-16px_rgba(15,23,42,0.28)]",
                tone.container,
              )}
              role={toast.tone === "error" ? "alert" : "status"}
            >
              <div className="flex items-start gap-2 px-3 py-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-4">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-0.5 text-xs leading-4 opacity-85">{toast.description}</p>
                  ) : null}
                </div>
                <IconButton
                  type="button"
                  icon={X}
                  variant="ghost"
                  onClick={() => onDismiss(toast.id)}
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full border-none bg-transparent p-0 shadow-none",
                    tone.dismissButton,
                  )}
                  aria-label="Dismiss toast"
                  title="Dismiss toast"
                  iconSize={14}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
