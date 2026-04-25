import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";
import {
  TabularBody,
  TabularCell,
  TabularFooter,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../molecules/tabularSerialNumbers";
import {
  spreadsheetCellControlClassName,
  spreadsheetCellNumericClassName,
  spreadsheetCellSelectClassName,
} from "../../design-system/molecules/spreadsheetStyles";
import {
  tabularFooterButtonClassName,
  tabularNumericClassName,
} from "../molecules/tabularTokens";
import {
  useSpreadsheetNavigation,
  type SpreadsheetAppendMode,
} from "../../design-system/molecules/useSpreadsheetNavigation";
import { cn } from "../../lib/utils";

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
  appendMode?: SpreadsheetAppendMode;
  generatedVariantMode?: boolean;
  onResetGeneratedVariants?: () => void;
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

type EditableFieldKey = "name" | "sku" | "barcode" | "salesPrice" | "purchasePrice" | "gstSlab";

const FIRST_EDITABLE_FIELD: EditableFieldKey = "name";

const isVariantRowEmpty = (variant: ItemVariantDraft) =>
  variant.name.trim().length === 0 &&
  variant.sku.trim().length === 0 &&
  variant.barcode.trim().length === 0 &&
  (variant.salesPrice ?? "").trim().length === 0 &&
  (variant.purchasePrice ?? "").trim().length === 0;

export function ItemVariantCardsEditor({
  variants,
  onVariantsChange,
  onVariantPurge,
  onBulkVariantPurge,
  onVariantNameChange,
  onVariantSkuChange,
  onAddVariant,
  appendMode = "grow-as-needed",
  generatedVariantMode = false,
  onResetGeneratedVariants,
  showAddVariantAction = true,
  addVariantLabel = "Add Variant",
  denseInputClassName = "app-catalog-editor-input",
  showActiveToggle = false,
  showPricingFields = false,
  showPurchasePrice = true,
  showGstSlabField = false,
  disabled = false,
}: ItemVariantCardsEditorProps) {
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [pendingAppendedRowFocus, setPendingAppendedRowFocus] = useState(false);
  const [highlightedVariantId, setHighlightedVariantId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousVariantIdsRef = useRef<string[]>(variants.map((variant) => variant.id));
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
  const showManualAddAction = showAddVariantAction && !generatedVariantMode;
  const canBulkDelete =
    hasSelectedVariants &&
    (generatedVariantMode || selectedEditableVariantIds.length < variants.length) &&
    selectedEditableVariantIds.every(
      (variantId) =>
        variantId.startsWith("temp-") || Boolean(onBulkVariantPurge || onVariantPurge),
    );
  const bulkDeleteDisabledReason = !hasSelectedVariants
    ? generatedVariantMode
      ? "Select one or more combinations first."
      : "Select one or more variants first."
    : !generatedVariantMode && selectedEditableVariantIds.length === variants.length
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
            "minmax(0, 1.35fr)",
            "minmax(0, 1.35fr)",
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
    return withTabularSerialNumberColumn(
      [
        "2rem",
        "minmax(0, 1.8fr)",
        ...optionColumnWidths,
        ...columnsAfterName,
        ...(showActiveToggle ? ["4.25rem"] : []),
      ].join(" "),
    );
  })();

  const getDesktopInputClassName = (options?: {
    numeric?: boolean;
    textPadding?: boolean;
    select?: boolean;
  }) =>
    cn(
      options?.select ? spreadsheetCellSelectClassName : spreadsheetCellControlClassName,
      options?.numeric ? spreadsheetCellNumericClassName : undefined,
      options?.textPadding ? "lg:pl-2" : undefined,
    );

  const editableFieldOrder = useMemo<EditableFieldKey[]>(() => {
    const fields: EditableFieldKey[] = ["name", "sku", "barcode"];
    if (showPricingFields) {
      fields.push("salesPrice");
      if (showPurchasePrice) {
        fields.push("purchasePrice");
      }
    }
    if (showPricingFields || showGstSlabField) {
      fields.push("gstSlab");
    }
    return fields;
  }, [showGstSlabField, showPricingFields, showPurchasePrice]);

  const editableVariantIds = useMemo(
    () => variants.filter((variant) => !disabled && !variant.isLocked).map((variant) => variant.id),
    [disabled, variants],
  );
  const {
    focusCell,
    getCellDataAttributes,
    handleCellFocus,
    handleCellKeyDown,
  } = useSpreadsheetNavigation<EditableFieldKey>({
    containerRef,
    getRowOrder: () => editableVariantIds,
    getFieldOrderForRow: () => editableFieldOrder,
    appendMode,
    canAppendFromRow: (variantId) => {
      const currentVariant = variants.find((variant) => variant.id === variantId);
      return Boolean(currentVariant && !isVariantRowEmpty(currentVariant));
    },
    onRequestAppendRow:
      appendMode === "grow-as-needed"
        ? () => {
            setPendingAppendedRowFocus(true);
            onAddVariant();
          }
        : undefined,
  });

  useEffect(() => {
    if (!pendingAppendedRowFocus) {
      previousVariantIdsRef.current = variants.map((variant) => variant.id);
      return;
    }

    const previousVariantIds = new Set(previousVariantIdsRef.current);
    const appendedVariant = variants.find((variant) => !previousVariantIds.has(variant.id));
    previousVariantIdsRef.current = variants.map((variant) => variant.id);

    if (!appendedVariant) {
      return;
    }

    focusCell(appendedVariant.id, FIRST_EDITABLE_FIELD);
    setHighlightedVariantId(appendedVariant.id);
    setPendingAppendedRowFocus(false);
  }, [focusCell, pendingAppendedRowFocus, variants]);

  useEffect(() => {
    if (!highlightedVariantId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHighlightedVariantId((current) => (current === highlightedVariantId ? null : current));
    }, 1400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedVariantId]);

  return (
    <div className="grid w-full gap-1.5 lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border/80 lg:bg-card">
      <div className="flex items-center justify-between gap-1.5 lg:shrink-0 lg:border-b lg:border-border/70 lg:px-2 lg:py-1.5">
        <div className="flex items-center gap-2">
          <p className="app-shell-action-title lg:text-[10px]">Variants</p>
          {selectedEditableVariantIds.length > 0 ? (
            <span className="app-shell-caption lg:text-[10px]">
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
              className="app-mobile-action-button gap-1.5"
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
                    className="app-shell-menu-button text-[#15314e]"
                    onClick={() => handleBulkSetActive(true)}
                  >
                    Mark active
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="app-shell-menu-button text-[#15314e]"
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
                      className="app-shell-menu-button text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                      disabled={!canBulkDelete}
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {generatedVariantMode ? "Remove selected" : "Delete selected"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {generatedVariantMode && onResetGeneratedVariants ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="app-mobile-action-button"
              disabled={disabled}
              onClick={onResetGeneratedVariants}
            >
              Reset to all combinations
            </Button>
          ) : null}
        </div>
      </div>

      {generatedVariantMode && variants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-slate-50 px-3 py-4 text-sm text-muted-foreground lg:mx-1">
          <div>All generated combinations are currently excluded.</div>
          {onResetGeneratedVariants ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="app-mobile-action-button mt-2"
              disabled={disabled}
              onClick={onResetGeneratedVariants}
            >
              Reset to all combinations
            </Button>
          ) : null}
        </div>
      ) : null}

      {variants.length > 0 ? (
        <>
          <div className="grid gap-1 lg:hidden">
            {variants.map((variant) => {
              const isLocked = Boolean(variant.isLocked);
              const isReadOnly = disabled || isLocked;
              const optionByColumn = new Map(
                variant.optionRows.map((option) => [normalizeOptionKey(option.key), option] as const),
              );

              return (
                <div
                  key={variant.id}
                  className={`app-mobile-variant-card ${
                    highlightedVariantId === variant.id ? "bg-sky-50/90" : "bg-white/90"
                  }`}
                >
                  {isLocked ? (
                    <p className="app-shell-caption mb-2 font-medium">
                      Used in {variant.usageCount ?? 0} record
                      {(variant.usageCount ?? 0) === 1 ? "" : "s"}: SKU, name, barcode, options,
                      and delete are locked.
                    </p>
                  ) : null}
                  <div className="app-mobile-variant-grid">
                    <div className="app-mobile-variant-field">
                      <Label>Select</Label>
                      <Checkbox
                        checked={selectedVariantIds.includes(variant.id)}
                        disabled={isReadOnly}
                        aria-label={`Select ${variant.name || variant.sku || "variant"}`}
                        onChange={(event) =>
                          handleToggleSelection(variant.id, event.target.checked)
                        }
                      />
                    </div>
                    <div className="app-mobile-variant-field">
                      <Label>Name</Label>
                      <Input
                        {...getCellDataAttributes(variant.id, "name")}
                        data-variant-grid-cell={`${variant.id}:name`}
                        className={denseInputClassName}
                        value={variant.name}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "name")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "name")}
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
                          className="app-mobile-variant-field"
                        >
                          <Label>{column.label}</Label>
                          <span className="app-mobile-variant-value">
                            {option?.value?.trim() ? option.value.toUpperCase() : "-"}
                          </span>
                        </div>
                      );
                    })}
                    <div className="app-mobile-variant-field">
                      <Label>SKU</Label>
                      <Input
                        {...getCellDataAttributes(variant.id, "sku")}
                        data-variant-grid-cell={`${variant.id}:sku`}
                        className={denseInputClassName}
                        value={variant.sku}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "sku")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "sku")}
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
                    <div className="app-mobile-variant-field">
                      <Label>Barcode</Label>
                      <Input
                        {...getCellDataAttributes(variant.id, "barcode")}
                        data-variant-grid-cell={`${variant.id}:barcode`}
                        className={denseInputClassName}
                        value={variant.barcode}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "barcode")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "barcode")}
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
                      <div className="app-mobile-variant-field">
                        <Label>Sales</Label>
                        <Input
                          {...getCellDataAttributes(variant.id, "salesPrice")}
                          data-variant-grid-cell={`${variant.id}:salesPrice`}
                          className={denseInputClassName}
                          value={variant.salesPrice ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "salesPrice")}
                          onKeyDown={(event) => handleCellKeyDown(event, variant.id, "salesPrice")}
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
                      <div className="app-mobile-variant-field">
                        <Label>Purchase</Label>
                        <Input
                          {...getCellDataAttributes(variant.id, "purchasePrice")}
                          data-variant-grid-cell={`${variant.id}:purchasePrice`}
                          className={denseInputClassName}
                          value={variant.purchasePrice ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "purchasePrice")}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, variant.id, "purchasePrice")
                          }
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
                      <div className="app-mobile-variant-field">
                        <Label>GST %</Label>
                        <GstSlabSelect
                          {...getCellDataAttributes(variant.id, "gstSlab")}
                          data-variant-grid-cell={`${variant.id}:gstSlab`}
                          className={denseInputClassName}
                          value={variant.gstSlab ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "gstSlab")}
                          onKeyDown={(event) => handleCellKeyDown(event, variant.id, "gstSlab")}
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
                    <div className="app-mobile-variant-field">
                      <Label>Active</Label>
                      {showActiveToggle ? (
                        <label className="app-mobile-variant-inline-control">
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
                          <span>Active</span>
                        </label>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-0.5">
              {showManualAddAction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="app-shell-header-control w-full"
                  onClick={onAddVariant}
                  disabled={disabled}
                >
                  {addVariantLabel}
                </Button>
              ) : null}
            </div>
          </div>

          <TabularSurface
            ref={containerRef}
            role="grid"
            aria-label="Variants"
            className="hidden lg:flex lg:max-h-[22rem] lg:min-h-0 lg:flex-1"
          >
            <TabularHeader>
              <TabularRow columns={desktopGridTemplate}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header" align="center" className="px-0">
                  <Checkbox
                    className="mx-auto"
                    checked={allSelectableSelected}
                    disabled={selectableVariantIds.length === 0}
                    aria-label="Select all variants"
                    onChange={(event) => handleToggleSelectAll(event.target.checked)}
                  />
                </TabularCell>
                <TabularCell variant="header">Name</TabularCell>
                {optionColumns.map((column) => (
                  <TabularCell key={column.id} variant="header">
                    {column.label}
                  </TabularCell>
                ))}
                <TabularCell variant="header">SKU</TabularCell>
                <TabularCell variant="header">Barcode</TabularCell>
                {showPricingFields ? (
                  <TabularCell variant="header" align="end">
                    Sales
                  </TabularCell>
                ) : null}
                {showPricingFields && showPurchasePrice ? (
                  <TabularCell variant="header" align="end">
                    Purchase
                  </TabularCell>
                ) : null}
                {showPricingFields || showGstSlabField ? (
                  <TabularCell variant="header">GST %</TabularCell>
                ) : null}
                {showActiveToggle ? (
                  <TabularCell variant="header" align="center">
                    Active
                  </TabularCell>
                ) : null}
              </TabularRow>
            </TabularHeader>

            <TabularBody>
              {variants.map((variant, index) => {
                const isLocked = Boolean(variant.isLocked);
                const isReadOnly = disabled || isLocked;
                const optionByColumn = new Map(
                  variant.optionRows.map((option) => [normalizeOptionKey(option.key), option] as const),
                );

                return (
                  <TabularRow
                    key={variant.id}
                    columns={desktopGridTemplate}
                    interactive
                    className={cn(
                      highlightedVariantId === variant.id ? "bg-sky-50/80" : undefined,
                    )}
                    title={
                      isLocked
                        ? `Used in ${variant.usageCount ?? 0} record${(variant.usageCount ?? 0) === 1 ? "" : "s"}: SKU, name, barcode, options, and delete are locked.`
                        : undefined
                    }
                  >
                    <TabularSerialNumberCell index={index} />
                    <TabularCell variant="editable" align="center" className="px-0">
                      <Checkbox
                        className="mx-auto"
                        checked={selectedVariantIds.includes(variant.id)}
                        disabled={isReadOnly}
                        aria-label={`Select ${variant.name || variant.sku || "variant"}`}
                        onChange={(event) =>
                          handleToggleSelection(variant.id, event.target.checked)
                        }
                      />
                    </TabularCell>
                    <TabularCell variant="editable" className="px-[var(--tabular-cell-padding-x)]">
                      <Input
                        unstyled
                        {...getCellDataAttributes(variant.id, "name")}
                        data-variant-grid-cell={`${variant.id}:name`}
                        className={cn(
                          "w-full",
                          getDesktopInputClassName(),
                        )}
                        title={variant.name}
                        value={variant.name}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "name")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "name")}
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
                    </TabularCell>
                    {optionColumns.map((column) => {
                      const option = optionByColumn.get(column.id);
                      const optionDisplay = option?.value?.trim() ? option.value.toUpperCase() : "-";
                      return (
                        <TabularCell
                          key={`${variant.id}:${column.id}`}
                          truncate
                          hoverTitle={optionDisplay}
                        >
                          {optionDisplay}
                        </TabularCell>
                      );
                    })}
                    <TabularCell variant="editable" className="px-[var(--tabular-cell-padding-x)]">
                      <Input
                        unstyled
                        {...getCellDataAttributes(variant.id, "sku")}
                        data-variant-grid-cell={`${variant.id}:sku`}
                        className={cn(
                          "w-full",
                          getDesktopInputClassName(),
                        )}
                        title={variant.sku}
                        value={variant.sku}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "sku")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "sku")}
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
                    </TabularCell>
                    <TabularCell variant="editable" className="px-[var(--tabular-cell-padding-x)]">
                      <Input
                        unstyled
                        {...getCellDataAttributes(variant.id, "barcode")}
                        data-variant-grid-cell={`${variant.id}:barcode`}
                        className={cn(
                          "w-full",
                          getDesktopInputClassName(),
                        )}
                        title={variant.barcode}
                        value={variant.barcode}
                        disabled={isReadOnly}
                        onFocus={() => handleCellFocus(variant.id, "barcode")}
                        onKeyDown={(event) => handleCellKeyDown(event, variant.id, "barcode")}
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
                    </TabularCell>
                    {showPricingFields ? (
                      <TabularCell variant="editable" align="end">
                        <Input
                          unstyled
                          {...getCellDataAttributes(variant.id, "salesPrice")}
                          data-variant-grid-cell={`${variant.id}:salesPrice`}
                          className={cn(
                            "w-full",
                            getDesktopInputClassName({ numeric: true }),
                            tabularNumericClassName,
                          )}
                          value={variant.salesPrice ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "salesPrice")}
                          onKeyDown={(event) => handleCellKeyDown(event, variant.id, "salesPrice")}
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
                      </TabularCell>
                    ) : null}
                    {showPricingFields && showPurchasePrice ? (
                      <TabularCell variant="editable" align="end">
                        <Input
                          unstyled
                          {...getCellDataAttributes(variant.id, "purchasePrice")}
                          data-variant-grid-cell={`${variant.id}:purchasePrice`}
                          className={cn(
                            "w-full",
                            getDesktopInputClassName({ numeric: true }),
                            tabularNumericClassName,
                          )}
                          value={variant.purchasePrice ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "purchasePrice")}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, variant.id, "purchasePrice")
                          }
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
                      </TabularCell>
                    ) : null}
                    {showPricingFields || showGstSlabField ? (
                      <TabularCell variant="editable">
                        <GstSlabSelect
                          unstyled
                          {...getCellDataAttributes(variant.id, "gstSlab")}
                          data-variant-grid-cell={`${variant.id}:gstSlab`}
                          className={cn("w-full", getDesktopInputClassName({ select: true }))}
                          value={variant.gstSlab ?? ""}
                          disabled={isReadOnly}
                          onFocus={() => handleCellFocus(variant.id, "gstSlab")}
                          onKeyDown={(event) => handleCellKeyDown(event, variant.id, "gstSlab")}
                          onChange={(event) =>
                            onVariantsChange(
                              updateVariant(variants, variant.id, (entry) => ({
                                ...entry,
                                gstSlab: event.target.value,
                              })),
                            )
                          }
                        />
                      </TabularCell>
                    ) : null}
                    {showActiveToggle ? (
                      <TabularCell variant="editable" align="center">
                        <label className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
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
                        </label>
                      </TabularCell>
                    ) : null}
                  </TabularRow>
                );
              })}
            </TabularBody>

            <TabularFooter>
              <p className="text-[10px] leading-none text-muted-foreground">
                {variants.length} variant{variants.length === 1 ? "" : "s"}
              </p>
              {showManualAddAction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("px-2", tabularFooterButtonClassName)}
                  onClick={onAddVariant}
                  disabled={disabled}
                >
                  {addVariantLabel}
                </Button>
              ) : <span />}
            </TabularFooter>
          </TabularSurface>
        </>
      ) : null}
    </div>
  );
}
