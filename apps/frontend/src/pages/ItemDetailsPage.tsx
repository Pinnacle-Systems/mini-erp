import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-store";
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
const ITEM_TYPE_OPTIONS = ["PRODUCT", "SERVICE"] as const;

type DraftVariant = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  isDefault: boolean;
  isActive: boolean;
  optionText: string;
};

type DraftItem = {
  id: string;
  name: string;
  description: string;
  unit: "PCS" | "KG" | "M" | "BOX";
  itemType: "PRODUCT" | "SERVICE";
  variants: DraftVariant[];
};

const toOptionText = (optionValues: Record<string, string>) =>
  Object.entries(optionValues)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

const parseOptionText = (value: string) => {
  const optionValues: Record<string, string> = {};
  for (const segment of value.split(",")) {
    const [rawKey, rawValue] = segment.split("=");
    const key = rawKey?.trim();
    const parsedValue = rawValue?.trim();
    if (!key || !parsedValue) continue;
    optionValues[key] = parsedValue;
  }
  return optionValues;
};

const normalizeVariant = (variant: DraftVariant): VariantInput => {
  const optionValues = parseOptionText(variant.optionText);
  return {
    name: variant.name.trim() || undefined,
    sku: variant.sku.trim() || undefined,
    barcode: variant.barcode.trim() || undefined,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined,
  };
};

const toDraft = (item: ItemDetailDisplay): DraftItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  unit: item.unit,
  itemType: item.itemType,
  variants: item.variants.map((variant, index) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    barcode: variant.barcode,
    isDefault: variant.isDefault || index === 0,
    isActive: variant.isActive,
    optionText: toOptionText(variant.optionValues),
  })),
});

export function ItemDetailsPage() {
  const navigate = useNavigate();
  const { itemId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<DraftItem | null>(null);
  const [initialItem, setInitialItem] = useState<DraftItem | null>(null);

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

  const onSave = async () => {
    if (!item || !initialItem || !identityId || !activeStore || !isStoreSelected) return;
    if (item.variants.length === 0) return;

    const nextItem = {
      ...item,
      variants: ensureSingleDefault(item.variants),
    };
    setItem(nextItem);

    setLoading(true);
    try {
      if (
        nextItem.name !== initialItem.name ||
        nextItem.description !== initialItem.description ||
        nextItem.unit !== initialItem.unit ||
        nextItem.itemType !== initialItem.itemType
      ) {
        await queueItemUpdate(activeStore, identityId, nextItem.id, {
          name: nextItem.name,
          description: nextItem.description,
          unit: nextItem.unit,
          itemType: nextItem.itemType,
        });
      }

      const initialVariantsById = new Map(
        initialItem.variants.map((variant) => [variant.id, variant]),
      );
      const currentVariantIds = new Set(
        nextItem.variants
          .filter((variant) => !variant.id.startsWith("temp-"))
          .map((variant) => variant.id),
      );

      for (const initialVariant of initialItem.variants) {
        if (!currentVariantIds.has(initialVariant.id)) {
          await queueItemVariantDelete(activeStore, identityId, initialVariant.id);
        }
      }

      for (const variant of nextItem.variants) {
        const payload = normalizeVariant(variant);

        if (variant.id.startsWith("temp-")) {
          await queueItemVariantCreate(activeStore, identityId, nextItem.id, payload);
          continue;
        }

        const initialVariant = initialVariantsById.get(variant.id);
        if (!initialVariant) continue;

        if (
          JSON.stringify(payload) !==
          JSON.stringify(normalizeVariant(initialVariant))
        ) {
          await queueItemVariantUpdate(activeStore, identityId, variant.id, payload);
        }
      }

      await syncOnce(activeStore);
      const refreshed = await getLocalItemDetailForDisplay(activeStore, itemId);
      if (!refreshed) {
        navigate("/app/items", { replace: true });
        return;
      }
      const draft = toDraft(refreshed);
      setItem(draft);
      setInitialItem(draft);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!item) {
    return (
      <main className="min-h-screen w-full p-4 sm:p-6 md:p-10">
        <Card className="mx-auto w-full max-w-2xl">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Item not found.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full p-4 sm:p-6 md:p-10">
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Manage Item</CardTitle>
          <CardDescription>Edit item details and variants.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Item type</Label>
              <Select
                value={item.itemType}
                onChange={(event) =>
                  setItem({
                    ...item,
                    itemType: event.target.value as "PRODUCT" | "SERVICE",
                  })
                }
              >
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={item.description}
                onChange={(event) =>
                  setItem({ ...item, description: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Select
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
              <p className="text-sm font-medium text-foreground">Variants</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
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
                        optionText: "",
                      },
                    ],
                  })
                }
              >
                Add Variant
              </Button>
            </div>
            {item.variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-xl border border-white/80 bg-white/65 p-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Variant name</Label>
                    <Input
                      value={variant.name}
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
                      value={variant.sku}
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
                      value={variant.barcode}
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
                  <div className="grid gap-1.5">
                    <Label>Options</Label>
                    <Input
                      value={variant.optionText}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((entry) =>
                            entry.id === variant.id
                              ? { ...entry, optionText: event.target.value }
                              : entry,
                          ),
                        })
                      }
                      placeholder="Size=M, Color=Red"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
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
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
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
                    disabled={item.variants.length <= 1}
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

          <div className="mt-2 flex gap-2">
            <Button type="button" onClick={() => void onSave()} disabled={loading || !isDirty}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
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
