import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { queueItemCreate, syncOnce, type VariantInput } from "../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const ITEM_TYPE_OPTIONS = ["PRODUCT", "SERVICE"] as const;
const EMPTY_VARIANT = () => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  barcode: "",
  optionName: "",
  optionValue: "",
  isDefault: false,
});

export function AddItemPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const [itemType, setItemType] =
    useState<(typeof ITEM_TYPE_OPTIONS)[number]>("PRODUCT");
  const [hasVariants, setHasVariants] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<(typeof UNIT_OPTIONS)[number]>("PCS");
  const [variants, setVariants] = useState([EMPTY_VARIANT()]);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityId || !activeStore || !isStoreSelected || !name.trim()) return;
    if (hasVariants && variants.length === 0) return;

    setLoading(true);
    try {
      const variantPayload: VariantInput[] | undefined = hasVariants
        ? variants.map((variant, index) => {
            const optionValues: Record<string, string> = {};
            if (variant.optionName.trim() && variant.optionValue.trim()) {
              optionValues[variant.optionName.trim()] = variant.optionValue.trim();
            }
            return {
              name: variant.name.trim() || undefined,
              sku: variant.sku.trim() || undefined,
              barcode: variant.barcode.trim() || undefined,
              isDefault: variant.isDefault || index === 0,
              optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined,
            };
          })
        : undefined;

      await queueItemCreate(activeStore, identityId, {
        itemType,
        sku: hasVariants ? undefined : sku.trim(),
        name: name.trim(),
        description: description.trim(),
        unit,
        variants: variantPayload,
      });
      await syncOnce(activeStore).catch(() => null);
      navigate("/app/items");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full p-4 sm:p-6 md:p-10">
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
          <CardDescription>Create a new item for the active store.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="itemType">Item type</Label>
              <Select
                id="itemType"
                value={itemType}
                onChange={(event) =>
                  setItemType(event.target.value as (typeof ITEM_TYPE_OPTIONS)[number])
                }
              >
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder={hasVariants ? "Use variant SKUs below" : "Optional for services"}
                disabled={hasVariants}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                id="unit"
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as (typeof UNIT_OPTIONS)[number])
                }
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hasVariants">Variant product</Label>
              <label
                htmlFor="hasVariants"
                className="inline-flex items-center gap-2 text-sm text-foreground"
              >
                <input
                  id="hasVariants"
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(event) => setHasVariants(event.target.checked)}
                />
                Enable variants for this item
              </label>
            </div>

            {hasVariants ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Variants</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVariants((current) => [...current, EMPTY_VARIANT()]);
                    }}
                  >
                    Add Variant
                  </Button>
                </div>
                {variants.map((variant, index) => (
                  <div
                    key={variant.id}
                    className="rounded-xl border border-white/80 bg-white/65 p-3"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Name</Label>
                        <Input
                          value={variant.name}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((entry) =>
                                entry.id === variant.id
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Variant name (optional)"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>SKU</Label>
                        <Input
                          value={variant.sku}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((entry) =>
                                entry.id === variant.id
                                  ? { ...entry, sku: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Variant SKU"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Barcode</Label>
                        <Input
                          value={variant.barcode}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((entry) =>
                                entry.id === variant.id
                                  ? { ...entry, barcode: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Optional barcode"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Option</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={variant.optionName}
                            onChange={(event) =>
                              setVariants((current) =>
                                current.map((entry) =>
                                  entry.id === variant.id
                                    ? { ...entry, optionName: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Option name (e.g. Size)"
                          />
                          <Input
                            value={variant.optionValue}
                            onChange={(event) =>
                              setVariants((current) =>
                                current.map((entry) =>
                                  entry.id === variant.id
                                    ? { ...entry, optionValue: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Option value (e.g. M)"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="radio"
                          name="defaultVariant"
                          checked={variant.isDefault || index === 0}
                          onChange={() =>
                            setVariants((current) =>
                              current.map((entry) => ({
                                ...entry,
                                isDefault: entry.id === variant.id,
                              })),
                            )
                          }
                        />
                        Default variant
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={variants.length <= 1}
                        onClick={() =>
                          setVariants((current) =>
                            current.filter((entry) => entry.id !== variant.id),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Item"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/items")}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
