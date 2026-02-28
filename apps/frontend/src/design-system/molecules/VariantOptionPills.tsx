import { cn } from "../../lib/utils";

export type VariantOptionPill = {
  id?: string;
  key: string;
  value: string;
};

type VariantOptionPillsProps = {
  options: VariantOptionPill[];
  emptyLabel?: string;
  className?: string;
  onRemoveOption?: (option: VariantOptionPill) => void;
  removeDisabled?: boolean;
};

export function VariantOptionPills({
  options,
  emptyLabel = "No options",
  className,
  onRemoveOption,
  removeDisabled = false,
}: VariantOptionPillsProps) {
  if (options.length === 0) {
    return <p className="text-[10px] text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {options.map((option, index) => (
        <span
          key={option.id ?? `${option.key}:${option.value}:${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-2 py-0.5 text-[10px] text-foreground/85"
        >
          <span className="font-medium">{option.key}</span>
          <span className="text-muted-foreground">{option.value}</span>
          {onRemoveOption ? (
            <button
              type="button"
              className="rounded-full text-[10px] leading-none text-muted-foreground hover:text-foreground disabled:opacity-60"
              aria-label={`Remove option ${option.key} ${option.value}`}
              disabled={removeDisabled}
              onClick={() => onRemoveOption(option)}
            >
              x
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
