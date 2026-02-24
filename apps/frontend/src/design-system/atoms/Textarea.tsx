import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-xl border border-[#a9bfd8] bg-gradient-to-b from-[#fbfdff] to-[#eef5ff] px-3 py-2 text-xs text-[#15314e] placeholder:text-[#6d829b] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_22px_-18px_rgba(21,49,78,0.45)] backdrop-blur-md transition-[border-color,box-shadow,background] duration-150 focus:outline-none focus:border-[#5d95d6] focus:bg-white focus:ring-2 focus:ring-[#6aa5eb]/35 resize-y",
        className,
      )}
      {...props}
    />
  );
}
