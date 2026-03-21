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
        "flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm outline-none transition hover:bg-muted/70 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
