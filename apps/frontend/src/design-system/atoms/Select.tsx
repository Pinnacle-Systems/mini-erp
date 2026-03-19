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
          ? "block h-8 w-full rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 text-xs text-[#15314e] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#5d95d6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/20 disabled:opacity-50 lg:h-7 lg:px-2.5 lg:text-[11px]"
          : undefined,
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
