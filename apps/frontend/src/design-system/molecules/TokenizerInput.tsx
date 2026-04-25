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
        "app-tokenizer",
        className,
      )}
    >
      {values.map((value) => (
        <span
          key={value}
          className="app-tokenizer-chip"
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
        className="app-tokenizer-input"
        aria-label={inputAriaLabel}
        disabled={disabled}
      />
    </div>
  );
}
