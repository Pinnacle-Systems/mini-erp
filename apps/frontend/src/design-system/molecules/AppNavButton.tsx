import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type AppNavButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  Icon: LucideIcon;
  label: string;
  active?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
};

export function AppNavButton({
  Icon,
  label,
  active = false,
  compact = false,
  iconOnly = false,
  className,
  ...props
}: AppNavButtonProps) {
  if (compact) {
    return (
      <button
        className={cn(
          "flex min-h-14 min-w-[4.8rem] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight transition",
          active
            ? "bg-primary/10 text-primary"
            : "text-foreground/75 hover:bg-card/80",
          className,
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
        <span className="text-center">{label}</span>
      </button>
    );
  }

  if (iconOnly) {
    return (
      <button
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg text-left transition",
          active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-card/70",
          className,
        )}
        title={label}
        aria-label={label}
        {...props}
      >
        <Icon className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
        active
          ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]"
          : "text-foreground/80 hover:bg-card/70",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
