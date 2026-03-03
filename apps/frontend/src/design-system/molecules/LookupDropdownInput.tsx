import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
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
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const listboxId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const isDropdownOpen = isFocused && filteredOptions.length > 0;

  const highlightedOptionIndex =
    isDropdownOpen && activeOptionIndex >= 0
      ? Math.min(activeOptionIndex, filteredOptions.length - 1)
      : -1;

  useEffect(() => {
    if (highlightedOptionIndex < 0) {
      return;
    }

    optionRefs.current[highlightedOptionIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedOptionIndex]);

  const selectOption = (option: T) => {
    onOptionSelect(option);
    setIsFocused(false);
    setActiveOptionIndex(-1);
  };

  return (
    <div className={cn("relative space-y-1", isFocused ? "z-30" : undefined)}>
      <Input
        {...inputProps}
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isDropdownOpen}
        aria-controls={isDropdownOpen ? listboxId : undefined}
        aria-activedescendant={
          highlightedOptionIndex >= 0
            ? `${listboxId}-option-${highlightedOptionIndex}`
            : undefined
        }
        onFocus={(event) => {
          inputProps?.onFocus?.(event);
          setIsFocused(true);
          setActiveOptionIndex(-1);
        }}
        onBlur={(event) => {
          inputProps?.onBlur?.(event);
          window.setTimeout(() => {
            setIsFocused(false);
            setActiveOptionIndex(-1);
          }, 100);
        }}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          inputProps?.onKeyDown?.(event);
          if (event.defaultPrevented || disabled || filteredOptions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsFocused(true);
            setActiveOptionIndex((current) =>
              current < filteredOptions.length - 1 ? current + 1 : 0,
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsFocused(true);
            setActiveOptionIndex((current) =>
              current > 0 ? current - 1 : filteredOptions.length - 1,
            );
            return;
          }

          if (event.key === "Enter" && highlightedOptionIndex >= 0) {
            event.preventDefault();
            selectOption(filteredOptions[highlightedOptionIndex]);
            return;
          }

          if (event.key === "Escape" && isDropdownOpen) {
            event.preventDefault();
            setIsFocused(false);
            setActiveOptionIndex(-1);
          }
        }}
        className={inputClassName}
      />
      {loading && loadingLabel ? (
        <p className="text-[10px] text-muted-foreground">{loadingLabel}</p>
      ) : null}
      {isDropdownOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-sm",
            dropdownClassName,
          )}
        >
          <div className="grid gap-1">
            {filteredOptions.map((option, index) => (
              <button
                id={`${listboxId}-option-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                key={getOptionKey(option)}
                type="button"
                role="option"
                aria-selected={highlightedOptionIndex === index}
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => setActiveOptionIndex(index)}
                onClick={() => selectOption(option)}
                className={cn(
                  "rounded-md border border-transparent px-2 py-1 text-left text-[11px] text-foreground hover:border-border hover:bg-muted/70",
                  highlightedOptionIndex === index && "border-border bg-muted/70",
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
