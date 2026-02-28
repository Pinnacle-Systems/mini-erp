import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type AppTabButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  Icon: LucideIcon;
  label: string;
  active?: boolean;
  stacked?: boolean;
};

export function AppTabButton({
  Icon,
  label,
  active = false,
  stacked = false,
  className,
  ...props
}: AppTabButtonProps) {
  return (
    <button
      className={cn(
        stacked
          ? "flex w-full min-h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] transition"
          : "flex min-h-9 min-w-[7.5rem] shrink-0 items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition",
        stacked
          ? active
            ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
            : "border-transparent bg-transparent text-foreground/75 hover:border-border/40 hover:bg-white/45"
          : active
            ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
            : "border-border/70 bg-white/70 text-foreground/80 hover:bg-white",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
