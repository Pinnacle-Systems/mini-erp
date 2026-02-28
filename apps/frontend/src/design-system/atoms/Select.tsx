import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "block h-8 w-full rounded-md border border-border bg-input px-3 text-xs text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 lg:h-7 lg:px-2.5 lg:text-[11px]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
