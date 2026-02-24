import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import { Switch } from "../design-system/atoms/Switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalItemDetailForDisplay,
  queueItemUpdate,
  queueItemVariantCreate,
  queueItemVariantDelete,
  queueItemVariantUpdate,
  syncOnce,
  type ItemDetailDisplay,
  type VariantInput,
} from "../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";
const DENSE_SELECT_CLASS = "h-8 rounded-lg px-3 text-xs";
const DENSE_SWITCH_CLASS = "h-6 w-10 [&>span]:h-4 [&>span]:w-4";

type DraftVariant = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  isDefault: boolean;
  isActive: boolean;
  optionRows: Array<{ id: string; key: string; value: string }>;
  usageCount: number;
  isLocked: boolean;
};

type DraftItem = {
  id: string;
  name: string;
  unit: "PCS" | "KG" | "M" | "BOX";
  itemType: "PRODUCT" | "SERVICE";
  variants: DraftVariant[];
};

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

  const isDirty = useMemo(
    () =>
      Boolean(
        item &&
          initialItem &&
          JSON.stringify(item) !== JSON.stringify(initialItem),
      ),
    [initialItem, item],
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
        nextItem.unit !== initialItem.unit ||
        nextItem.itemType !== initialItem.itemType ||
        (nextIsImplicitMode && nextDefaultSkuValue !== initialDefaultSkuValue);

      if (
        shouldUpdateItemRecord
      ) {
        await queueItemUpdate(activeStore, identityId, nextItem.id, {
          name: nextItem.name,
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

  if (!item) {
    return (
      <main className="min-h-screen w-full p-4 sm:p-6 lg:p-8 xl:p-10">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Item not found.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full p-4 sm:p-6 lg:p-8 xl:p-10">
      <Card className="mx-auto w-full max-w-6xl p-4">
        <CardHeader>
          <CardTitle className="text-xl">Manage Item</CardTitle>
          <CardDescription className="text-xs">
            Edit item details and variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                className={DENSE_INPUT_CLASS}
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Item type</Label>
              <div className="inline-flex items-center gap-3">
                <span
                  className={
                    item.itemType === "PRODUCT"
                      ? "text-xs font-semibold text-foreground"
                      : "text-xs font-medium text-muted-foreground"
                  }
                >
                  Product
                </span>
                <Switch
                  className={DENSE_SWITCH_CLASS}
                  checked={item.itemType === "SERVICE"}
                  aria-label="Toggle item type"
                  onCheckedChange={(checked) =>
                    setItem({
                      ...item,
                      itemType: checked ? "SERVICE" : "PRODUCT",
                    })
                  }
                />
                <span
                  className={
                    item.itemType === "SERVICE"
                      ? "text-xs font-semibold text-foreground"
                      : "text-xs font-medium text-muted-foreground"
                  }
                >
                  Service
                </span>
              </div>
            </div>
            {shouldHideDefaultVariant ? (
              <div className="grid gap-2">
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
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Select
                className={`${DENSE_SELECT_CLASS} w-24`}
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
          </div>

          <div className="mt-2 grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Variants</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                Add Item Variant
              </Button>
            </div>
            {shouldHideDefaultVariant ? (
              <p className="text-sm text-muted-foreground">
                No variants added yet. Item SKU is mapped to the default variant.
              </p>
            ) : null}
            {visibleVariants.map((variant) => (
              <div key={variant.id} className="rounded-xl border border-white/80 bg-white/65 p-3">
                {variant.isLocked ? (
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Used in {variant.usageCount} record
                    {variant.usageCount === 1 ? "" : "s"}: SKU, name, barcode, options, and
                    delete are locked.
                  </p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label>Variant name</Label>
                    <Input
                      className={DENSE_INPUT_CLASS}
                      value={variant.name}
                      disabled={variant.isLocked}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((entry) =>
                            entry.id === variant.id
                              ? { ...entry, name: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>SKU</Label>
                    <Input
                      className={DENSE_INPUT_CLASS}
                      value={variant.sku}
                      disabled={variant.isLocked}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((entry) =>
                            entry.id === variant.id
                              ? { ...entry, sku: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Barcode</Label>
                    <Input
                      className={DENSE_INPUT_CLASS}
                      value={variant.barcode}
                      disabled={variant.isLocked}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((entry) =>
                            entry.id === variant.id
                              ? { ...entry, barcode: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5 xl:col-span-2">
                    <Label>Options</Label>
                    <div className="overflow-hidden rounded-lg border border-white/75 bg-white/75">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-white/75 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        <span>Key</span>
                        <span>Value</span>
                        <span className="sr-only">Actions</span>
                      </div>
                      <div className="grid gap-2 p-2">
                        {variant.optionRows.length === 0 ? (
                          <p className="px-1 py-2 text-xs text-muted-foreground">
                            No option rows added.
                          </p>
                        ) : (
                          variant.optionRows.map((row) => (
                            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                              <Input
                                className={DENSE_INPUT_CLASS}
                                value={row.key}
                                disabled={variant.isLocked}
                                placeholder="Size"
                                onChange={(event) =>
                                  setItem({
                                    ...item,
                                    variants: item.variants.map((entry) =>
                                      entry.id === variant.id
                                        ? {
                                            ...entry,
                                            optionRows: entry.optionRows.map((optionRow) =>
                                              optionRow.id === row.id
                                                ? { ...optionRow, key: event.target.value }
                                                : optionRow,
                                            ),
                                          }
                                        : entry,
                                    ),
                                  })
                                }
                              />
                              <Input
                                className={DENSE_INPUT_CLASS}
                                value={row.value}
                                disabled={variant.isLocked}
                                placeholder="M"
                                onChange={(event) =>
                                  setItem({
                                    ...item,
                                    variants: item.variants.map((entry) =>
                                      entry.id === variant.id
                                        ? {
                                            ...entry,
                                            optionRows: entry.optionRows.map((optionRow) =>
                                              optionRow.id === row.id
                                                ? { ...optionRow, value: event.target.value }
                                                : optionRow,
                                            ),
                                          }
                                        : entry,
                                    ),
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={variant.isLocked}
                                onClick={() =>
                                  setItem({
                                    ...item,
                                    variants: item.variants.map((entry) =>
                                      entry.id === variant.id
                                        ? {
                                            ...entry,
                                            optionRows: entry.optionRows.filter(
                                              (optionRow) => optionRow.id !== row.id,
                                            ),
                                          }
                                        : entry,
                                    ),
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={variant.isLocked}
                        onClick={() =>
                          setItem({
                            ...item,
                            variants: item.variants.map((entry) =>
                              entry.id === variant.id
                                ? {
                                    ...entry,
                                    optionRows: [
                                      ...entry.optionRows,
                                      {
                                        id: crypto.randomUUID(),
                                        key: "",
                                        value: "",
                                      },
                                    ],
                                  }
                                : entry,
                            ),
                          })
                        }
                      >
                        Add Option Row
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="defaultVariant"
                        checked={variant.isDefault}
                        onChange={() =>
                          setItem({
                            ...item,
                            variants: item.variants.map((entry) => ({
                              ...entry,
                              isDefault: entry.id === variant.id,
                            })),
                          })
                        }
                      />
                      Default
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(event) =>
                          setItem({
                            ...item,
                            variants: item.variants.map((entry) =>
                              entry.id === variant.id
                                ? { ...entry, isActive: event.target.checked }
                                : entry,
                            ),
                          })
                        }
                      />
                      Active
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={item.variants.length <= 1 || variant.isLocked}
                    onClick={() =>
                      setItem({
                        ...item,
                        variants: ensureSingleDefault(
                          item.variants.filter((entry) => entry.id !== variant.id),
                        ),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {saveError ? (
            <p className="text-xs text-red-600">{saveError}</p>
          ) : null}

          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void onSave()}
              disabled={loading || !isDirty}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => navigate("/app/items")}
            >
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
