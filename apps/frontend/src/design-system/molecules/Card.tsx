import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/90 bg-card p-2 text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_20px_-18px_rgba(15,23,42,0.18)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  const hasExplicitMarginBottom = className?.split(/\s+/).some((token) => /(^|:)mb-/.test(token));
  return (
    <div className={cn(hasExplicitMarginBottom ? undefined : "mb-3 lg:mb-2", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h2 className={cn("text-lg font-semibold tracking-[-0.01em] text-foreground lg:text-base", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({ className, children, ...props }: CardProps) {
  return (
    <p className={cn("mt-1 text-xs text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("space-y-2.5 lg:space-y-2", className)} {...props}>
      {children}
    </div>
  );
}
