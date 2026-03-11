import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
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
  onBulkVariantPurge?: (variantIds: string[]) => void;
  onVariantNameChange?: (variantId: string, name: string) => void;
  onVariantSkuChange?: (variantId: string, sku: string) => void;
  onAddVariant: () => void;
  showAddVariantAction?: boolean;
  addVariantLabel?: string;
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
  onBulkVariantPurge,
  onVariantNameChange,
  onVariantSkuChange,
  onAddVariant,
  showAddVariantAction = true,
  addVariantLabel = "Add Variant",
  denseInputClassName = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]",
  showActiveToggle = false,
  showPricingFields = false,
  showPurchasePrice = true,
  showGstSlabField = false,
  disabled = false,
}: ItemVariantCardsEditorProps) {
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
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

  const selectableVariantIds = useMemo(
    () =>
      variants
        .filter((variant) => !disabled && !variant.isLocked)
        .map((variant) => variant.id),
    [disabled, variants],
  );
  const selectedEditableVariantIds = useMemo(
    () => selectedVariantIds.filter((id) => selectableVariantIds.includes(id)),
    [selectedVariantIds, selectableVariantIds],
  );
  const allSelectableSelected =
    selectableVariantIds.length > 0 &&
    selectedEditableVariantIds.length === selectableVariantIds.length;
  const hasSelectedVariants = selectedEditableVariantIds.length > 0;
  const canBulkDelete =
    hasSelectedVariants &&
    selectedEditableVariantIds.length < variants.length &&
    selectedEditableVariantIds.every(
      (variantId) =>
        variantId.startsWith("temp-") || Boolean(onBulkVariantPurge || onVariantPurge),
    );
  const bulkDeleteDisabledReason = !hasSelectedVariants
    ? "Select one or more variants first."
    : selectedEditableVariantIds.length === variants.length
      ? "At least one variant must remain."
      : !selectedEditableVariantIds.every(
            (variantId) =>
              variantId.startsWith("temp-") || Boolean(onBulkVariantPurge || onVariantPurge),
          )
        ? "One or more selected variants cannot be deleted."
        : null;

  useEffect(() => {
    if (!showBulkMenu) {
      return;
    }

    const handlePointerDown = () => setShowBulkMenu(false);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showBulkMenu]);

  const handleToggleSelection = (variantId: string, checked: boolean) => {
    setSelectedVariantIds((current) =>
      checked ? [...current.filter((id) => id !== variantId), variantId] : current.filter((id) => id !== variantId),
    );
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedVariantIds(checked ? selectableVariantIds : []);
  };

  const handleBulkSetActive = (nextIsActive: boolean) => {
    if (!hasSelectedVariants) {
      return;
    }

    const selectedSet = new Set(selectedEditableVariantIds);
    onVariantsChange(
      variants.map((variant) =>
        selectedSet.has(variant.id) ? { ...variant, isActive: nextIsActive } : variant,
      ),
    );
    setShowBulkMenu(false);
  };

  const handleBulkDelete = () => {
    if (!canBulkDelete) {
      return;
    }

    const selectedSet = new Set(selectedEditableVariantIds);
    const tempVariantIds = selectedEditableVariantIds.filter((variantId) => variantId.startsWith("temp-"));
    const persistedVariantIds = selectedEditableVariantIds.filter((variantId) => !variantId.startsWith("temp-"));

    if (tempVariantIds.length > 0) {
      onVariantsChange(variants.filter((variant) => !selectedSet.has(variant.id)));
    }

    if (persistedVariantIds.length > 0) {
      if (onBulkVariantPurge) {
        onBulkVariantPurge(persistedVariantIds);
      } else {
        persistedVariantIds.forEach((variantId) => onVariantPurge?.(variantId));
      }
    }

    setSelectedVariantIds([]);
    setShowBulkMenu(false);
  };

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
      "2rem",
      "minmax(0, 1.8fr)",
      ...optionColumnWidths,
      ...columnsAfterName,
      "4.25rem",
    ].join(" ");
  })();

  return (
    <div className="grid w-full gap-1.5 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border/80 lg:bg-card">
      <div className="flex items-center justify-between gap-1.5 lg:shrink-0 lg:border-b lg:border-border/70 lg:px-2 lg:py-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium text-foreground lg:text-[10px]">Variants</p>
          {selectedEditableVariantIds.length > 0 ? (
            <span className="text-[10px] text-muted-foreground">
              {selectedEditableVariantIds.length} selected
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="relative"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2"
              disabled={!hasSelectedVariants || disabled}
              onClick={() => setShowBulkMenu((current) => !current)}
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Bulk Actions
            </Button>
            {showBulkMenu ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] rounded-lg border border-border/80 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
                <div className="grid gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] text-[#15314e]"
                    onClick={() => handleBulkSetActive(true)}
                  >
                    Mark active
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] text-[#15314e]"
                    onClick={() => handleBulkSetActive(false)}
                  >
                    Mark inactive
                  </Button>
                  <div
                    title={!canBulkDelete ? bulkDeleteDisabledReason ?? undefined : undefined}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-start gap-1.5 px-2.5 text-[11px] text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                      disabled={!canBulkDelete}
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete selected
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
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
      </div>

      <div className="grid gap-1 lg:max-h-[22rem] lg:min-h-0 lg:overflow-y-auto lg:p-0">
        <div
          className="hidden bg-slate-50/95 lg:grid lg:[grid-template-columns:var(--variant-grid-cols)] lg:items-center lg:gap-1 lg:border-b lg:border-border/70 lg:px-2 lg:py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
          style={{ "--variant-grid-cols": desktopGridTemplate } as CSSProperties}
        >
          <span className="flex justify-center">
            <Checkbox
              checked={allSelectableSelected}
              disabled={selectableVariantIds.length === 0}
              aria-label="Select all variants"
              onChange={(event) => handleToggleSelectAll(event.target.checked)}
            />
          </span>
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
        </div>
        {variants.map((variant) => {
          const isLocked = Boolean(variant.isLocked);
          const isReadOnly = disabled || isLocked;
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
                <div className="grid gap-1 lg:justify-items-center">
                  <Label className="lg:hidden">Select</Label>
                  <Checkbox
                    checked={selectedVariantIds.includes(variant.id)}
                    disabled={isReadOnly}
                    aria-label={`Select ${variant.name || variant.sku || "variant"}`}
                    onChange={(event) =>
                      handleToggleSelection(variant.id, event.target.checked)
                    }
                  />
                </div>
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
