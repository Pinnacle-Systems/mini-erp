import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import { Select } from "../../../design-system/atoms/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../design-system/molecules/Card";
import { LookupDropdownInput } from "../../../design-system/molecules/LookupDropdownInput";
import { PageActionBar } from "../../../design-system/molecules/PageActionBar";
import {
  ItemVariantCardsEditor,
  type ItemVariantDraft,
} from "../../../design-system/organisms/ItemVariantCardsEditor";
import { VariantOptionModal } from "../../../design-system/organisms/VariantOptionModal";
import { useSessionStore } from "../../../features/auth/session-business";
import {
  getLocalItemDetailForDisplay,
  getLocalItemCategoriesForStore,
  getRemoteItemCategoriesForStore,
  queueItemUpdate,
  queueItemVariantCreate,
  queueItemVariantDelete,
  queueItemVariantUpdate,
  syncOnce,
  type ItemDetailDisplay,
  type VariantInput,
} from "../../../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const DENSE_INPUT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const DENSE_SELECT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";

type DraftVariant = ItemVariantDraft & {
  isActive: boolean;
  usageCount: number;
  isLocked: boolean;
};

type DraftItem = {
  id: string;
  name: string;
  category: string;
  unit: "PCS" | "KG" | "M" | "BOX";
  itemType: "PRODUCT" | "SERVICE";
  variants: DraftVariant[];
};

const sortUnique = (values: string[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort((a, b) => a.localeCompare(b));

const toOptionRows = (optionValues: Record<string, string>) =>
  Object.entries(optionValues).map(([key, value], index) => ({
    id: `${key}-${index}`,
    key,
    value,
  }));

const normalizeVariantForCreate = (variant: DraftVariant): VariantInput => {
  const optionValues = Object.fromEntries(
    variant.optionRows
      .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  );
  return {
    name: variant.name.trim() || undefined,
    sku: variant.sku.trim() || undefined,
    barcode: variant.barcode.trim() || undefined,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined,
  };
};

const normalizeVariantForUpdate = (variant: DraftVariant): VariantInput => {
  const optionValues = Object.fromEntries(
    variant.optionRows
      .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  );
  return {
    name: variant.name.trim() || null,
    sku: variant.sku.trim() || null,
    barcode: variant.barcode.trim() || null,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    optionValues,
  };
};

const hasAtLeastOneVariantDetail = (variant: DraftVariant) => {
  const hasBasicField =
    variant.name.trim().length > 0 ||
    variant.sku.trim().length > 0 ||
    variant.barcode.trim().length > 0;
  const hasOptionPair = variant.optionRows.some(
    (entry) => entry.key.trim().length > 0 && entry.value.trim().length > 0,
  );
  return hasBasicField || hasOptionPair;
};

const hasIncompleteOptionRows = (variant: DraftVariant) => {
  return variant.optionRows.some((entry) => {
    const key = entry.key.trim();
    const value = entry.value.trim();
    return (key.length > 0 && value.length === 0) || (key.length === 0 && value.length > 0);
  });
};

const toDraft = (item: ItemDetailDisplay): DraftItem => ({
  id: item.id,
  name: item.name,
  category: item.category,
  unit: item.unit,
  itemType: item.itemType,
  variants: item.variants.map((variant, index) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    isDefault: variant.isDefault || index === 0,
    isActive: variant.isActive,
    optionRows: toOptionRows(variant.optionValues),
    usageCount: variant.usageCount,
    isLocked: variant.isLocked,
  })),
});

