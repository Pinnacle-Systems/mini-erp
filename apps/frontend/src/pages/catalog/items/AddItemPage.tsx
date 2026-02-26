import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  getLocalItemCategoriesForStore,
  getLocalOptionDiscoveryForStore,
  getRemoteItemCategoriesForStore,
  getRemoteOptionDiscoveryForStore,
  queueItemCreate,
  syncOnce,
  type OptionDiscovery,
  type VariantInput,
} from "../../../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const DENSE_INPUT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const DENSE_SELECT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const OPTION_DISCOVERY_STORAGE_KEY = "mini-erp-option-discovery";
const ITEM_CATEGORIES_STORAGE_KEY = "mini-erp-item-categories";
const getOptionDiscoveryStorageKey = (storeId: string) =>
  `${OPTION_DISCOVERY_STORAGE_KEY}:${storeId}`;
const getItemCategoriesStorageKey = (storeId: string) =>
  `${ITEM_CATEGORIES_STORAGE_KEY}:${storeId}`;

const emptyOptionDiscovery = (): OptionDiscovery => ({
  optionKeys: [],
  optionValuesByKey: {},
});

const sortUnique = (values: string[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort((a, b) => a.localeCompare(b));
const normalizeCategory = (value: string) => value.trim();

const readStoredItemCategories = (storeId: string): string[] => {
  try {
    const raw = window.localStorage.getItem(getItemCategoriesStorageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortUnique(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return [];
  }
};

const readStoredOptionDiscovery = (storeId: string): OptionDiscovery => {
  try {
    const raw = window.localStorage.getItem(getOptionDiscoveryStorageKey(storeId));
    if (!raw) return emptyOptionDiscovery();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        optionKeys: sortUnique(
          parsed.filter((value): value is string => typeof value === "string"),
        ),
        optionValuesByKey: {},
      };
    }
    if (!parsed || typeof parsed !== "object") return emptyOptionDiscovery();

    const parsedRecord = parsed as Record<string, unknown>;
    const optionKeys = Array.isArray(parsedRecord.optionKeys)
      ? sortUnique(
          parsedRecord.optionKeys.filter(
            (value): value is string => typeof value === "string",
          ),
        )
      : [];
    const rawOptionValues =
      parsedRecord.optionValuesByKey && typeof parsedRecord.optionValuesByKey === "object"
        ? (parsedRecord.optionValuesByKey as Record<string, unknown>)
        : {};
    const optionValuesByKey = Object.fromEntries(
      Object.entries(rawOptionValues).map(([key, values]) => {
        const nextValues = Array.isArray(values)
          ? sortUnique(values.filter((value): value is string => typeof value === "string"))
          : [];
        return [key.trim(), nextValues];
      }),
    ) as Record<string, string[]>;

    return {
      optionKeys: sortUnique([...optionKeys, ...Object.keys(optionValuesByKey)]),
      optionValuesByKey,
    };
  } catch {
    return emptyOptionDiscovery();
  }
};

type QuickItemDraft = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: (typeof UNIT_OPTIONS)[number];
  itemType: "PRODUCT" | "SERVICE";
};

const EMPTY_VARIANT = (): ItemVariantDraft => ({
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
  category: "",
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
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<(typeof UNIT_OPTIONS)[number]>("PCS");
  const [variants, setVariants] = useState<ItemVariantDraft[]>([EMPTY_VARIANT()]);
  const [quickRows, setQuickRows] = useState<QuickItemDraft[]>(buildInitialRows());
  const [optionModalVariantId, setOptionModalVariantId] = useState<string | null>(null);
  const [optionKeyDraft, setOptionKeyDraft] = useState("");
  const [optionValueDraft, setOptionValueDraft] = useState("");
  const [savedOptionKeys, setSavedOptionKeys] = useState<string[]>([]);
  const [savedOptionValuesByKey, setSavedOptionValuesByKey] = useState<
    Record<string, string[]>
  >({});
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
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

  const optionValueSuggestions = useMemo(() => {
    const key = optionKeyDraft.trim();
    if (!key) return [];

    const fromSaved = savedOptionValuesByKey[key] ?? [];
    const fromVariants = variants
      .flatMap((variant) => variant.optionRows)
      .filter((row) => row.key.trim() === key)
      .map((row) => row.value.trim())
      .filter(Boolean);

    return sortUnique([...fromSaved, ...fromVariants]);
  }, [optionKeyDraft, savedOptionValuesByKey, variants]);

  const categorySuggestions = useMemo(
    () => sortUnique([...savedCategories, category, ...quickRows.map((row) => row.category)]),
    [category, quickRows, savedCategories],
  );

  const persistOptionDiscovery = (
    storeId: string,
    optionKeys: string[],
    optionValuesByKey: Record<string, string[]>,
  ) => {
    try {
      window.localStorage.setItem(
        getOptionDiscoveryStorageKey(storeId),
        JSON.stringify({
          optionKeys,
          optionValuesByKey,
        } satisfies OptionDiscovery),
      );
    } catch {
      // Ignore storage failures and keep in-memory suggestions.
    }
  };

  useEffect(() => {
    if (!activeStore) return;
    persistOptionDiscovery(activeStore, savedOptionKeys, savedOptionValuesByKey);
  }, [activeStore, savedOptionKeys, savedOptionValuesByKey]);

  useEffect(() => {
    if (!activeStore) return;
    try {
      window.localStorage.setItem(
        getItemCategoriesStorageKey(activeStore),
        JSON.stringify(savedCategories),
      );
    } catch {
      // Ignore storage failures and keep in-memory suggestions.
    }
  }, [activeStore, savedCategories]);

  useEffect(() => {
    let cancelled = false;

    const loadOptionSuggestions = async () => {
      if (!activeStore) {
        setSavedOptionKeys([]);
        setSavedOptionValuesByKey({});
        return;
      }

      const persisted = readStoredOptionDiscovery(activeStore);
      const [localDiscovered, remoteDiscovered] = await Promise.all([
        getLocalOptionDiscoveryForStore(activeStore).catch(() => emptyOptionDiscovery()),
        getRemoteOptionDiscoveryForStore(activeStore).catch(() => emptyOptionDiscovery()),
      ]);
      if (cancelled) return;

      const mergedValuesByKey = Object.fromEntries(
        sortUnique([
          ...Object.keys(persisted.optionValuesByKey),
          ...Object.keys(localDiscovered.optionValuesByKey),
          ...Object.keys(remoteDiscovered.optionValuesByKey),
        ]).map((key) => [
          key,
          sortUnique([
            ...(persisted.optionValuesByKey[key] ?? []),
            ...(localDiscovered.optionValuesByKey[key] ?? []),
            ...(remoteDiscovered.optionValuesByKey[key] ?? []),
          ]),
        ]),
      ) as Record<string, string[]>;
      const mergedKeys = sortUnique([
        ...persisted.optionKeys,
        ...localDiscovered.optionKeys,
        ...remoteDiscovered.optionKeys,
        ...Object.keys(mergedValuesByKey),
      ]);

      setSavedOptionKeys(mergedKeys);
      setSavedOptionValuesByKey(mergedValuesByKey);
    };

    void loadOptionSuggestions();

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  useEffect(() => {
    let cancelled = false;

    const loadCategorySuggestions = async () => {
      if (!activeStore) {
        setSavedCategories([]);
        return;
      }

      const persisted = readStoredItemCategories(activeStore);
      const [localCategories, remoteCategories] = await Promise.all([
        getLocalItemCategoriesForStore(activeStore).catch(() => []),
        getRemoteItemCategoriesForStore(activeStore).catch(() => []),
      ]);
      if (cancelled) return;

      setSavedCategories(sortUnique([...persisted, ...localCategories, ...remoteCategories]));
    };

    void loadCategorySuggestions();

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

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
    setSavedOptionKeys((current) => sortUnique([...current, key]));
    setSavedOptionValuesByKey((current) => {
      return {
        ...current,
        [key]: sortUnique([...(current[key] ?? []), value]),
      };
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
            category: normalizeCategory(row.category),
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
            category: row.category || undefined,
            unit: row.unit,
          });
        }
        setSavedCategories((current) =>
          sortUnique([...current, ...rowsToCreate.map((row) => row.category)]),
        );

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
        category: normalizeCategory(category) || undefined,
        unit,
        variants: variantPayload,
      });
      setSavedCategories((current) =>
        sortUnique([...current, normalizeCategory(category)]),
      );
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
            <PageActionBar
              primaryType="submit"
              primaryForm="add-items-form"
              primaryLabel={hasVariants ? "Add Variant Item" : "Add Items"}
              primaryLoading={loading}
              primaryLoadingLabel="Saving..."
              primaryDisabled={loading}
              secondaryLabel="Cancel"
              secondaryDisabled={loading}
              onSecondaryClick={() => navigate("/app/items")}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:space-y-1 lg:[&_button]:text-[10px] lg:[&_input]:text-[10px] lg:[&_label]:text-[10px] lg:[&_p]:text-[10px] lg:[&_select]:text-[10px] lg:[&_span]:text-[10px]">
          <form
            id="add-items-form"
            onSubmit={onSubmit}
            className="space-y-1.5 pb-20 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1 lg:pb-0"
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
                  <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_84px_84px_minmax(0,1.8fr)_50px] gap-1 border-b border-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground lg:grid lg:shrink-0">
                    <span>Name</span>
                    <span>SKU</span>
                    <span>Unit</span>
                    <span>Type</span>
                    <span>Category</span>
                    <span className="text-right">Del</span>
                  </div>

                  <div className="grid gap-1 p-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    {quickRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="grid gap-1 rounded-lg border border-white/70 bg-white/80 p-1 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_84px_84px_minmax(0,1.8fr)_50px] lg:items-center lg:border-0 lg:bg-transparent lg:p-0"
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
                        <LookupDropdownInput
                          value={row.category}
                          onValueChange={(value) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, category: value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Category"
                          options={categorySuggestions}
                          getOptionKey={(categoryValue) => categoryValue}
                          getOptionSearchText={(categoryValue) => categoryValue}
                          onOptionSelect={(categoryValue) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, category: categoryValue }
                                  : entry,
                              ),
                            )
                          }
                          renderOption={(categoryValue) => (
                            <div className="truncate font-medium">{categoryValue}</div>
                          )}
                          maxVisibleOptions={10}
                          inputClassName={DENSE_INPUT_CLASS}
                          optionClassName="text-[10px]"
                        />
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
                <div className="grid gap-1.5 rounded-xl border border-white/70 bg-white/65 p-1.5 lg:grid-cols-12 lg:items-end">
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
                    <Label>Type</Label>
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
                  <div className="grid gap-1 lg:col-span-3">
                    <Label htmlFor="category">Category</Label>
                    <LookupDropdownInput
                      id="category"
                      value={category}
                      onValueChange={setCategory}
                      placeholder="Category"
                      options={categorySuggestions}
                      getOptionKey={(categoryValue) => categoryValue}
                      getOptionSearchText={(categoryValue) => categoryValue}
                      onOptionSelect={setCategory}
                      renderOption={(categoryValue) => (
                        <div className="truncate font-medium">{categoryValue}</div>
                      )}
                      maxVisibleOptions={10}
                      inputClassName={DENSE_INPUT_CLASS}
                      optionClassName="text-[10px]"
                    />
                  </div>
                </div>

                <ItemVariantCardsEditor
                  variants={variants}
                  onVariantsChange={setVariants}
                  onAddVariant={() => setVariants((current) => [...current, EMPTY_VARIANT()])}
                  onOpenOptionModal={(variantId) => {
                    setFormError(null);
                    setOptionModalVariantId(variantId);
                  }}
                  denseInputClassName={DENSE_INPUT_CLASS}
                />
              </div>
              )}
            </div>

            {formError ? (
              <p className="text-[11px] text-red-600 lg:shrink-0 lg:text-[10px]">{formError}</p>
            ) : null}

          </form>
        </CardContent>
      </Card>

      <VariantOptionModal
        open={Boolean(optionModalVariantId)}
        idPrefix="add-item"
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
    </section>
  );
}
