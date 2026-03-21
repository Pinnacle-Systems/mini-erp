import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "border border-primary/90 bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--primary)/0.22),0_8px_16px_-14px_hsl(var(--primary)/0.45)] hover:bg-primary/95 active:bg-primary/90",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-muted active:bg-muted/80",
  outline:
    "border border-input bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-background/90 active:bg-muted"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs lg:h-7 lg:px-2.5 lg:text-[11px]",
  md: "h-9 px-4 text-xs lg:h-8 lg:px-3 lg:text-[11px]",
  lg: "h-10 px-5 text-sm lg:h-9 lg:px-4 lg:text-xs",
  icon: "h-8 w-8 p-0 text-xs lg:h-7 lg:w-7 lg:text-[11px]"
};

const hasExplicitDisplayClass = (className?: string) => {
  if (!className) return false;
  return className
    .split(/\s+/)
    .some((token) =>
      /(?:^|:)(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid)$/.test(
        token,
      ),
    );
};

export function Button({ className, variant = "default", size = "md", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        !hasExplicitDisplayClass(className) ? "inline-flex" : undefined,
        "cursor-pointer items-center justify-center rounded-md font-semibold tracking-[0.01em] transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
