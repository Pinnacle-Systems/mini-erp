import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-[#9fb5cd] bg-[#f7f9fb] px-3 py-2 text-xs text-[#15314e] placeholder:text-[#6d829b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#5d95d6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/20 disabled:opacity-50 lg:px-2.5 lg:py-1.5 lg:text-[11px]",
        className,
      )}
      {...props}
    />
  );
}
