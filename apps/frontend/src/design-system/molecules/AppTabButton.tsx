import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type AppTabButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  Icon: LucideIcon;
  label: string;
  active?: boolean;
};

export function AppTabButton({
  Icon,
  label,
  active = false,
  className,
  ...props
}: AppTabButtonProps) {
  return (
    <button
      className={cn(
        "flex min-h-9 min-w-[7.5rem] shrink-0 items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition",
        active
          ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
          : "border-border/70 bg-white/70 text-foreground/80 hover:bg-white",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
