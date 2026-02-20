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
    "border border-[#0a6bff] bg-gradient-to-b from-[#2890ff] to-[#0a74ff] text-white shadow-[0_10px_24px_-14px_rgba(10,116,255,0.9)] hover:from-[#3a9cff] hover:to-[#0d7eff] active:from-[#0a74ff] active:to-[#0667e3]",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-white/55 active:bg-white/65",
  outline:
    "border border-[#9cb5d2] bg-gradient-to-b from-[#f8fbff] to-[#e7f1ff] text-[#15314e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(21,49,78,0.5)] backdrop-blur-xl hover:from-[#ffffff] hover:to-[#edf5ff] active:from-[#ecf4ff] active:to-[#ddeaff]"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
  icon: "h-9 w-9 p-0 text-sm"
};

export function Button({ className, variant = "default", size = "md", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-[0.01em] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
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
