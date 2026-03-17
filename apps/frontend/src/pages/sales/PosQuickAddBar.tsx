import { useEffect, useMemo, useRef } from "react";
import { Label } from "../../design-system/atoms/Label";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { SalesItemOptionContent } from "./SalesItemOptionContent";
import { formatCurrency, type SalesItemOption } from "./useSalesDocumentWorkspace";

type PosQuickAddBarProps = {
  value: string;
  disabled: boolean;
  lookupLoading: boolean;
  itemOptions: SalesItemOption[];
  linesCount: number;
  subTotal: number;
  grandTotal: number;
  focusSignal?: number;
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
  linesCount,
  subTotal,
  grandTotal,
  focusSignal = 0,
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
    <div className="grid gap-2 rounded-xl border border-border/80 bg-slate-50 p-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-1">
        <Label htmlFor="sales-pos-quick-add">Quick add item</Label>
        <LookupDropdownInput
          id="sales-pos-quick-add"
          inputRef={inputRef}
          value={value}
          disabled={disabled}
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
          inputClassName="h-10 text-sm lg:h-9"
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
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground lg:min-w-[18rem]">
        <div className="rounded-lg border border-border/70 bg-white px-2 py-1.5">
          <div>Lines</div>
          <div className="text-sm font-semibold text-foreground">
            {linesCount || 1}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-white px-2 py-1.5">
          <div>Subtotal</div>
          <div className="text-sm font-semibold text-foreground">
            {formatCurrency(subTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-[#8fb6e2] bg-[#edf5ff] px-2 py-1.5">
          <div>Total</div>
          <div className="text-sm font-semibold text-foreground">
            {formatCurrency(grandTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
