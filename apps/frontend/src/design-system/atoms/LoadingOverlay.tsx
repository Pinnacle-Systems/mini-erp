import { cn } from "../../lib/utils";

type LoadingOverlayProps = {
  visible: boolean;
  label?: string;
  className?: string;
};

export function LoadingOverlay({
  visible,
  label = "Loading",
  className,
}: LoadingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/65 backdrop-blur-[1px]",
        className,
      )}
      aria-live="polite"
      aria-label={label}
      role="status"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6aa5eb]/35 border-t-[#2f6fb7]" />
    </div>
  );
}
