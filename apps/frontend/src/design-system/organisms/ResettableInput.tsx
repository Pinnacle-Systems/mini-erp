import { X } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Input } from "../atoms/Input";
import { cn } from "../../lib/utils";

type ResettableInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "value" | "onChange"
> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  resetAriaLabel?: string;
};

export function ResettableInput({
  className,
  defaultValue = "",
  value,
  onValueChange,
  resetAriaLabel = "Reset field",
  ...props
}: ResettableInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);

  const currentValue = isControlled ? value : internalValue;
  const canReset = useMemo(
    () => Boolean(currentValue && currentValue !== defaultValue),
    [currentValue, defaultValue],
  );

  const setNextValue = (next: string) => {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNextValue(event.target.value);
  };

  const onReset = () => {
    setNextValue(defaultValue);
  };

  return (
    <div className="relative">
      <Input
        {...props}
        value={currentValue}
        onChange={onChange}
        className={cn("pr-8", className)}
      />
      {canReset ? (
        <button
          type="button"
          onClick={onReset}
          className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#6d829b] transition hover:bg-white/80 hover:text-[#1f4167] focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35"
          aria-label={resetAriaLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
