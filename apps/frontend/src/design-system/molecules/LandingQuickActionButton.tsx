import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type LandingQuickActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  Icon: LucideIcon;
  label: string;
  description: string;
};

export function LandingQuickActionButton({
  Icon,
  label,
  description,
  className,
  ...props
}: LandingQuickActionButtonProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition hover:bg-white",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0 text-[#24507e]" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
