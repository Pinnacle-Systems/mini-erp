import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 rounded-xl border border-black/10 bg-white/75 px-3.5 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
