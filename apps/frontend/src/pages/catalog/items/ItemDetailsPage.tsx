import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

const isItemActive = (variants: DraftVariant[]) => variants.some((variant) => variant.isActive);

const sortUnique = (values: string[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort((a, b) => a.localeCompare(b));
const normalizeOptionKey = (value: string) => value.trim().toLowerCase();

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
  variants: item.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
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
  const [isEditing, setIsEditing] = useState(false);
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
        setIsEditing(false);
        return;
      }
      const draft = toDraft(detail);
      setItem(draft);
      setInitialItem(draft);
      setIsEditing(false);
      setOptionModalVariantId(null);
      setOptionKeyDraft("");
      setOptionValueDraft("");
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
    const normalizedKey = normalizeOptionKey(optionKeyDraft);
    if (!normalizedKey) return [];

    return Array.from(
      new Set(
        item.variants
          .flatMap((variant) => variant.optionRows)
          .filter((row) => normalizeOptionKey(row.key) === normalizedKey)
          .map((row) => row.value.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [item, optionKeyDraft]);

  const categorySuggestions = useMemo(
    () => sortUnique([...savedCategories, item?.category ?? ""]),
    [item?.category, savedCategories],
  );

  const itemActiveState = useMemo(
    () => (item ? isItemActive(item.variants) : true),
    [item],
  );

  const onSave = async () => {
    if (!item || !initialItem || !identityId || !activeStore || !isBusinessSelected) return;
    if (!isEditing) return;
    if (item.variants.length === 0) return;
    const nextItem = item;

    setSaveError(null);
    setLoading(true);
    try {
      const shouldUpdateItemRecord =
        nextItem.name !== initialItem.name ||
        nextItem.category !== initialItem.category ||
        nextItem.unit !== initialItem.unit ||
        nextItem.itemType !== initialItem.itemType;

      if (
        shouldUpdateItemRecord
      ) {
        await queueItemUpdate(activeStore, identityId, nextItem.id, {
          name: nextItem.name,
          category: nextItem.category.trim() || null,
          unit: nextItem.unit,
          itemType: nextItem.itemType,
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

        const mustValidate = isChangedOrNew;
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
        if (
          JSON.stringify(payload) !==
          JSON.stringify(normalizeVariantForUpdate(initialVariant))
        ) {
          await queueItemVariantUpdate(activeStore, identityId, variant.id, payload);
        }
      }

      await syncOnce(activeStore);
      const refreshedDetail = await getLocalItemDetailForDisplay(activeStore, nextItem.id);
      if (!refreshedDetail) {
        navigate("/app/items", { replace: true });
        return;
      }
      const refreshedDraft = toDraft(refreshedDetail);
      setItem(refreshedDraft);
      setInitialItem(refreshedDraft);
      setIsEditing(false);
      closeOptionModal();
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
    if (!isEditing) return;
    if (!item || !optionModalVariantId) return;
    const key = optionKeyDraft.trim();
    const value = optionValueDraft.trim();
    if (!key || !value) {
      setSaveError("Option key and value are required.");
      return;
    }
    const normalizedKey = normalizeOptionKey(key);
    const canonicalKey =
      optionKeySuggestions.find(
        (optionKey) => normalizeOptionKey(optionKey) === normalizedKey,
      ) ?? key;

    setItem({
      ...item,
      variants: item.variants.map((entry) =>
        entry.id === optionModalVariantId
          ? {
              ...entry,
              optionRows: [
                ...entry.optionRows,
                { id: crypto.randomUUID(), key: canonicalKey, value },
              ],
            }
          : entry,
      ),
    });
    closeOptionModal();
  };

  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app/items");
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/75 px-2 py-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {itemActiveState ? "Active" : "Inactive"}
                </span>
                <button
                  id="item-active-status"
                  type="button"
                  role="switch"
                  aria-checked={itemActiveState}
                  aria-label="Toggle item active state"
                  onClick={() => {
                    if (!isEditing || loading) return;
                    setItem((current) =>
                      current
                        ? {
                            ...current,
                            variants: current.variants.map((variant) => ({
                              ...variant,
                              isActive: !itemActiveState,
                            })),
                          }
                        : current,
                    );
                  }}
                  disabled={loading || !isEditing}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 disabled:cursor-not-allowed disabled:opacity-60 ${
                    itemActiveState
                      ? "bg-[#4a8dd9]"
                      : "bg-[#e7eff8]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      itemActiveState ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {isEditing ? (
                <PageActionBar
                  primaryLabel="Save Changes"
                  onPrimaryClick={() => void onSave()}
                  primaryDisabled={loading || !isDirty}
                  primaryLoading={loading}
                  primaryLoadingLabel="Saving..."
                  secondaryLabel="Cancel"
                  secondaryDisabled={loading}
                  onSecondaryClick={() => {
                    if (!initialItem) return;
                    setItem(initialItem);
                    setSaveError(null);
                    setIsEditing(false);
                    closeOptionModal();
                  }}
                />
              ) : (
                <PageActionBar
                  primaryLabel="Edit Details"
                  onPrimaryClick={() => {
                    setSaveError(null);
                    setIsEditing(true);
                  }}
                  primaryDisabled={loading}
                  secondaryLabel="Back"
                  onSecondaryClick={onBack}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-1.5 pb-20 sm:pb-24 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:pb-0">
          <div className="grid gap-1.5 rounded-lg border border-border/80 bg-white p-1.5 lg:shrink-0 lg:grid-cols-12 lg:items-end">
            <div className="grid gap-1 lg:col-span-4">
              <Label>Name</Label>
              <Input
                className={DENSE_INPUT_CLASS}
                value={item.name}
                disabled={!isEditing || loading}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1 lg:col-span-4">
              <Label>Category</Label>
              <LookupDropdownInput
                value={item.category}
                disabled={!isEditing || loading}
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
            <div className="grid gap-1 lg:col-span-2">
              <Label>Unit</Label>
              <Select
                className={`${DENSE_SELECT_CLASS} w-full`}
                value={item.unit}
                disabled={!isEditing || loading}
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
                disabled={!isEditing || loading}
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

          <div className="mt-1 grid gap-1.5">
            <ItemVariantCardsEditor
              variants={item.variants}
              onVariantsChange={(next) =>
                setItem({
                  ...item,
                  variants: next as DraftVariant[],
                })
              }
              onAddVariant={() => {
                if (!isEditing || loading) return;
                setItem({
                  ...item,
                  variants: [
                    ...item.variants,
                    {
                      id: `temp-${crypto.randomUUID()}`,
                      name: "",
                      sku: "",
                      barcode: "",
                      isActive: itemActiveState,
                      optionRows: [],
                      usageCount: 0,
                      isLocked: false,
                    },
                  ],
                });
              }}
              onOpenOptionModal={(variantId) => {
                if (!isEditing || loading) return;
                setSaveError(null);
                setOptionModalVariantId(variantId);
              }}
              addVariantLabel="Add Row"
              denseInputClassName={DENSE_INPUT_CLASS}
              showActiveToggle
              disabled={!isEditing || loading}
            />
          </div>

          {saveError ? (
            <p className="text-xs text-red-600">{saveError}</p>
          ) : null}
        </CardContent>
      </Card>

      <VariantOptionModal
        open={isEditing && Boolean(optionModalVariantId)}
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
