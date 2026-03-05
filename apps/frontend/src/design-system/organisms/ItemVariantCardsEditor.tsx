import { Trash2 } from "lucide-react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { VariantOptionPills } from "../molecules/VariantOptionPills";

export type VariantOptionRowDraft = {
  id: string;
  key: string;
  value: string;
};

export type ItemVariantDraft = {
  id: string;
  name: string;
  sku: string;
  skuManuallyEdited?: boolean;
  barcode: string;
  salesPrice?: string;
  purchasePrice?: string;
  optionRows: VariantOptionRowDraft[];
  isActive?: boolean;
  isLocked?: boolean;
  usageCount?: number;
};

type ItemVariantCardsEditorProps = {
  variants: ItemVariantDraft[];
  onVariantsChange: (next: ItemVariantDraft[]) => void;
  onVariantSkuChange?: (variantId: string, sku: string) => void;
  onAddVariant: () => void;
  onOpenOptionModal: (variantId: string) => void;
  addVariantLabel?: string;
  removeVariantLabel?: string;
  denseInputClassName?: string;
  showActiveToggle?: boolean;
  showPricingFields?: boolean;
  showPurchasePrice?: boolean;
  disabled?: boolean;
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
  onVariantSkuChange,
  onAddVariant,
  onOpenOptionModal,
  addVariantLabel = "Add Variant",
  removeVariantLabel = "Remove variant",
  denseInputClassName = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]",
  showActiveToggle = false,
  showPricingFields = false,
  showPurchasePrice = true,
  disabled = false,
}: ItemVariantCardsEditorProps) {
  const desktopGridClass = showPricingFields
    ? showPurchasePrice
      ? "lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,2.4fr)_4.25rem_3.5rem]"
      : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,2.5fr)_4.25rem_3.5rem]"
    : "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_4.25rem_3.5rem]";

  return (
    <div className="grid gap-1.5 lg:self-start lg:overflow-hidden lg:rounded-lg lg:border lg:border-border/80 lg:bg-card">
      <div className="flex items-center justify-between gap-1.5 lg:shrink-0 lg:border-b lg:border-border/70 lg:px-2 lg:py-1.5">
        <p className="text-[11px] font-medium text-foreground lg:text-[10px]">Variants</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-7 px-2 lg:inline-flex"
          onClick={onAddVariant}
          disabled={disabled}
        >
          {addVariantLabel}
        </Button>
      </div>

      <div className="grid gap-1 lg:max-h-[22rem] lg:min-h-0 lg:overflow-y-auto lg:p-0">
        <div className={`hidden bg-slate-50/95 lg:grid lg:items-center lg:gap-1 lg:border-b lg:border-border/70 lg:px-2 lg:py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${desktopGridClass}`}>
          <span>Name</span>
          <span>SKU</span>
          <span>Barcode</span>
          {showPricingFields ? <span>Sales</span> : null}
          {showPricingFields && showPurchasePrice ? <span>Purchase</span> : null}
          <span>Options</span>
          <span className="text-center">{showActiveToggle ? "Active" : ""}</span>
          <span className="text-center">Actions</span>
        </div>
        {variants.map((variant) => {
          const isLocked = Boolean(variant.isLocked);
          const isReadOnly = disabled || isLocked;
          return (
            <div
              key={variant.id}
              className="rounded-xl border border-border/70 bg-white/90 p-1.5 lg:rounded-none lg:border-0 lg:border-b lg:border-border/70 lg:bg-transparent lg:px-2 lg:py-1.5 last:lg:border-b-0"
            >
              {isLocked ? (
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                  Used in {variant.usageCount ?? 0} record
                  {(variant.usageCount ?? 0) === 1 ? "" : "s"}: SKU, name, barcode, options,
                  and delete are locked.
                </p>
              ) : null}
              <div className={`grid gap-1.5 lg:items-center lg:gap-1 ${desktopGridClass}`}>
                <div className="grid gap-1">
                  <Label className="lg:hidden">Name</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.name}
                    disabled={isReadOnly}
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
                <div className="grid gap-1">
                  <Label className="lg:hidden">SKU</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.sku}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      onVariantSkuChange
                        ? onVariantSkuChange(variant.id, event.target.value)
                        : onVariantsChange(
                            updateVariant(variants, variant.id, (entry) => ({
                              ...entry,
                              sku: event.target.value,
                            })),
                          )
                    }
                    placeholder="Variant SKU"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="lg:hidden">Barcode</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.barcode}
                    disabled={isReadOnly}
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
                {showPricingFields ? (
                  <div className="grid gap-1">
                    <Label className="lg:hidden">Sales</Label>
                    <Input
                      className={denseInputClassName}
                      value={variant.salesPrice ?? ""}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        onVariantsChange(
                          updateVariant(variants, variant.id, (entry) => ({
                            ...entry,
                            salesPrice: event.target.value,
                          })),
                        )
                      }
                      placeholder="Sales price"
                      inputMode="decimal"
                    />
                  </div>
                ) : null}
                {showPricingFields && showPurchasePrice ? (
                  <div className="grid gap-1">
                    <Label className="lg:hidden">Purchase</Label>
                    <Input
                      className={denseInputClassName}
                      value={variant.purchasePrice ?? ""}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        onVariantsChange(
                          updateVariant(variants, variant.id, (entry) => ({
                            ...entry,
                            purchasePrice: event.target.value,
                          })),
                        )
                      }
                      placeholder="Purchase price"
                      inputMode="decimal"
                    />
                  </div>
                ) : null}
                <div className="grid gap-1 lg:content-center">
                  <Label className="lg:hidden">Options</Label>
                  <div className="flex min-h-8 flex-wrap content-center items-center gap-1 rounded-md border border-border/70 bg-background/60 px-1.5 py-1 lg:min-h-7">
                    <VariantOptionPills
                      options={variant.optionRows}
                      emptyLabel="No options"
                      onRemoveOption={(option) =>
                        onVariantsChange(
                          updateVariant(variants, variant.id, (entry) => ({
                            ...entry,
                            optionRows: entry.optionRows.filter(
                              (optionRow) => optionRow.id !== option.id,
                            ),
                          })),
                        )
                      }
                      removeDisabled={isReadOnly}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={isReadOnly}
                      onClick={() => onOpenOptionModal(variant.id)}
                    >
                      + Option
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1 lg:justify-items-center">
                  <Label className="lg:hidden">Active</Label>
                  {showActiveToggle ? (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground lg:text-[10px]">
                      <input
                        type="checkbox"
                        checked={variant.isActive ?? true}
                        disabled={isReadOnly}
                        aria-label={`Active state for ${variant.name || "variant"}`}
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
                  ) : (
                    <span className="hidden lg:block" aria-hidden="true" />
                  )}
                </div>
                <div className="grid gap-1 lg:justify-items-center">
                  <IconButton
                    type="button"
                    icon={Trash2}
                    variant="ghost"
                    disabled={disabled || variants.length <= 1 || isLocked}
                    onClick={() =>
                      onVariantsChange(variants.filter((entry) => entry.id !== variant.id))
                    }
                    className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                    aria-label={removeVariantLabel}
                    title={removeVariantLabel}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div className="pt-0.5 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full"
            onClick={onAddVariant}
            disabled={disabled}
          >
            {addVariantLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
