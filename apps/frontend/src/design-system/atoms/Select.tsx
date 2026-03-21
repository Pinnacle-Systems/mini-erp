import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  unstyled?: boolean;
};

export function Select({ className, children, unstyled = false, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        !unstyled
          ? "block h-8 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-ring/65 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 lg:h-7 lg:px-2.5 lg:text-[11px]"
          : undefined,
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
