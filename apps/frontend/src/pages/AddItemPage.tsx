import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useSessionStore } from "../features/auth/session-business";
import { queueItemCreate, syncOnce, type VariantInput } from "../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const DENSE_INPUT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const DENSE_SELECT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const OPTION_KEYS_STORAGE_KEY = "mini-erp-option-key-suggestions";

type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  optionRows: Array<{ id: string; key: string; value: string }>;
  isDefault: boolean;
};

type QuickItemDraft = {
  id: string;
  name: string;
  sku: string;
  unit: (typeof UNIT_OPTIONS)[number];
  itemType: "PRODUCT" | "SERVICE";
};

const EMPTY_VARIANT = (): VariantDraft => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  barcode: "",
  optionRows: [],
  isDefault: false,
});

const EMPTY_QUICK_ROW = (): QuickItemDraft => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  unit: "PCS",
  itemType: "PRODUCT",
});

const buildInitialRows = (count = 5) =>
  Array.from({ length: count }, () => EMPTY_QUICK_ROW());

export function AddItemPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  const [itemType, setItemType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [hasVariants, setHasVariants] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNIT_OPTIONS)[number]>("PCS");
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT()]);
  const [quickRows, setQuickRows] = useState<QuickItemDraft[]>(buildInitialRows());
  const [optionModalVariantId, setOptionModalVariantId] = useState<string | null>(null);
  const [optionKeyDraft, setOptionKeyDraft] = useState("");
  const [optionValueDraft, setOptionValueDraft] = useState("");
  const [savedOptionKeys, setSavedOptionKeys] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(OPTION_KEYS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return [];
    }
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const optionKeySuggestions = useMemo(() => {
    const fromVariants = variants
      .flatMap((variant) => variant.optionRows)
      .map((row) => row.key.trim())
      .filter(Boolean);
    return Array.from(new Set([...savedOptionKeys, ...fromVariants])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [savedOptionKeys, variants]);

  const closeOptionModal = () => {
    setOptionModalVariantId(null);
    setOptionKeyDraft("");
    setOptionValueDraft("");
  };

  const saveOptionChip = () => {
    if (!optionModalVariantId) return;
    const key = optionKeyDraft.trim();
    const value = optionValueDraft.trim();
    if (!key || !value) {
      setFormError("Option key and value are required.");
      return;
    }

    setVariants((current) =>
      current.map((entry) =>
        entry.id === optionModalVariantId
          ? {
              ...entry,
              optionRows: [...entry.optionRows, { id: crypto.randomUUID(), key, value }],
            }
          : entry,
      ),
    );
    setSavedOptionKeys((current) => {
      const next = Array.from(new Set([...current, key])).sort((a, b) =>
        a.localeCompare(b),
      );
      try {
        window.localStorage.setItem(OPTION_KEYS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures; autocomplete still works in-memory for this session.
      }
      return next;
    });
    closeOptionModal();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityId || !activeStore || !isBusinessSelected) return;

    setFormError(null);
    setLoading(true);
    try {
      if (!hasVariants) {
        const rowsToCreate = quickRows
          .map((row) => ({
            ...row,
            name: row.name.trim(),
            sku: row.sku.trim(),
          }))
          .filter((row) => row.name.length > 0);

        if (rowsToCreate.length === 0) {
          setFormError("Add at least one item name to save.");
          return;
        }

        for (const row of rowsToCreate) {
          await queueItemCreate(activeStore, identityId, {
            itemType: row.itemType,
            sku: row.sku || undefined,
            name: row.name,
            unit: row.unit,
          });
        }

        await syncOnce(activeStore).catch(() => null);
        navigate("/app/items");
        return;
      }

      if (!name.trim()) {
        setFormError("Item name is required.");
        return;
      }
      if (variants.length === 0) {
        setFormError("Add at least one variant.");
        return;
      }

      const variantPayload: VariantInput[] = variants.map((variant, index) => {
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
      });

      await queueItemCreate(activeStore, identityId, {
        itemType,
        sku: undefined,
        name: name.trim(),
        unit,
        variants: variantPayload,
      });
      await syncOnce(activeStore).catch(() => null);
      navigate("/app/items");
    } catch (error) {
      console.error(error);
      setFormError("Unable to save items right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickRowsWithName = quickRows.filter((row) => row.name.trim().length > 0).length;

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:p-2">
        <CardHeader className="pb-1.5 lg:shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm lg:text-[13px]">Add Items</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Compact quick-entry for multiple items. Toggle variant mode for advanced single-item setup.
              </CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 lg:flex-nowrap">
              <Button
                type="submit"
                form="add-items-form"
                size="sm"
                className="h-7 px-2"
                disabled={loading}
              >
                {loading ? "Saving..." : hasVariants ? "Save Variant Item" : "Save Items"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => navigate("/app/items")}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:space-y-1 lg:[&_button]:text-[10px] lg:[&_input]:text-[10px] lg:[&_label]:text-[10px] lg:[&_p]:text-[10px] lg:[&_select]:text-[10px] lg:[&_span]:text-[10px]">
          <form
            id="add-items-form"
            onSubmit={onSubmit}
            className="space-y-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1"
          >
            <div className="rounded-xl border border-white/70 bg-white/60 p-1.5">
              <label
                htmlFor="variant-mode"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground lg:text-[10px]"
              >
                <input
                  id="variant-mode"
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(event) => {
                    setHasVariants(event.target.checked);
                    setFormError(null);
                  }}
                />
                Variant mode (single item)
              </label>
            </div>

            <div className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:space-y-1">
              {!hasVariants ? (
              <div className="space-y-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1">
                <div className="overflow-hidden rounded-xl border border-white/75 bg-white/70 lg:flex lg:min-h-0 lg:flex-col">
                  <div className="hidden grid-cols-[minmax(0,2.6fr)_minmax(0,1.8fr)_84px_92px_50px] gap-1 border-b border-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground lg:grid lg:shrink-0">
                    <span>Name</span>
                    <span>SKU</span>
                    <span>Unit</span>
                    <span>Type</span>
                    <span className="text-right">Del</span>
                  </div>

                  <div className="grid gap-1 p-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    {quickRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="grid gap-1 rounded-lg border border-white/70 bg-white/80 p-1 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1.8fr)_84px_92px_50px] lg:items-center lg:border-0 lg:bg-transparent lg:p-0"
                      >
                        <Input
                          className={DENSE_INPUT_CLASS}
                          value={row.name}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder={`Item ${index + 1} name`}
                        />
                        <Input
                          className={DENSE_INPUT_CLASS}
                          value={row.sku}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, sku: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="SKU (optional)"
                        />
                        <Select
                          className={`${DENSE_SELECT_CLASS} w-full`}
                          value={row.unit}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? {
                                      ...entry,
                                      unit: event.target.value as (typeof UNIT_OPTIONS)[number],
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Select>
                        <Select
                          className={`${DENSE_SELECT_CLASS} w-full`}
                          value={row.itemType}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? {
                                      ...entry,
                                      itemType: event.target.value as "PRODUCT" | "SERVICE",
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          <option value="PRODUCT">Product</option>
                          <option value="SERVICE">Service</option>
                        </Select>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label="Delete item row"
                            title="Delete row"
                            className="h-7 w-7 p-0"
                            disabled={quickRows.length <= 1}
                            onClick={() =>
                              setQuickRows((current) =>
                                current.filter((entry) => entry.id !== row.id),
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 lg:shrink-0 lg:flex-nowrap">
                  <p className="text-[11px] text-muted-foreground lg:text-[10px]">
                    Ready:{" "}
                    <span className="font-semibold text-foreground">{quickRowsWithName}</span>{" "}
                    item{quickRowsWithName === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-1 lg:flex-nowrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() =>
                        setQuickRows((current) => [...current, EMPTY_QUICK_ROW()])
                      }
                    >
                      Add Row
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setQuickRows(buildInitialRows())}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1">
                <div className="grid gap-1.5 rounded-xl border border-white/70 bg-white/65 p-1.5 lg:grid-cols-10 lg:items-end">
                  <div className="grid gap-1 lg:col-span-4">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      className={DENSE_INPUT_CLASS}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required={hasVariants}
                    />
                  </div>
                  <div className="grid gap-1 lg:col-span-3">
                    <Label>Item type</Label>
                    <Select
                      className={`${DENSE_SELECT_CLASS} w-full`}
                      value={itemType}
                      onChange={(event) =>
                        setItemType(event.target.value as "PRODUCT" | "SERVICE")
                      }
                    >
                      <option value="PRODUCT">Product</option>
                      <option value="SERVICE">Service</option>
                    </Select>
                  </div>
                  <div className="grid gap-1 lg:col-span-1">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      id="unit"
                      className={`${DENSE_SELECT_CLASS} w-full`}
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
                  <div className="grid gap-1 lg:col-span-2">
                    <Label htmlFor="sku">Base SKU</Label>
                    <Input
                      id="sku"
                      className={DENSE_INPUT_CLASS}
                      value={sku}
                      onChange={(event) => setSku(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 lg:shrink-0">
                    <p className="text-[11px] font-medium text-foreground lg:text-[10px]">Variants</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setVariants((current) => [...current, EMPTY_VARIANT()]);
                      }}
                    >
                      Add Variant
                    </Button>
                  </div>

                  <div className="grid gap-1.5 lg:min-h-0 lg:overflow-y-auto">
                    {variants.map((variant, index) => (
                      <div
                        key={variant.id}
                        className="rounded-xl border border-white/80 bg-white/65 p-1.5"
                      >
                      <div className="grid gap-1.5 lg:grid-cols-12 lg:items-center">
                        <div className="grid gap-1 lg:col-span-1">
                          <Label className="text-[10px] text-muted-foreground">Default</Label>
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground lg:text-[10px]">
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
                            Set
                          </label>
                        </div>
                        <div className="grid gap-1 lg:col-span-2">
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
                            placeholder="Variant name"
                          />
                        </div>
                        <div className="grid gap-1 lg:col-span-2">
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
                        <div className="grid gap-1 lg:col-span-2">
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
                        <div className="grid gap-1 lg:col-span-4 lg:content-center">
                          <Label>Options</Label>
                          <div className="flex min-h-7 flex-wrap content-center items-center gap-1 rounded-lg border border-white/75 bg-white/75 px-1.5 py-1">
                            {variant.optionRows.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">No options</p>
                            ) : (
                              variant.optionRows.map((row) => (
                                <span
                                  key={row.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-[#d6e4f5] bg-[#f4f8ff] px-2 py-0.5 text-[10px] text-[#1f4167]"
                                >
                                  <span className="font-medium">{row.key}</span>
                                  <span className="text-[#2f5f92]">{row.value}</span>
                                  <button
                                    type="button"
                                    className="rounded-full text-[10px] leading-none text-[#2f5f92] hover:text-[#17395b]"
                                    aria-label={`Remove option ${row.key} ${row.value}`}
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
                                    x
                                  </button>
                                </span>
                              ))
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => {
                                setFormError(null);
                                setOptionModalVariantId(variant.id);
                              }}
                            >
                              + Option
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-1 lg:col-span-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
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
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )}
            </div>

            {formError ? (
              <p className="text-[11px] text-red-600 lg:shrink-0 lg:text-[10px]">{formError}</p>
            ) : null}

          </form>
        </CardContent>
      </Card>

      {optionModalVariantId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3">
          <div className="w-full max-w-sm rounded-xl border border-white/70 bg-white p-2.5 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.45)]">
            <p className="text-[11px] font-semibold text-foreground lg:text-[10px]">Add Option</p>
            <div className="mt-2 grid gap-1.5">
              <div className="grid gap-1">
                <Label htmlFor="option-key">Key</Label>
                <Input
                  id="option-key"
                  list="option-key-suggestions"
                  className={DENSE_INPUT_CLASS}
                  value={optionKeyDraft}
                  onChange={(event) => setOptionKeyDraft(event.target.value)}
                  placeholder="Size"
                />
                <datalist id="option-key-suggestions">
                  {optionKeySuggestions.map((key) => (
                    <option key={key} value={key} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="option-value">Value</Label>
                <Input
                  id="option-value"
                  className={DENSE_INPUT_CLASS}
                  value={optionValueDraft}
                  onChange={(event) => setOptionValueDraft(event.target.value)}
                  placeholder="M"
                />
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={closeOptionModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2"
                onClick={saveOptionChip}
              >
                + Option
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
