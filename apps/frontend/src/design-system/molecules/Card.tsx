import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-white/65 bg-white/72 p-5 text-card-foreground shadow-[0_24px_55px_-30px_rgba(15,23,42,0.38)] backdrop-blur-xl",
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
    <div className={cn(hasExplicitMarginBottom ? undefined : "mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h2 className={cn("text-xl font-semibold tracking-[-0.01em] text-foreground", className)} {...props}>
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
    <div className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}
