import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "block h-8 w-full rounded-lg border border-black/10 bg-white/75 px-3 text-xs text-foreground shadow-[0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 lg:h-7 lg:px-2.5 lg:text-[11px]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
