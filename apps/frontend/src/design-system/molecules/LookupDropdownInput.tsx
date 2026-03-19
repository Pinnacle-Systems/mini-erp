import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Ref,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  inputUnstyled?: boolean;
  dropdownClassName?: string;
  optionClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
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
  inputUnstyled = false,
  dropdownClassName,
  optionClassName,
  inputRef,
  inputProps,
}: LookupDropdownInputProps<T>) {
  const [isFocused, setIsFocused] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mergedInputProps = {
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
    ...inputProps,
  };

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

  useEffect(() => {
    if (!isDropdownOpen || typeof window === "undefined") {
      return;
    }

    const updateDropdownPosition = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportPadding = 8;
      const dropdownGap = 4;
      const estimatedHeight = Math.min(
        dropdownRef.current?.offsetHeight ?? filteredOptions.length * 36 + 8,
        160,
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - dropdownGap;
      const spaceAbove = rect.top - viewportPadding - dropdownGap;
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      if (openAbove) {
        setDropdownStyle({
          position: "fixed",
          left: rect.left,
          bottom: Math.max(window.innerHeight - rect.top + dropdownGap, viewportPadding),
          width: rect.width,
          maxHeight: Math.max(spaceAbove, 96),
        });
        return;
      }

      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        top: Math.min(rect.bottom + dropdownGap, window.innerHeight - viewportPadding),
        width: rect.width,
        maxHeight: Math.max(spaceBelow, 96),
      });
    };
    const frameId = window.requestAnimationFrame(updateDropdownPosition);

    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [filteredOptions.length, isDropdownOpen]);

  const selectOption = (option: T) => {
    onOptionSelect(option);
    setActiveOptionIndex(-1);
    setDropdownStyle(null);
    window.requestAnimationFrame(() => {
      const stillFocused =
        typeof document !== "undefined" &&
        containerRef.current?.contains(document.activeElement);
      setIsFocused(Boolean(stillFocused));
    });
  };

  const closeDropdown = () => {
    setIsFocused(false);
    setActiveOptionIndex(-1);
    setDropdownStyle(null);
  };

  const isDropdownOwnedKey = (key: string) =>
    key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === "Escape";

  return (
    <div ref={containerRef} className={cn("relative space-y-1", isFocused ? "z-30" : undefined)}>
      <Input
        {...mergedInputProps}
        unstyled={inputUnstyled}
        ref={inputRef}
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
          mergedInputProps.onFocus?.(event);
          setIsFocused(true);
          setActiveOptionIndex(-1);
        }}
        onBlur={(event) => {
          mergedInputProps.onBlur?.(event);
          window.setTimeout(() => {
            setIsFocused(false);
            setActiveOptionIndex(-1);
            setDropdownStyle(null);
          }, 100);
        }}
        onChange={(event) => {
          setIsFocused(true);
          setActiveOptionIndex(-1);
          onValueChange(event.target.value);
        }}
        onKeyDown={(event) => {
          const hasResults = filteredOptions.length > 0;
          const ownsKey = isDropdownOwnedKey(event.key);

          if (ownsKey && !disabled && hasResults) {
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
              closeDropdown();
              return;
            }
          }

          mergedInputProps.onKeyDown?.(event);
          if (event.defaultPrevented || disabled || !hasResults) {
            return;
          }

          if (event.key === "Enter" && highlightedOptionIndex >= 0) {
            event.preventDefault();
            selectOption(filteredOptions[highlightedOptionIndex]);
            return;
          }

          if (event.key === "Escape" && isDropdownOpen) {
            event.preventDefault();
            closeDropdown();
          }
        }}
        className={inputClassName}
      />
      {loading && loadingLabel ? (
        <p className="text-[10px] text-muted-foreground">{loadingLabel}</p>
      ) : null}
      {isDropdownOpen && dropdownStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              id={listboxId}
              role="listbox"
              style={dropdownStyle}
              className={cn(
                "z-50 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-sm",
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
