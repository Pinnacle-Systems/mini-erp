import { Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";

export type VariantOptionRowDraft = {
  id: string;
  key: string;
  value: string;
};

export type ItemVariantDraft = {
  id: string;
  name: string;
  nameManuallyEdited?: boolean;
  sku: string;
  skuManuallyEdited?: boolean;
  barcode: string;
  salesPrice?: string;
  purchasePrice?: string;
  gstSlab?: string;
  optionRows: VariantOptionRowDraft[];
  isActive?: boolean;
  isLocked?: boolean;
  usageCount?: number;
};

type ItemVariantCardsEditorProps = {
  variants: ItemVariantDraft[];
  onVariantsChange: (next: ItemVariantDraft[]) => void;
  onVariantPurge?: (variantId: string) => void;
  onVariantNameChange?: (variantId: string, name: string) => void;
  onVariantSkuChange?: (variantId: string, sku: string) => void;
  onAddVariant: () => void;
  showAddVariantAction?: boolean;
  addVariantLabel?: string;
  removeVariantLabel?: string;
  denseInputClassName?: string;
  showActiveToggle?: boolean;
  showPricingFields?: boolean;
  showPurchasePrice?: boolean;
  showGstSlabField?: boolean;
  disabled?: boolean;
};

const updateVariant = (
  variants: ItemVariantDraft[],
  variantId: string,
  updater: (variant: ItemVariantDraft) => ItemVariantDraft,
) =>
  variants.map((entry) => (entry.id === variantId ? updater(entry) : entry));

const normalizeOptionKey = (value: string) => value.trim().toLowerCase();

export function ItemVariantCardsEditor({
  variants,
  onVariantsChange,
  onVariantPurge,
  onVariantNameChange,
  onVariantSkuChange,
  onAddVariant,
  showAddVariantAction = true,
  addVariantLabel = "Add Variant",
  removeVariantLabel = "Remove variant",
  denseInputClassName = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]",
  showActiveToggle = false,
  showPricingFields = false,
  showPurchasePrice = true,
  showGstSlabField = false,
  disabled = false,
}: ItemVariantCardsEditorProps) {
  const optionColumns = variants.reduce<Array<{ id: string; label: string }>>((columns, variant) => {
    for (const option of variant.optionRows) {
      const trimmed = option.key.trim();
      if (!trimmed) continue;
      const normalized = normalizeOptionKey(trimmed);
      if (columns.some((column) => column.id === normalized)) continue;
      columns.push({ id: normalized, label: trimmed });
    }
    return columns;
  }, []);

  const desktopGridTemplate = (() => {
    const columnsAfterName = showPricingFields
      ? showPurchasePrice
        ? [
            "minmax(0, 1.6fr)",
            "minmax(0, 1.3fr)",
            "minmax(0, 1.6fr)",
            "minmax(0, 1.1fr)",
            "minmax(0, 1.3fr)",
          ]
        : [
            "minmax(0, 1.8fr)",
            "minmax(0, 1.2fr)",
            "minmax(0, 1.8fr)",
            "minmax(0, 1.4fr)",
          ]
      : showGstSlabField
        ? ["minmax(0, 2fr)", "minmax(0, 2fr)", "minmax(0, 1.25fr)"]
      : ["minmax(0, 2fr)", "minmax(0, 2fr)"];
    const optionColumnWidths = optionColumns.map(() => "minmax(0, 1.3fr)");
    return [
      "minmax(0, 1.8fr)",
      ...optionColumnWidths,
      ...columnsAfterName,
      "4.25rem",
      "4.5rem",
    ].join(" ");
  })();

  return (
    <div className="grid w-full gap-1.5 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border/80 lg:bg-card">
      <div className="flex items-center justify-between gap-1.5 lg:shrink-0 lg:border-b lg:border-border/70 lg:px-2 lg:py-1.5">
        <p className="text-[11px] font-medium text-foreground lg:text-[10px]">Variants</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`hidden h-7 px-2 lg:inline-flex ${showAddVariantAction ? "" : "lg:hidden"}`}
          onClick={onAddVariant}
          disabled={disabled}
        >
          {addVariantLabel}
        </Button>
      </div>

      <div className="grid gap-1 lg:max-h-[22rem] lg:min-h-0 lg:overflow-y-auto lg:p-0">
        <div
          className="hidden bg-slate-50/95 lg:grid lg:[grid-template-columns:var(--variant-grid-cols)] lg:items-center lg:gap-1 lg:border-b lg:border-border/70 lg:px-2 lg:py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
          style={{ "--variant-grid-cols": desktopGridTemplate } as CSSProperties}
        >
          <span>Name</span>
          {optionColumns.map((column) => (
            <span key={column.id}>{column.label}</span>
          ))}
          <span>SKU</span>
          <span>Barcode</span>
          {showPricingFields ? <span>Sales</span> : null}
          {showPricingFields && showPurchasePrice ? <span>Purchase</span> : null}
          {showPricingFields || showGstSlabField ? <span>GST %</span> : null}
          <span className="text-center">{showActiveToggle ? "Active" : ""}</span>
          <span className="text-center">Actions</span>
        </div>
        {variants.map((variant) => {
          const isLocked = Boolean(variant.isLocked);
          const isReadOnly = disabled || isLocked;
          const canTriggerPersistedDelete = Boolean(onVariantPurge) && !variant.id.startsWith("temp-");
          const removeDisabled =
            disabled || isLocked || (!canTriggerPersistedDelete && variants.length <= 1);
          const onRemoveVariant = () => {
            if (canTriggerPersistedDelete) {
              onVariantPurge?.(variant.id);
              return;
            }
            onVariantsChange(variants.filter((entry) => entry.id !== variant.id));
          };
          const optionByColumn = new Map(
            variant.optionRows.map((option) => [normalizeOptionKey(option.key), option] as const),
          );
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
              <div
                className="grid gap-1.5 lg:grid lg:[grid-template-columns:var(--variant-grid-cols)] lg:items-center lg:gap-1"
                style={{ "--variant-grid-cols": desktopGridTemplate } as CSSProperties}
              >
                <div className="grid gap-1">
                  <Label className="lg:hidden">Name</Label>
                  <Input
                    className={denseInputClassName}
                    value={variant.name}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      onVariantNameChange
                        ? onVariantNameChange(variant.id, event.target.value)
                        : onVariantsChange(
                            updateVariant(variants, variant.id, (entry) => ({
                              ...entry,
                              name: event.target.value,
                            })),
                          )
                    }
                    placeholder="Variant name"
                  />
                </div>
                {optionColumns.map((column) => {
                  const option = optionByColumn.get(column.id);
                  return (
                    <div
                      key={`${variant.id}:${column.id}`}
                      className="grid gap-1 lg:flex lg:min-h-7 lg:items-center"
                    >
                      <Label className="lg:hidden">{column.label}</Label>
                      <span className="text-[11px] text-foreground lg:text-[10px]">
                        {option?.value?.trim() ? option.value.toUpperCase() : "-"}
                      </span>
                    </div>
                  );
                })}
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
                {showPricingFields || showGstSlabField ? (
                  <div className="grid gap-1">
                    <Label className="lg:hidden">GST %</Label>
                    <GstSlabSelect
                      className={denseInputClassName}
                      value={variant.gstSlab ?? ""}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        onVariantsChange(
                          updateVariant(variants, variant.id, (entry) => ({
                            ...entry,
                            gstSlab: event.target.value,
                          })),
                        )
                      }
                    />
                  </div>
                ) : null}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removeDisabled}
                    onClick={onRemoveVariant}
                    className="h-7 justify-self-start gap-1.5 px-2 text-[11px] text-[#8a2b2b] hover:bg-[#fff5f5] hover:text-[#7a1f1f] lg:hidden"
                  >
                    <Trash2 aria-hidden="true" />
                    <span>{removeVariantLabel}</span>
                  </Button>
                  <IconButton
                    type="button"
                    icon={Trash2}
                    variant="ghost"
                    disabled={removeDisabled}
                    onClick={onRemoveVariant}
                    className="hidden h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f] lg:inline-flex"
                    aria-label={removeVariantLabel}
                    title={removeVariantLabel}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div className="pt-0.5 lg:hidden">
          {showAddVariantAction ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
