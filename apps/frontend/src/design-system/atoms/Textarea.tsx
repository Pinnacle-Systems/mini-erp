import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-ring/65 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 lg:px-2.5 lg:py-1.5 lg:text-[11px]",
        className,
      )}
      {...props}
    />
  );
}