export function ItemDetailsPage() {
  const navigate = useNavigate();
  const { itemId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [item, setItem] = useState<DraftItem | null>(null);
  const [initialItem, setInitialItem] = useState<DraftItem | null>(null);
  const [hasEnteredVariantMode, setHasEnteredVariantMode] = useState(false);
  const [optionModalVariantId, setOptionModalVariantId] = useState<string | null>(null);
  const [optionKeyDraft, setOptionKeyDraft] = useState("");
  const [optionValueDraft, setOptionValueDraft] = useState("");
  const [savedCategories, setSavedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!activeStore || !itemId) return;
    void getLocalItemDetailForDisplay(activeStore, itemId).then((detail) => {
      if (!detail) {
        setItem(null);
        setInitialItem(null);
        return;
      }
      const draft = toDraft(detail);
      setItem(draft);
      setInitialItem(draft);
      setHasEnteredVariantMode(false);
      setSaveError(null);
    });
  }, [activeStore, itemId]);

  useEffect(() => {
    let cancelled = false;
    const loadCategorySuggestions = async () => {
      if (!activeStore) {
        setSavedCategories([]);
        return;
      }
      const [localCategories, remoteCategories] = await Promise.all([
        getLocalItemCategoriesForStore(activeStore).catch(() => []),
        getRemoteItemCategoriesForStore(activeStore).catch(() => []),
      ]);
      if (cancelled) return;
      setSavedCategories(sortUnique([...localCategories, ...remoteCategories]));
    };
    void loadCategorySuggestions();
    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  const isDirty = useMemo(
    () =>
      Boolean(
        item &&
          initialItem &&
          JSON.stringify(item) !== JSON.stringify(initialItem),
      ),
    [initialItem, item],
  );

  const optionKeySuggestions = useMemo(() => {
    if (!item) return [];
    return Array.from(
      new Set(
        item.variants
          .flatMap((variant) => variant.optionRows)
          .map((row) => row.key.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [item]);

  const optionValueSuggestions = useMemo(() => {
    if (!item) return [];
    const key = optionKeyDraft.trim();
    if (!key) return [];

    return Array.from(
      new Set(
        item.variants
          .flatMap((variant) => variant.optionRows)
          .filter((row) => row.key.trim() === key)
          .map((row) => row.value.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [item, optionKeyDraft]);

  const categorySuggestions = useMemo(
    () => sortUnique([...savedCategories, item?.category ?? ""]),
    [item?.category, savedCategories],
  );

  const ensureSingleDefault = (variants: DraftVariant[]) => {
    if (variants.length === 0) return variants;
    if (variants.some((variant) => variant.isDefault)) return variants;
    return variants.map((variant, index) =>
      index === 0 ? { ...variant, isDefault: true } : variant,
    );
  };

  const isImplicitDefaultVariant = (variants: DraftVariant[]) => {
    if (variants.length !== 1) return false;
    const [variant] = variants;
    const hasOptions = variant.optionRows.some(
      (entry) => entry.key.trim().length > 0 && entry.value.trim().length > 0,
    );
    return (
      variant.isDefault &&
      variant.name.trim().length === 0 &&
      variant.barcode.trim().length === 0 &&
      !hasOptions
    );
  };

  const shouldHideDefaultVariant =
    item && isImplicitDefaultVariant(item.variants) && !hasEnteredVariantMode;
  const visibleVariants = shouldHideDefaultVariant ? [] : item?.variants ?? [];
  const defaultVariantId = item?.variants.find((variant) => variant.isDefault)?.id;
  const defaultVariantSku =
    item?.variants.find((variant) => variant.id === defaultVariantId)?.sku ?? "";

  const onSave = async () => {
    if (!item || !initialItem || !identityId || !activeStore || !isBusinessSelected) return;
    if (item.variants.length === 0) return;

    const nextItem = {
      ...item,
      variants: ensureSingleDefault(item.variants),
    };
    setItem(nextItem);
    const nextIsImplicitMode = isImplicitDefaultVariant(nextItem.variants);
    const nextDefaultSkuValue =
      nextItem.variants.find((variant) => variant.isDefault)?.sku.trim() ?? "";
    const initialDefaultSkuValue =
      initialItem.variants.find((variant) => variant.isDefault)?.sku.trim() ?? "";

    setSaveError(null);
    setLoading(true);
    try {
      const shouldUpdateItemRecord =
        nextItem.name !== initialItem.name ||
        nextItem.category !== initialItem.category ||
        nextItem.unit !== initialItem.unit ||
        nextItem.itemType !== initialItem.itemType ||
        (nextIsImplicitMode && nextDefaultSkuValue !== initialDefaultSkuValue);

      if (
        shouldUpdateItemRecord
      ) {
        await queueItemUpdate(activeStore, identityId, nextItem.id, {
          name: nextItem.name,
          category: nextItem.category.trim() || null,
          unit: nextItem.unit,
          itemType: nextItem.itemType,
          sku: nextIsImplicitMode ? nextDefaultSkuValue : undefined,
        });
      }

      const initialVariantsById = new Map(
        initialItem.variants.map((variant) => [variant.id, variant]),
      );
      for (let index = 0; index < nextItem.variants.length; index += 1) {
        const variant = nextItem.variants[index];
        const initialVariant = initialVariantsById.get(variant.id);
        const isChangedOrNew =
          variant.id.startsWith("temp-") ||
          (initialVariant &&
            JSON.stringify(normalizeVariantForUpdate(variant)) !==
              JSON.stringify(normalizeVariantForUpdate(initialVariant)));

        const mustValidate = isChangedOrNew && !variant.isDefault;
        if (!mustValidate) continue;

        if (!hasAtLeastOneVariantDetail(variant)) {
          setSaveError(
            `Variant ${index + 1} is empty. Enter at least one of name, SKU, barcode, or option key/value.`,
          );
          return;
        }

        if (hasIncompleteOptionRows(variant)) {
          setSaveError(
            `Variant ${index + 1} has incomplete option rows. Fill both key and value or remove the row.`,
          );
          return;
        }
      }

      const currentVariantIds = new Set(
        nextItem.variants
          .filter((variant) => !variant.id.startsWith("temp-"))
          .map((variant) => variant.id),
      );

      for (const initialVariant of initialItem.variants) {
        if (initialVariant.id.startsWith("temp-")) continue;
        if (!currentVariantIds.has(initialVariant.id)) {
          await queueItemVariantDelete(activeStore, identityId, initialVariant.id);
        }
      }

      for (const variant of nextItem.variants) {
        if (variant.id.startsWith("temp-")) {
          const payload = normalizeVariantForCreate(variant);
          await queueItemVariantCreate(activeStore, identityId, nextItem.id, payload);
          continue;
        }

        const initialVariant = initialVariantsById.get(variant.id);
        if (!initialVariant) continue;

        const payload = normalizeVariantForUpdate(variant);

        if (nextIsImplicitMode && variant.isDefault) {
          const initialPayload = normalizeVariantForUpdate(initialVariant);
          const nextPayloadWithoutSku = { ...payload, sku: undefined };
          const initialPayloadWithoutSku = { ...initialPayload, sku: undefined };
          if (
            JSON.stringify(nextPayloadWithoutSku) !==
            JSON.stringify(initialPayloadWithoutSku)
          ) {
            await queueItemVariantUpdate(
              activeStore,
              identityId,
              variant.id,
              nextPayloadWithoutSku,
            );
          }
          continue;
        }

        if (
          JSON.stringify(payload) !==
          JSON.stringify(normalizeVariantForUpdate(initialVariant))
        ) {
          await queueItemVariantUpdate(activeStore, identityId, variant.id, payload);
        }
      }

      await syncOnce(activeStore);
      navigate("/app/items", { replace: true });
    } catch (error) {
      console.error(error);
      setSaveError("Unable to save changes. Some variant fields may be locked after usage.");
    } finally {
      setLoading(false);
    }
  };

  const closeOptionModal = () => {
    setOptionModalVariantId(null);
    setOptionKeyDraft("");
    setOptionValueDraft("");
  };

  const saveOptionChip = () => {
    if (!item || !optionModalVariantId) return;
    const key = optionKeyDraft.trim();
    const value = optionValueDraft.trim();
    if (!key || !value) {
      setSaveError("Option key and value are required.");
      return;
    }

    setItem({
      ...item,
      variants: item.variants.map((entry) =>
        entry.id === optionModalVariantId
          ? {
              ...entry,
              optionRows: [...entry.optionRows, { id: crypto.randomUUID(), key, value }],
            }
          : entry,
      ),
    });
    closeOptionModal();
  };

  if (!item) {
    return (
      <main className="h-auto w-full p-2 pb-20 sm:p-3 sm:pb-24 lg:h-full lg:min-h-0 lg:pb-3">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Item not found.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="h-auto w-full p-2 pb-20 sm:p-3 sm:pb-24 lg:h-full lg:min-h-0 lg:pb-3">
      <Card className="mx-auto w-full max-w-6xl p-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="pb-1.5 lg:shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-base">Manage Item</CardTitle>
              <CardDescription className="text-xs">
                Edit item details and variants.
              </CardDescription>
            </div>
            <PageActionBar
              primaryLabel="Save Changes"
              onPrimaryClick={() => void onSave()}
              primaryDisabled={loading || !isDirty}
              primaryLoading={loading}
              primaryLoadingLabel="Saving..."
              secondaryLabel="Cancel"
              secondaryDisabled={loading}
              onSecondaryClick={() => navigate("/app/items")}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-1.5 pb-20 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:pb-0">
          <div className="grid gap-1.5 rounded-xl border border-white/70 bg-white/65 p-1.5 lg:shrink-0 lg:grid-cols-12 lg:items-end">
            <div className="grid gap-1 lg:col-span-4">
              <Label>Name</Label>
              <Input
                className={DENSE_INPUT_CLASS}
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1 lg:col-span-3">
              <Label>Category</Label>
              <LookupDropdownInput
                value={item.category}
                onValueChange={(value) => setItem({ ...item, category: value })}
                placeholder="Category"
                options={categorySuggestions}
                getOptionKey={(categoryValue) => categoryValue}
                getOptionSearchText={(categoryValue) => categoryValue}
                onOptionSelect={(categoryValue) => setItem({ ...item, category: categoryValue })}
                renderOption={(categoryValue) => (
                  <div className="truncate font-medium">{categoryValue}</div>
                )}
                maxVisibleOptions={10}
                inputClassName={DENSE_INPUT_CLASS}
                optionClassName="text-[10px]"
              />
            </div>
            {shouldHideDefaultVariant ? (
              <div className="grid gap-1 lg:col-span-2">
                <Label>Item SKU</Label>
                <Input
                  className={DENSE_INPUT_CLASS}
                  value={defaultVariantSku}
                  onChange={(event) =>
                    setItem({
                      ...item,
                      variants: item.variants.map((variant) =>
                        variant.id === defaultVariantId
                          ? { ...variant, sku: event.target.value }
                          : variant,
                      ),
                    })
                  }
                  placeholder="Item SKU"
                />
              </div>
            ) : null}
            <div className="grid gap-1 lg:col-span-1">
              <Label>Unit</Label>
              <Select
                className={`${DENSE_SELECT_CLASS} w-full`}
                value={item.unit}
                onChange={(event) =>
                  setItem({
                    ...item,
                    unit: event.target.value as "PCS" | "KG" | "M" | "BOX",
                  })
                }
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1 lg:col-span-2">
              <Label>Type</Label>
              <Select
                className={`${DENSE_SELECT_CLASS} w-full`}
                value={item.itemType}
                onChange={(event) =>
                  setItem({
                    ...item,
                    itemType: event.target.value as "PRODUCT" | "SERVICE",
                  })
                }
              >
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
              </Select>
            </div>
          </div>

          <div className="mt-1 grid gap-1.5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
            {shouldHideDefaultVariant ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/60 p-2">
                <p className="text-[11px] text-muted-foreground lg:text-[10px]">
                  No variants added yet. Item SKU is mapped to the default variant.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    setHasEnteredVariantMode(true);
                    setItem({
                      ...item,
                      variants: [
                        ...item.variants,
                        {
                          id: `temp-${crypto.randomUUID()}`,
                          name: "",
                          sku: "",
                          barcode: "",
                          isDefault: false,
                          isActive: true,
                          optionRows: [],
                          usageCount: 0,
                          isLocked: false,
                        },
                      ],
                    });
                  }}
                >
                  Add Variant
                </Button>
              </div>
            ) : null}

            {!shouldHideDefaultVariant ? (
              <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
                <ItemVariantCardsEditor
                  variants={visibleVariants}
                  onVariantsChange={(next) =>
                    setItem({
                      ...item,
                      variants: next as DraftVariant[],
                    })
                  }
                  onAddVariant={() => {
                    setHasEnteredVariantMode(true);
                    setItem({
                      ...item,
                      variants: [
                        ...item.variants,
                        {
                          id: `temp-${crypto.randomUUID()}`,
                          name: "",
                          sku: "",
                          barcode: "",
                          isDefault: false,
                          isActive: true,
                          optionRows: [],
                          usageCount: 0,
                          isLocked: false,
                        },
                      ],
                    });
                  }}
                  onOpenOptionModal={(variantId) => {
                    setSaveError(null);
                    setOptionModalVariantId(variantId);
                  }}
                  addVariantLabel="Add Variant"
                  removeVariantLabel="Remove"
                  denseInputClassName={DENSE_INPUT_CLASS}
                  showActiveToggle
                />
              </div>
            ) : null}
          </div>

          {saveError ? (
            <p className="text-xs text-red-600">{saveError}</p>
          ) : null}
        </CardContent>
      </Card>

      <VariantOptionModal
        open={Boolean(optionModalVariantId)}
        idPrefix="manage-item"
        keyDraft={optionKeyDraft}
        valueDraft={optionValueDraft}
        keySuggestions={optionKeySuggestions}
        valueSuggestions={optionValueSuggestions}
        inputClassName={DENSE_INPUT_CLASS}
        onKeyDraftChange={setOptionKeyDraft}
        onValueDraftChange={setOptionValueDraft}
        onClose={closeOptionModal}
        onConfirm={saveOptionChip}
      />
    </main>
  );
}
