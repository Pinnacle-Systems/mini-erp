import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Label } from "../../design-system/atoms/Label";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { SalesItemOptionContent } from "./SalesItemOptionContent";
import { type SalesItemOption } from "./useSalesDocumentWorkspace";

type PosQuickAddBarProps = {
  value: string;
  disabled: boolean;
  lookupLoading: boolean;
  itemOptions: SalesItemOption[];
  focusSignal?: number;
  actionSlot?: ReactNode;
  onValueChange: (value: string) => void;
  onAddItem: (option: SalesItemOption) => void;
};

const PRINTABLE_REDIRECT_KEY = /^[A-Za-z0-9./_-]$/;

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function PosQuickAddBar({
  value,
  disabled,
  lookupLoading,
  itemOptions,
  focusSignal = 0,
  actionSlot,
  onValueChange,
  onAddItem,
}: PosQuickAddBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const exactMatchByCode = useMemo(() => {
    const entries = itemOptions.flatMap((option) => {
      const keys = [option.barcode, option.sku]
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      return keys.map((key) => [key, option] as const);
    });

    return new Map(entries);
  }, [itemOptions]);

  const focusInput = () => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const addItemAndRefocus = (option: SalesItemOption) => {
    onAddItem(option);
    focusInput();
  };

  useEffect(() => {
    if (disabled) {
      return;
    }

    focusInput();
  }, [disabled, focusSignal]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isEditableElement(event.target) || event.target === inputRef.current) {
        return;
      }

      if (!PRINTABLE_REDIRECT_KEY.test(event.key)) {
        return;
      }

      event.preventDefault();
      onValueChange(`${value}${event.key}`);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        const input = inputRef.current;
        if (!input) {
          return;
        }
        const nextCursorPosition = input.value.length;
        input.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [disabled, onValueChange, value]);

  return (
    <div className="grid gap-1.5 rounded-xl border border-[#8fb6e2] bg-[#f4f8ff] p-2 shadow-[inset_0_0_0_1px_rgba(143,182,226,0.18)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="space-y-1 lg:space-y-0">
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <Label htmlFor="sales-pos-quick-add">Quick add item</Label>
          <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#355a84]">
            Scanner focus
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <LookupDropdownInput
              id="sales-pos-quick-add"
              inputRef={inputRef}
              value={value}
              disabled={disabled}
              openOnFocus={false}
              onValueChange={onValueChange}
              options={itemOptions}
              loading={lookupLoading}
              loadingLabel="Loading items"
              placeholder="Scan barcode or search item, SKU, or service"
              onOptionSelect={addItemAndRefocus}
              getOptionKey={(option) => option.variantId}
              getOptionSearchText={(option) =>
                `${option.label} ${option.sku} ${option.barcode} ${option.gstLabel}`
              }
              renderOption={(option) => <SalesItemOptionContent option={option} />}
              inputClassName="h-10 border-[#6fa2db] bg-white text-sm shadow-[0_0_0_1px_rgba(111,162,219,0.12)] lg:h-9 lg:pr-20"
              inputProps={{
                onKeyDown: (event) => {
                  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) {
                    return;
                  }

                  const exactMatch = exactMatchByCode.get(value.trim().toLowerCase());
                  if (!exactMatch) {
                    return;
                  }

                  event.preventDefault();
                  addItemAndRefocus(exactMatch);
                },
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 hidden items-center text-[9px] font-medium text-[#8ca0b4] lg:inline-flex">
              Scan ready
            </span>
          </div>
        </div>
      </div>
      {actionSlot ? <div className="justify-self-end">{actionSlot}</div> : null}
    </div>
  );
}
