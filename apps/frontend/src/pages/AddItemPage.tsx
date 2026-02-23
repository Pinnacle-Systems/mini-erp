import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useSessionStore } from "../features/auth/session-store";
import { queueItemCreate, syncOnce, type VariantInput } from "../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";
const DENSE_SELECT_CLASS = "h-8 rounded-lg px-3 text-xs";
const DENSE_SWITCH_CLASS = "h-6 w-10 [&>span]:h-4 [&>span]:w-4";
const EMPTY_VARIANT = () => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  barcode: "",
  optionRows: [] as Array<{ id: string; key: string; value: string }>,
  isDefault: false,
});

export function AddItemPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const [itemType, setItemType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [hasVariants, setHasVariants] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
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
            const optionValues = Object.fromEntries(
              variant.optionRows
                .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
                .filter(([key, value]) => key.length > 0 && value.length > 0),
            );
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
    <main className="min-h-screen w-full p-4 sm:p-6 lg:p-8 xl:p-10">
      <Card className="mx-auto w-full max-w-6xl p-4">
        <CardHeader>
          <CardTitle className="text-xl">Add Item</CardTitle>
          <CardDescription className="text-xs">
            Create a new item for the active store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  className={DENSE_INPUT_CLASS}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Item type</Label>
                <div className="inline-flex items-center gap-3">
                  <span
                    className={
                      itemType === "PRODUCT"
                        ? "text-xs font-semibold text-foreground"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    Product
                  </span>
                  <Switch
                    className={DENSE_SWITCH_CLASS}
                    checked={itemType === "SERVICE"}
                    aria-label="Toggle item type"
                    onCheckedChange={(checked) =>
                      setItemType(checked ? "SERVICE" : "PRODUCT")
                    }
                  />
                  <span
                    className={
                      itemType === "SERVICE"
                        ? "text-xs font-semibold text-foreground"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    Service
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  id="unit"
                  className={`${DENSE_SELECT_CLASS} w-24`}
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
                  className="inline-flex items-center gap-2 text-xs text-foreground"
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

              {!hasVariants ? (
                <div className="grid gap-2">
                  <Label htmlFor="sku">Item SKU</Label>
                  <Input
                    id="sku"
                    className={DENSE_INPUT_CLASS}
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="Optional for services"
                  />
                </div>
              ) : null}

            </div>

            {hasVariants ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">Variants</p>
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
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="grid gap-1.5">
                        <Label>Name</Label>
                        <Input
                          className={DENSE_INPUT_CLASS}
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
                          className={DENSE_INPUT_CLASS}
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
                          className={DENSE_INPUT_CLASS}
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
                                    placeholder="Size"
                                    onChange={(event) =>
                                      setVariants((current) =>
                                        current.map((entry) =>
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
                                      )
                                    }
                                  />
                                  <Input
                                    className={DENSE_INPUT_CLASS}
                                    value={row.value}
                                    placeholder="M"
                                    onChange={(event) =>
                                      setVariants((current) =>
                                        current.map((entry) =>
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
                                      )
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setVariants((current) =>
                                        current.map((entry) =>
                                          entry.id === variant.id
                                            ? {
                                                ...entry,
                                                optionRows: entry.optionRows.filter(
                                                  (optionRow) => optionRow.id !== row.id,
                                                ),
                                              }
                                            : entry,
                                        ),
                                      )
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
                            onClick={() =>
                              setVariants((current) =>
                                current.map((entry) =>
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
                              )
                            }
                          >
                            Add Option Row
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
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
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : "Save Item"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
