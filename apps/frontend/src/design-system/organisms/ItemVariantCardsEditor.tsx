import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";

export type VariantOptionRowDraft = {
  id: string;
  key: string;
  value: string;
};

export type ItemVariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  optionRows: VariantOptionRowDraft[];
  isDefault: boolean;
  isActive?: boolean;
  isLocked?: boolean;
  usageCount?: number;
};

type ItemVariantCardsEditorProps = {
  variants: ItemVariantDraft[];
  onVariantsChange: (next: ItemVariantDraft[]) => void;
  onAddVariant: () => void;
  onOpenOptionModal: (variantId: string) => void;
  addVariantLabel?: string;
  removeVariantLabel?: string;
  denseInputClassName?: string;
  showActiveToggle?: boolean;
};

const updateVariant = (
  variants: ItemVariantDraft[],
  variantId: string,
  updater: (variant: ItemVariantDraft) => ItemVariantDraft,
) =>
  variants.map((entry) => (entry.id === variantId ? updater(entry) : entry));

export function ItemVariantCardsEditor({
  variants,
  onVariantsChange,
  onAddVariant,
  onOpenOptionModal,
  addVariantLabel = "Add Variant",
  removeVariantLabel = "Remove",
  denseInputClassName = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]",
  showActiveToggle = false,
}: ItemVariantCardsEditorProps) {
  const hasDefault = variants.some((variant) => variant.isDefault);

  return (
    <div className="grid gap-1.5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/75 lg:bg-white/60">
      <div className="flex items-center justify-between gap-1.5 lg:shrink-0 lg:border-b lg:border-white/80 lg:px-1.5 lg:py-1">
        <p className="text-[11px] font-medium text-foreground lg:text-[10px]">Variants</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={onAddVariant}
        >
          {addVariantLabel}
        </Button>
      </div>

      <div className="grid gap-1 lg:min-h-0 lg:overflow-y-auto lg:p-0">
        <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-1 lg:px-1 lg:pb-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          <span className="lg:col-span-1">Default</span>
          <span className="lg:col-span-2">Name</span>
          <span className="lg:col-span-2">SKU</span>
          <span className="lg:col-span-2">Barcode</span>
          <span className="lg:col-span-3">Options</span>
          <span className="lg:col-span-1">{showActiveToggle ? "Active" : ""}</span>
          <span className="lg:col-span-1 text-right">Del</span>
        </div>
        {variants.map((variant, index) => {
          const isLocked = Boolean(variant.isLocked);
          const isDefault = variant.isDefault || (!hasDefault && index === 0);
          return (
            <div
              key={variant.id}
              className="rounded-xl border border-white/80 bg-white/65 p-1.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
            >
              {isLocked ? (
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                  Used in {variant.usageCount ?? 0} record
                  {(variant.usageCount ?? 0) === 1 ? "" : "s"}: SKU, name, barcode, options,
                  and delete are locked.
                </p>
              ) : null}
              <div className="grid gap-1.5 lg:grid-cols-12 lg:items-center lg:gap-1">
                <div className="grid gap-1 lg:col-span-1">
                  <Label className="text-[10px] text-muted-foreground lg:hidden">Default</Label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground lg:text-[10px]">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={isDefault}
                      onChange={() =>
                        onVariantsChange(
                          variants.map((entry) => ({
                            ...entry,
                            isDefault: entry.id === variant.id,
                          })),
                        )
                      }
                    />
                    <span className="lg:hidden">Set</span>
                  </label>
                </div>
                <div className="grid gap-1 lg:col-span-2">
                  <Label className="lg:hidden">Name</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.name}
                    disabled={isLocked}
                    onChange={(event) =>
                      onVariantsChange(
                        updateVariant(variants, variant.id, (entry) => ({
                          ...entry,
                          name: event.target.value,
                        })),
                      )
                    }
                    placeholder="Variant name"
                  />
                </div>
                <div className="grid gap-1 lg:col-span-2">
                  <Label className="lg:hidden">SKU</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.sku}
                    disabled={isLocked}
                    onChange={(event) =>
                      onVariantsChange(
                        updateVariant(variants, variant.id, (entry) => ({
                          ...entry,
                          sku: event.target.value,
                        })),
                      )
                    }
                    placeholder="Variant SKU"
                  />
                </div>
                <div className="grid gap-1 lg:col-span-2">
                  <Label className="lg:hidden">Barcode</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.barcode}
                    disabled={isLocked}
                    onChange={(event) =>
                      onVariantsChange(
                        updateVariant(variants, variant.id, (entry) => ({
                          ...entry,
                          barcode: event.target.value,
                        })),
                      )
                    }
                    placeholder="Optional barcode"
                  />
                </div>
                <div className="grid gap-1 lg:col-span-3 lg:content-center">
                  <Label className="lg:hidden">Options</Label>
                  <div className="flex min-h-7 flex-wrap content-center items-center gap-1 rounded-lg border border-white/75 bg-white/75 px-1.5 py-1 lg:px-0 lg:py-0">
                    {variant.optionRows.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No options</p>
                    ) : (
                      variant.optionRows.map((row) => (
                        <span
                          key={row.id}
                          className="inline-flex items-center gap-1 rounded-full border border-[#d6e4f5] bg-[#f4f8ff] px-2 py-0.5 text-[10px] text-[#1f4167]"
                        >
                          <span className="font-medium">{row.key}</span>
                          <span className="text-[#2f5f92]">{row.value}</span>
                          <button
                            type="button"
                            className="rounded-full text-[10px] leading-none text-[#2f5f92] hover:text-[#17395b]"
                            aria-label={`Remove option ${row.key} ${row.value}`}
                            disabled={isLocked}
                            onClick={() =>
                              onVariantsChange(
                                updateVariant(variants, variant.id, (entry) => ({
                                  ...entry,
                                  optionRows: entry.optionRows.filter(
                                    (optionRow) => optionRow.id !== row.id,
                                  ),
                                })),
                              )
                            }
                          >
                            x
                          </button>
                        </span>
                      ))
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2"
                      disabled={isLocked}
                      onClick={() => onOpenOptionModal(variant.id)}
                    >
                      + Option
                    </Button>
                  </div>
                </div>
                {showActiveToggle ? (
                  <div className="grid gap-1 lg:col-span-1">
                    <Label className="lg:hidden">Active</Label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground lg:text-[10px]">
                      <input
                        type="checkbox"
                        checked={variant.isActive ?? true}
                        onChange={(event) =>
                          onVariantsChange(
                            updateVariant(variants, variant.id, (entry) => ({
                              ...entry,
                              isActive: event.target.checked,
                            })),
                          )
                        }
                      />
                      <span className="lg:hidden">Active</span>
                    </label>
                  </div>
                ) : null}
                <div className="grid gap-1 lg:col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={variants.length <= 1 || isLocked}
                    onClick={() =>
                      onVariantsChange(variants.filter((entry) => entry.id !== variant.id))
                    }
                  >
                    {removeVariantLabel}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
