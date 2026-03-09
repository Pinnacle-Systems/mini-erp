import { Button } from "../atoms/Button";
import { Label } from "../atoms/Label";
import { LookupDropdownInput } from "../molecules/LookupDropdownInput";

type VariantOptionModalProps = {
  open: boolean;
  idPrefix: string;
  title?: string;
  keyDraft: string;
  valueDraft: string;
  keySuggestions: string[];
  valueSuggestions: string[];
  inputClassName?: string;
  onKeyDraftChange: (value: string) => void;
  onValueDraftChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function VariantOptionModal({
  open,
  idPrefix,
  title = "Add Option",
  keyDraft,
  valueDraft,
  keySuggestions,
  valueSuggestions,
  inputClassName = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]",
  onKeyDraftChange,
  onValueDraftChange,
  onClose,
  onConfirm,
}: VariantOptionModalProps) {
  if (!open) return null;

  const keyInputId = `${idPrefix}-option-key`;
  const valueInputId = `${idPrefix}-option-value`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3">
      <div className="w-full max-w-sm rounded-lg border border-border/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_24px_-20px_rgba(15,23,42,0.2)]">
        <p className="text-[11px] font-semibold text-foreground lg:text-[10px]">{title}</p>
        <div className="mt-2 grid gap-1.5">
          <div className="grid gap-1">
            <Label htmlFor={keyInputId}>Key</Label>
            <LookupDropdownInput
              id={keyInputId}
              value={keyDraft}
              onValueChange={onKeyDraftChange}
              placeholder="Size"
              options={keySuggestions}
              getOptionKey={(key) => key}
              getOptionSearchText={(key) => key}
              onOptionSelect={onKeyDraftChange}
              renderOption={(key) => <div className="truncate font-medium">{key}</div>}
              inputClassName={inputClassName}
              optionClassName="text-[10px]"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={valueInputId}>Value</Label>
            <LookupDropdownInput
              id={valueInputId}
              value={valueDraft}
              onValueChange={onValueDraftChange}
              placeholder="M"
              options={valueSuggestions}
              getOptionKey={(value) => value}
              getOptionSearchText={(value) => value}
              onOptionSelect={onValueDraftChange}
              renderOption={(value) => <div className="truncate font-medium">{value}</div>}
              inputClassName={inputClassName}
              optionClassName="text-[10px]"
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-7 px-2" onClick={onConfirm}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
