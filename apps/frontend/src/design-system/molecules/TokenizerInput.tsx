import type { KeyboardEvent } from "react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { cn } from "../../lib/utils";

type TokenizerInputProps = {
  values: string[];
  draftValue: string;
  onDraftChange: (value: string) => void;
  onCommitValue: (value: string) => void;
  onRemoveValue: (value: string) => void;
  onRemoveLastValue?: () => void;
  placeholder?: string;
  mobilePlaceholder?: string;
  inputAriaLabel: string;
  disabled?: boolean;
  className?: string;
};

const isCommitKey = (event: KeyboardEvent<HTMLInputElement>) =>
  event.key === "Enter" || event.key === ",";

export function TokenizerInput({
  values,
  draftValue,
  onDraftChange,
  onCommitValue,
  onRemoveValue,
  onRemoveLastValue,
  placeholder,
  mobilePlaceholder,
  inputAriaLabel,
  disabled = false,
  className,
}: TokenizerInputProps) {
  const commitCurrentDraft = () => {
    if (disabled) return;
    const normalized = draftValue.trim();
    if (!normalized) return;
    onCommitValue(normalized);
  };
  const isMobileViewport =
    typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches;
  const resolvedPlaceholder =
    isMobileViewport && mobilePlaceholder ? mobilePlaceholder : placeholder;

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-[#8fa9c7] bg-[#f7f9fb] px-2 py-0 text-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#5d95d6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6aa5eb]/20",
        className,
      )}
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border/70 bg-white px-1.5 py-0.5 text-[9px]"
        >
          {value}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!h-3 !w-3 !min-w-0 !rounded-full border-0 bg-transparent !p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 lg:!h-3 lg:!w-3 lg:!p-0"
            onClick={() => onRemoveValue(value)}
            aria-label={`Remove ${value}`}
            disabled={disabled}
          >
            x
          </Button>
        </span>
      ))}
      <Input
        value={draftValue}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={commitCurrentDraft}
        onKeyDown={(event) => {
          if (isCommitKey(event)) {
            event.preventDefault();
            commitCurrentDraft();
            return;
          }
          if (
            event.key === "Backspace" &&
            draftValue.trim().length === 0 &&
            values.length > 0
          ) {
            event.preventDefault();
            onRemoveLastValue?.();
          }
        }}
        placeholder={values.length === 0 ? resolvedPlaceholder : ""}
        className="!h-6 !w-auto min-w-[80px] !flex-1 !border-0 !bg-transparent !p-0 !text-[10px] !leading-6 !text-foreground !shadow-none placeholder:!text-muted-foreground focus:!border-0 focus:!bg-transparent focus:!ring-0"
        aria-label={inputAriaLabel}
        disabled={disabled}
      />
    </div>
  );
}
