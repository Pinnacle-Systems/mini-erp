import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "../atoms/Input";
import { cn } from "../../lib/utils";

type LookupDropdownInputProps<T> = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  options: T[];
  onOptionSelect: (option: T) => void;
  getOptionKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  getOptionSearchText?: (option: T) => string;
  loading?: boolean;
  loadingLabel?: string;
  maxVisibleOptions?: number;
  inputClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "id" | "value" | "onChange" | "disabled"
  >;
};

export function LookupDropdownInput<T>({
  id,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  options,
  onOptionSelect,
  getOptionKey,
  renderOption,
  getOptionSearchText,
  loading = false,
  loadingLabel,
  maxVisibleOptions = 8,
  inputClassName,
  dropdownClassName,
  optionClassName,
  inputProps,
}: LookupDropdownInputProps<T>) {
  const [isFocused, setIsFocused] = useState(false);

  const filteredOptions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const filtered =
      q.length === 0 || !getOptionSearchText
        ? options
        : options.filter((option) =>
            getOptionSearchText(option).toLowerCase().includes(q),
          );
    return filtered.slice(0, maxVisibleOptions);
  }, [getOptionSearchText, maxVisibleOptions, options, value]);

  return (
    <div className="relative space-y-1">
      <Input
        {...inputProps}
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 100);
        }}
        onChange={(event) => onValueChange(event.target.value)}
        className={inputClassName}
      />
      {loading && loadingLabel ? (
        <p className="text-[10px] text-muted-foreground">{loadingLabel}</p>
      ) : null}
      {isFocused && filteredOptions.length > 0 ? (
        <div
          className={cn(
            "absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-[#c6d5e6] bg-white p-1 shadow-sm",
            dropdownClassName,
          )}
        >
          <div className="grid gap-1">
            {filteredOptions.map((option) => (
              <button
                key={getOptionKey(option)}
                type="button"
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onOptionSelect(option);
                  setIsFocused(false);
                }}
                className={cn(
                  "rounded-md border border-[#e5edf7] px-2 py-1 text-left text-[11px] text-foreground hover:bg-[#f6faff]",
                  optionClassName,
                )}
              >
                {renderOption(option)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
