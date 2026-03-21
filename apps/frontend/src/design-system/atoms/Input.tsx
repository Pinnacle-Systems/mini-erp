import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  unstyled?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, unstyled = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          !unstyled
            ? "h-8 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus:border-ring/65 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 lg:h-7 lg:px-2.5 lg:text-[11px]"
            : undefined,
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
