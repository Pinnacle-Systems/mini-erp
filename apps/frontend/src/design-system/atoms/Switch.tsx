import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  checkedTrackClassName?: string;
  uncheckedTrackClassName?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  className,
  checkedTrackClassName,
  uncheckedTrackClassName,
  disabled,
  onClick,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-10 items-center overflow-hidden rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2",
        checked
          ? checkedTrackClassName ?? "bg-emerald-500"
          : uncheckedTrackClassName ?? "bg-sky-500",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute top-1/2 inline-block h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-[left]",
          checked ? "left-[calc(100%-1.25rem)]" : "left-1",
        )}
      />
    </button>
  );
}
