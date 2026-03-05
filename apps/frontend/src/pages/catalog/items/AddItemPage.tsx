import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { IconButton } from "../../../design-system/atoms/IconButton";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import { Select } from "../../../design-system/atoms/Select";
import { Switch } from "../../../design-system/atoms/Switch";
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
  getLocalItemsForDisplay,
  getLocalOptionDiscoveryForStore,
  getRemoteItemCategoriesForStore,
  getRemoteOptionDiscoveryForStore,
  queueItemCreate,
  queueItemPriceUpsert,
  syncOnce,
  type OptionDiscovery,
  type VariantInput,
} from "../../../features/sync/engine";
import { runLocalItemPreflightChecks, toUserItemErrorMessage } from "./item-utils";

const UNIT_GROUPS = [
  {
    label: "General",
    options: ["PCS", "UNIT", "SET", "PAIR", "PACK"] as const,
  },
  {
    label: "Packaging",
    options: ["BOX", "CARTON", "BAGS", "BOTTLES", "CANS"] as const,
  },
  {
    label: "Service",
    options: ["JOB", "VISIT", "SESSION", "HOUR", "DAY"] as const,
  },
  {
    label: "Material",
    options: ["ROLL", "SHEET"] as const,
  },
  {
    label: "Weight & Volume",
    options: ["GRAM", "KG", "MILLILITRE", "LITRE"] as const,
  },
  {
    label: "Length",
    options: ["MM", "CM", "M", "FEET", "INCH"] as const,
  },
] as const;
type UnitOption = (typeof UNIT_GROUPS)[number]["options"][number];
const getOrderedUnitGroups = (itemType: "PRODUCT" | "SERVICE") => {
  if (itemType !== "SERVICE") {
    return UNIT_GROUPS;
  }

  const serviceGroup = UNIT_GROUPS.find((group) => group.label === "Service");
  const remainingGroups = UNIT_GROUPS.filter((group) => group.label !== "Service");
  return serviceGroup ? [serviceGroup, ...remainingGroups] : UNIT_GROUPS;
};
const DENSE_INPUT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const DENSE_SELECT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const QUICK_ENTRY_INPUT_CLASS = "h-8 rounded-lg px-2.5 text-[11px]";
const QUICK_ENTRY_SELECT_CLASS = "h-8 rounded-lg px-2.5 text-[11px]";
const OPTION_DISCOVERY_STORAGE_KEY = "mini-erp-option-discovery";
const ITEM_CATEGORIES_STORAGE_KEY = "mini-erp-item-categories";
const MOBILE_QUICK_ROW_COUNT = 1;
const DESKTOP_QUICK_ROW_COUNT = 5;
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
const normalizeOptionKey = (value: string) => value.trim().toLowerCase();
const normalizeHsnSac = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};
const parsePriceDraft = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return { amount: undefined as number | undefined, error: null as string | null };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { amount: undefined, error: "Price must be a non-negative number." };
  }
  return { amount: Number(parsed.toFixed(2)), error: null };
};

const sanitizeSkuChunk = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const abbreviateSkuChunk = (value: string) => {
  const sanitized = sanitizeSkuChunk(value);
  if (!sanitized) return "";
  const disemvoweled = `${sanitized[0]}${sanitized
    .slice(1)
    .replace(/[AEIOU]/g, "")}`.replace(/CK/g, "K");
  const preferred = disemvoweled.length > 0 ? disemvoweled : sanitized;
  const monthHeuristic = preferred.replace(/^MNTH/, "MTH");
  if (monthHeuristic.length >= 4) return monthHeuristic.slice(0, 4);
  if (monthHeuristic.length >= 3) return monthHeuristic.slice(0, 3);
  return sanitized.slice(0, Math.min(4, sanitized.length));
};

const buildSkuBaseIdentifier = (itemName: string) => {
  const normalized = sanitizeSkuChunk(itemName);
  if (!normalized) return "ITEM";
  return normalized.slice(0, 10);
};

const toComparableSku = (value: string) => value.trim().toUpperCase();

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
  hsnSac: string;
  salesPrice: string;
  purchasePrice: string;
  category: string;
  unit: UnitOption;
};

type AddItemPageProps = {
  itemType: "PRODUCT" | "SERVICE";
  title: string;
  singularLabel: string;
  routeBasePath: string;
};

type BulkOptionDraft = {
  id: string;
  key: string;
  valueDraft: string;
  values: string[];
};

const EMPTY_VARIANT = (): ItemVariantDraft => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  barcode: "",
  salesPrice: "",
  purchasePrice: "",
  skuManuallyEdited: false,
  optionRows: [],
});

const EMPTY_QUICK_ROW = (): QuickItemDraft => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  hsnSac: "",
  salesPrice: "",
  purchasePrice: "",
  category: "",
  unit: "PCS",
});

const getDefaultQuickRowCount = () => {
  if (typeof window === "undefined") return DESKTOP_QUICK_ROW_COUNT;
  return window.matchMedia("(min-width: 1024px)").matches
    ? DESKTOP_QUICK_ROW_COUNT
    : MOBILE_QUICK_ROW_COUNT;
};

const buildInitialRows = (count = getDefaultQuickRowCount()) =>
  Array.from({ length: count }, () => EMPTY_QUICK_ROW());

const MAX_BULK_OPTION_KEYS = 3;

const EMPTY_BULK_OPTION = (): BulkOptionDraft => ({
  id: crypto.randomUUID(),
  key: "",
  valueDraft: "",
  values: [],
});

const buildVariantOptionSignature = (
  optionRows: { key: string; value: string }[],
) =>
  optionRows
    .map((entry) => `${entry.key.trim().toLowerCase()}=${entry.value.trim().toLowerCase()}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");

const buildOptionCombinations = (
  options: Array<{ key: string; values: string[] }>,
): Array<Array<{ key: string; value: string }>> => {
  if (options.length === 0) return [];
  return options.reduce<Array<Array<{ key: string; value: string }>>>(
    (acc, option) => {
      if (acc.length === 0) {
        return option.values.map((value) => [{ key: option.key, value }]);
      }
      return acc.flatMap((partial) =>
        option.values.map((value) => [...partial, { key: option.key, value }]),
      );
    },
    [],
  );
};

export function AddItemPage({
  itemType: forcedItemType,
  title,
  singularLabel,
  routeBasePath,
}: AddItemPageProps) {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  const [hasVariants, setHasVariants] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<UnitOption>("PCS");
  const [variants, setVariants] = useState<ItemVariantDraft[]>([EMPTY_VARIANT()]);
  const [bulkOptions, setBulkOptions] = useState<BulkOptionDraft[]>([EMPTY_BULK_OPTION()]);
  const [quickRows, setQuickRows] = useState<QuickItemDraft[]>(() =>
    buildInitialRows(),
  );
  const [optionModalVariantId, setOptionModalVariantId] = useState<string | null>(null);
  const [optionKeyDraft, setOptionKeyDraft] = useState("");
  const [optionValueDraft, setOptionValueDraft] = useState("");
  const [savedOptionKeys, setSavedOptionKeys] = useState<string[]>([]);
  const [savedOptionValuesByKey, setSavedOptionValuesByKey] = useState<
    Record<string, string[]>
  >({});
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
  const [reservedSkus, setReservedSkus] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const showPurchasePrice = forcedItemType !== "SERVICE";
  const taxCodeLabel = forcedItemType === "SERVICE" ? "SAC" : "HSN";
  const taxCodePlaceholder =
    forcedItemType === "SERVICE" ? "SAC (6 digits)" : "HSN (4-8 digits)";
  const quickEntryDesktopGridClass = showPurchasePrice
    ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_92px_minmax(0,1.6fr)_56px]"
    : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_92px_minmax(0,1.6fr)_56px]";
  const orderedUnitGroups = useMemo(
    () => getOrderedUnitGroups(forcedItemType),
    [forcedItemType],
  );

  const optionKeySuggestions = useMemo(() => {
    const fromVariants = variants
      .flatMap((variant) => variant.optionRows)
      .map((row) => row.key.trim())
      .filter(Boolean);
    return Array.from(new Set([...savedOptionKeys, ...fromVariants])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [savedOptionKeys, variants]);

  const bulkOptionKeySuggestions = useMemo(
    () =>
      sortUnique([
        ...optionKeySuggestions,
        ...bulkOptions.map((option) => option.key.trim()).filter(Boolean),
      ]),
    [bulkOptions, optionKeySuggestions],
  );

  const optionValueSuggestions = useMemo(() => {
    const normalizedKey = normalizeOptionKey(optionKeyDraft);
    if (!normalizedKey) return [];

    const fromSaved = Object.entries(savedOptionValuesByKey)
      .filter(([key]) => normalizeOptionKey(key) === normalizedKey)
      .flatMap(([, values]) => values);
    const fromVariants = variants
      .flatMap((variant) => variant.optionRows)
      .filter((row) => normalizeOptionKey(row.key) === normalizedKey)
      .map((row) => row.value.trim())
      .filter(Boolean);

    return sortUnique([...fromSaved, ...fromVariants]);
  }, [optionKeyDraft, savedOptionValuesByKey, variants]);

  const getBulkValueSuggestions = (key: string) => {
    const normalizedKey = normalizeOptionKey(key);
    if (!normalizedKey) return [];
    return sortUnique([
      ...Object.entries(savedOptionValuesByKey)
        .filter(([optionKey]) => normalizeOptionKey(optionKey) === normalizedKey)
        .flatMap(([, values]) => values),
      ...variants
        .flatMap((variant) => variant.optionRows)
        .filter((row) => normalizeOptionKey(row.key) === normalizedKey)
        .map((row) => row.value.trim())
        .filter(Boolean),
    ]);
  };

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
    const desktopMedia = window.matchMedia("(min-width: 1024px)");

    const syncQuickRowDefaults = () => {
      setQuickRows((current) => {
        const isPristine = current.every(
          (row) =>
            row.name.trim().length === 0 &&
            row.sku.trim().length === 0 &&
            row.hsnSac.trim().length === 0 &&
            row.salesPrice.trim().length === 0 &&
            row.purchasePrice.trim().length === 0 &&
            row.category.trim().length === 0 &&
            row.unit === "PCS",
        );
        if (!isPristine) return current;

        const nextCount = desktopMedia.matches
          ? DESKTOP_QUICK_ROW_COUNT
          : MOBILE_QUICK_ROW_COUNT;
        if (current.length === nextCount) return current;

        return buildInitialRows(nextCount);
      });
    };

    desktopMedia.addEventListener("change", syncQuickRowDefaults);
    syncQuickRowDefaults();

    return () => {
      desktopMedia.removeEventListener("change", syncQuickRowDefaults);
    };
  }, [forcedItemType]);

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

    const loadReservedSkus = async () => {
      if (!activeStore) {
        setReservedSkus(new Set());
        return;
      }
      const items = await getLocalItemsForDisplay(activeStore).catch(() => []);
      if (cancelled) return;
      const collected = new Set<string>();
      for (const item of items) {
        for (const sku of item.variantSkus) {
          const normalized = toComparableSku(sku);
          if (normalized) collected.add(normalized);
        }
      }
      setReservedSkus(collected);
    };

    void loadReservedSkus();

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  useEffect(() => {
    if (!hasVariants) return;
    if (variants.length === 0) return;

    const used = new Set(reservedSkus);
    for (const variant of variants) {
      if (!variant.skuManuallyEdited) continue;
      const normalized = toComparableSku(variant.sku);
      if (normalized) used.add(normalized);
    }

    const baseIdentifier = buildSkuBaseIdentifier(name);
    let changed = false;

    const next = variants.map((variant) => {
      if (variant.skuManuallyEdited) return variant;

      const optionParts = variant.optionRows
        .map((entry) => abbreviateSkuChunk(entry.value))
        .filter((entry) => entry.length > 0);
      const baseSku = [baseIdentifier, ...optionParts].join("-");
      const normalizedBase = toComparableSku(baseSku || "ITEM");
      let candidate = normalizedBase || "ITEM";
      let suffix = 0;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${normalizedBase || "ITEM"}-${suffix}`;
      }
      used.add(candidate);

      if (variant.sku !== candidate) {
        changed = true;
        return {
          ...variant,
          sku: candidate,
        };
      }
      return variant;
    });

    if (changed) {
      setVariants(next);
    }
  }, [hasVariants, name, reservedSkus, variants]);

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
    const normalizedKey = normalizeOptionKey(key);
    const canonicalKey =
      optionKeySuggestions.find(
        (optionKey) => normalizeOptionKey(optionKey) === normalizedKey,
      ) ?? key;

    setVariants((current) =>
      current.map((entry) =>
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
    );
    setSavedOptionKeys((current) => sortUnique([...current, canonicalKey]));
    setSavedOptionValuesByKey((current) => {
      const mergedValues = sortUnique([
        ...Object.entries(current)
          .filter(([optionKey]) => normalizeOptionKey(optionKey) === normalizedKey)
          .flatMap(([, values]) => values),
        value,
      ]);
      return {
        ...Object.fromEntries(
          Object.entries(current).filter(
            ([optionKey]) => normalizeOptionKey(optionKey) !== normalizedKey,
          ),
        ),
        [canonicalKey]: mergedValues,
      };
    });
    closeOptionModal();
  };

  const applyBulkOptionsToVariants = () => {
    const normalizedOptions = bulkOptions
      .map((option) => {
        const key = option.key.trim();
        const values = sortUnique([
          ...option.values,
          ...(option.valueDraft.trim().length > 0 ? [option.valueDraft] : []),
        ]);
        return {
          key,
          values,
        };
      })
      .filter((option) => option.key.length > 0 && option.values.length > 0);

    if (normalizedOptions.length === 0) {
      setFormError("Add at least one option key with values before applying.");
      return;
    }
    if (normalizedOptions.some((option) => option.values.length === 0)) {
      setFormError("Each option key must include at least one value.");
      return;
    }

    const combinations = buildOptionCombinations(normalizedOptions);
    if (combinations.length === 0) {
      setFormError("No option combinations generated.");
      return;
    }

    const existingBySignature = new Map(
      variants.map((variant) => [buildVariantOptionSignature(variant.optionRows), variant]),
    );

    const nextVariants = combinations.map((combination) => {
      const signature = buildVariantOptionSignature(combination);
      const existing = existingBySignature.get(signature);
      const optionRows = combination.map((entry) => ({
        id: crypto.randomUUID(),
        key: entry.key,
        value: entry.value,
      }));
      if (existing) {
        return {
          ...existing,
          optionRows,
        };
      }
      return {
        ...EMPTY_VARIANT(),
        optionRows,
      } satisfies ItemVariantDraft;
    });

    setVariants(nextVariants);
    setBulkOptions((current) =>
      current.map((option) => ({
        ...option,
        values: sortUnique([
          ...option.values,
          ...(option.valueDraft.trim().length > 0 ? [option.valueDraft] : []),
        ]),
        valueDraft: "",
      })),
    );
    setSavedOptionKeys((current) =>
      sortUnique([...current, ...normalizedOptions.map((option) => option.key)]),
    );
    setSavedOptionValuesByKey((current) => {
      const next = { ...current };
      for (const option of normalizedOptions) {
        const existingValues =
          Object.entries(next)
            .filter(([key]) => normalizeOptionKey(key) === normalizeOptionKey(option.key))
            .flatMap(([, values]) => values) ?? [];
        next[option.key] = sortUnique([...existingValues, ...option.values]);
      }
      return next;
    });
    setFormError(null);
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
            hsnSac: row.hsnSac.trim(),
            salesPrice: row.salesPrice.trim(),
            purchasePrice: row.purchasePrice.trim(),
            category: normalizeCategory(row.category),
          }))
          .filter((row) => row.name.length > 0);

        if (rowsToCreate.length === 0) {
          setFormError("Add at least one item name to save.");
          return;
        }

        const quickEntryPreflightError = await runLocalItemPreflightChecks(
          activeStore,
          rowsToCreate.map((row) => ({
            name: row.name,
            variants: [
              {
                sku: row.sku || undefined,
              },
            ],
          })),
        );
        if (quickEntryPreflightError) {
          setFormError(quickEntryPreflightError);
          return;
        }

        for (let index = 0; index < rowsToCreate.length; index += 1) {
          const row = rowsToCreate[index];
          const salesPrice = parsePriceDraft(row.salesPrice);
          if (salesPrice.error) {
            setFormError(`Row ${index + 1}: Sales price must be a non-negative number.`);
            return;
          }
          const purchasePrice = showPurchasePrice
            ? parsePriceDraft(row.purchasePrice)
            : { amount: undefined, error: null };
          if (showPurchasePrice && purchasePrice.error) {
            setFormError(`Row ${index + 1}: Purchase price must be a non-negative number.`);
            return;
          }
        }

        for (const row of rowsToCreate) {
          const salesPrice = parsePriceDraft(row.salesPrice).amount;
          const purchasePrice = showPurchasePrice
            ? parsePriceDraft(row.purchasePrice).amount
            : undefined;
          const variantId = crypto.randomUUID();
          await queueItemCreate(activeStore, identityId, {
            itemType: forcedItemType,
            name: row.name,
            hsnSac: normalizeHsnSac(row.hsnSac),
            category: row.category || undefined,
            unit: row.unit,
            variants: [
              {
                id: variantId,
                sku: row.sku || undefined,
              },
            ],
          });
          if (typeof salesPrice === "number") {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              variantId,
              salesPrice,
              "INR",
              undefined,
              "SALES",
            );
          }
          if (showPurchasePrice && typeof purchasePrice === "number") {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              variantId,
              purchasePrice,
              "INR",
              undefined,
              "PURCHASE",
            );
          }
        }
        setSavedCategories((current) =>
          sortUnique([...current, ...rowsToCreate.map((row) => row.category)]),
        );

        await syncOnce(activeStore);
        navigate(routeBasePath);
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

      const variantPayload: VariantInput[] = variants.map((variant) => {
        const optionValues = Object.fromEntries(
          variant.optionRows
            .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
            .filter(([key, value]) => key.length > 0 && value.length > 0),
        );
        return {
          id: variant.id,
          name: variant.name.trim() || undefined,
          sku: variant.sku.trim() || undefined,
          barcode: variant.barcode.trim() || undefined,
          optionValues: Object.keys(optionValues).length > 0 ? optionValues : undefined,
        };
      });

      const preflightError = await runLocalItemPreflightChecks(activeStore, [
        {
          name: name.trim(),
          variants: variantPayload.map((variant) => ({
            sku: variant.sku,
          })),
        },
      ]);
      if (preflightError) {
        setFormError(preflightError);
        return;
      }

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        const salesPrice = parsePriceDraft(variant.salesPrice ?? "");
        if (salesPrice.error) {
          setFormError(`Variant ${index + 1}: Sales price must be a non-negative number.`);
          return;
        }
        const purchasePrice = showPurchasePrice
          ? parsePriceDraft(variant.purchasePrice ?? "")
          : { amount: undefined, error: null };
        if (showPurchasePrice && purchasePrice.error) {
          setFormError(`Variant ${index + 1}: Purchase price must be a non-negative number.`);
          return;
        }
      }

      await queueItemCreate(activeStore, identityId, {
        itemType: forcedItemType,
        name: name.trim(),
        category: normalizeCategory(category) || undefined,
        unit,
        variants: variantPayload,
      });
      for (const variant of variants) {
        const salesPrice = parsePriceDraft(variant.salesPrice ?? "").amount;
        const purchasePrice = showPurchasePrice
          ? parsePriceDraft(variant.purchasePrice ?? "").amount
          : undefined;
        if (typeof salesPrice === "number") {
          await queueItemPriceUpsert(
            activeStore,
            identityId,
            variant.id,
            salesPrice,
            "INR",
            undefined,
            "SALES",
          );
        }
        if (showPurchasePrice && typeof purchasePrice === "number") {
          await queueItemPriceUpsert(
            activeStore,
            identityId,
            variant.id,
            purchasePrice,
            "INR",
            undefined,
            "PURCHASE",
          );
        }
      }
      setSavedCategories((current) =>
        sortUnique([...current, normalizeCategory(category)]),
      );
      await syncOnce(activeStore);
      navigate(routeBasePath);
    } catch (error) {
      console.error(error);
      setFormError(toUserItemErrorMessage(error));
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
              <CardTitle className="text-sm lg:text-[13px]">Add {title}</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Compact quick-entry for multiple {title.toLowerCase()}. Toggle variant mode for advanced single-{singularLabel.toLowerCase()} setup.
              </CardDescription>
            </div>
            <PageActionBar
              primaryType="submit"
              primaryForm="add-items-form"
              primaryLabel={
                hasVariants
                  ? `Add ${singularLabel}`
                  : `Add ${title} (${quickRowsWithName})`
              }
              primaryLoading={loading}
              primaryLoadingLabel="Saving..."
              primaryDisabled={loading}
              secondaryLabel="Cancel"
              secondaryDisabled={loading}
              onSecondaryClick={() => navigate(routeBasePath)}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:space-y-1 lg:[&_button]:text-[10px] lg:[&_input]:text-[10px] lg:[&_label]:text-[10px] lg:[&_p]:text-[10px] lg:[&_select]:text-[10px] lg:[&_span]:text-[10px]">
          <form
            id="add-items-form"
            onSubmit={onSubmit}
            className="space-y-1.5 pb-20 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1 lg:pb-0"
          >
            <div className="rounded-lg border border-border/80 bg-white p-1.5">
              <div className="grid gap-1.5 lg:flex lg:items-end lg:justify-between lg:gap-2">
                {hasVariants ? (
                  <div className="grid gap-1.5 lg:min-w-0 lg:flex-1 lg:grid-cols-[minmax(0,2.2fr)_92px_minmax(0,1.7fr)]">
                    <div className="grid gap-1">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        className={DENSE_INPUT_CLASS}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required={hasVariants}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="unit">Unit</Label>
                      <Select
                        id="unit"
                        className={`${DENSE_SELECT_CLASS} w-full`}
                        value={unit}
                        onChange={(event) =>
                          setUnit(event.target.value as UnitOption)
                        }
                      >
                        {orderedUnitGroups.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </div>
                    <div className="grid gap-1">
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
                ) : null}
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground lg:shrink-0 lg:self-end lg:pb-[1px] lg:text-[10px]">
                  <Switch
                    id="variant-mode"
                    checked={hasVariants}
                    aria-label="Variant mode"
                    onCheckedChange={(checked) => {
                      setHasVariants(checked);
                      setFormError(null);
                    }}
                    className="h-6 w-11 border"
                    checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                    uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                  />
                  <Label htmlFor="variant-mode">Variant mode (single item)</Label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:space-y-1">
              {!hasVariants ? (
              <div className="space-y-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1">
                <div className="overflow-visible rounded-lg border border-border/80 bg-white lg:flex lg:min-h-0 lg:flex-col">
                  <div className={`hidden gap-1.5 border-b border-border/70 bg-slate-50/95 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground lg:grid lg:shrink-0 ${quickEntryDesktopGridClass}`}>
                    <span>Name</span>
                    <span>SKU</span>
                    <span>{taxCodeLabel}</span>
                    <span>Sales</span>
                    {showPurchasePrice ? <span>Purchase</span> : null}
                    <span>Unit</span>
                    <span>Category</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="grid gap-1.5 p-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    {quickRows.map((row, index) => (
                      <div
                        key={row.id}
                        className={`grid gap-1.5 rounded-lg border border-border/70 bg-white p-1.5 lg:items-center lg:border-0 lg:bg-transparent lg:p-0 ${quickEntryDesktopGridClass}`}
                      >
                        <Input
                          className={QUICK_ENTRY_INPUT_CLASS}
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
                          className={QUICK_ENTRY_INPUT_CLASS}
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
                        <Input
                          className={QUICK_ENTRY_INPUT_CLASS}
                          value={row.hsnSac}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, hsnSac: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder={taxCodePlaceholder}
                        />
                        <Input
                          className={QUICK_ENTRY_INPUT_CLASS}
                          value={row.salesPrice}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? { ...entry, salesPrice: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Sales price"
                          inputMode="decimal"
                        />
                        {showPurchasePrice ? (
                          <Input
                            className={QUICK_ENTRY_INPUT_CLASS}
                            value={row.purchasePrice}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, purchasePrice: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Purchase price"
                            inputMode="decimal"
                          />
                        ) : null}
                        <Select
                          className={`${QUICK_ENTRY_SELECT_CLASS} w-full`}
                          value={row.unit}
                          onChange={(event) =>
                            setQuickRows((current) =>
                              current.map((entry) =>
                                entry.id === row.id
                                  ? {
                                      ...entry,
                                      unit: event.target.value as UnitOption,
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          {orderedUnitGroups.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </optgroup>
                          ))}
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
                          inputClassName={QUICK_ENTRY_INPUT_CLASS}
                          optionClassName="text-[10px]"
                        />
                        <div className="flex justify-end">
                          <IconButton
                            type="button"
                            icon={Trash2}
                            variant="ghost"
                            aria-label="Delete item row"
                            title="Delete row"
                            className="h-8 w-8 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                            disabled={quickRows.length <= 1}
                            onClick={() =>
                              setQuickRows((current) =>
                                current.filter((entry) => entry.id !== row.id),
                              )
                            }
                            iconSize={14}
                          />
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
                <div className="rounded-lg border border-border/80 bg-white p-1.5">
                  <p className="text-[11px] font-semibold text-foreground lg:text-[10px]">Options</p>
                  <div className="mt-1.5 space-y-1.5">
                    {bulkOptions.map((option) => (
                      <div
                        key={option.id}
                        className="grid gap-1.5 rounded-md border border-border/70 bg-slate-50/60 p-1.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto]"
                      >
                        <div className="grid gap-1">
                          <Label className="text-[10px]">Option Name</Label>
                          <LookupDropdownInput
                            value={option.key}
                            onValueChange={(value) =>
                              setBulkOptions((current) =>
                                current.map((entry) =>
                                  entry.id === option.id ? { ...entry, key: value } : entry,
                                ),
                              )
                            }
                            placeholder="Size"
                            options={bulkOptionKeySuggestions}
                            getOptionKey={(value) => value}
                            getOptionSearchText={(value) => value}
                            onOptionSelect={(value) =>
                              setBulkOptions((current) =>
                                current.map((entry) =>
                                  entry.id === option.id ? { ...entry, key: value } : entry,
                                ),
                              )
                            }
                            renderOption={(value) => <div className="truncate font-medium">{value}</div>}
                            inputClassName={DENSE_INPUT_CLASS}
                            optionClassName="text-[10px]"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-[10px]">Values</Label>
                          <LookupDropdownInput
                            value={option.valueDraft}
                            onValueChange={(value) =>
                              setBulkOptions((current) =>
                                current.map((entry) =>
                                  entry.id === option.id ? { ...entry, valueDraft: value } : entry,
                                ),
                              )
                            }
                            placeholder="Small"
                            options={getBulkValueSuggestions(option.key)}
                            getOptionKey={(value) => value}
                            getOptionSearchText={(value) => value}
                            onOptionSelect={(value) =>
                              setBulkOptions((current) =>
                                current.map((entry) =>
                                  entry.id === option.id ? { ...entry, valueDraft: value } : entry,
                                ),
                              )
                            }
                            inputProps={{
                              onKeyDown: (event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                const value = option.valueDraft.trim();
                                if (!value) return;
                                setBulkOptions((current) =>
                                  current.map((entry) =>
                                    entry.id === option.id
                                      ? {
                                          ...entry,
                                          values: sortUnique([...entry.values, value]),
                                          valueDraft: "",
                                        }
                                      : entry,
                                  ),
                                );
                              },
                            }}
                            renderOption={(value) => <div className="truncate font-medium">{value}</div>}
                            inputClassName={DENSE_INPUT_CLASS}
                            optionClassName="text-[10px]"
                          />
                          <div className="flex flex-wrap gap-1">
                            {option.values.map((value) => (
                              <span
                                key={`${option.id}:${value}`}
                                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white px-2 py-0.5 text-[10px]"
                              >
                                {value}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 px-1 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setBulkOptions((current) =>
                                      current.map((entry) =>
                                        entry.id === option.id
                                          ? {
                                              ...entry,
                                              values: entry.values.filter((entryValue) => entryValue !== value),
                                            }
                                          : entry,
                                      ),
                                    )
                                  }
                                  aria-label={`Remove ${value}`}
                                >
                                  x
                                </Button>
                              </span>
                            ))}
                            {option.values.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground">No values added</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-start justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => {
                              const value = option.valueDraft.trim();
                              if (!value) return;
                              setBulkOptions((current) =>
                                current.map((entry) =>
                                  entry.id === option.id
                                    ? {
                                        ...entry,
                                        values: sortUnique([...entry.values, value]),
                                        valueDraft: "",
                                      }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            Add Value
                          </Button>
                          <IconButton
                            type="button"
                            icon={Trash2}
                            variant="ghost"
                            aria-label="Remove option key"
                            title="Remove option key"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                            disabled={bulkOptions.length <= 1}
                            onClick={() =>
                              setBulkOptions((current) =>
                                current.filter((entry) => entry.id !== option.id),
                              )
                            }
                            iconSize={14}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        disabled={bulkOptions.length >= MAX_BULK_OPTION_KEYS}
                        onClick={() =>
                          setBulkOptions((current) => [...current, EMPTY_BULK_OPTION()])
                        }
                      >
                        + Add another option
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2"
                        onClick={applyBulkOptionsToVariants}
                      >
                        Apply Options
                      </Button>
                    </div>
                  </div>
                </div>

                <ItemVariantCardsEditor
                  variants={variants}
                  onVariantsChange={setVariants}
                  onVariantSkuChange={(variantId, sku) => {
                    setVariants((current) =>
                      current.map((variant) =>
                        variant.id === variantId
                          ? {
                              ...variant,
                              sku,
                              skuManuallyEdited: true,
                            }
                          : variant,
                      ),
                    );
                  }}
                  onAddVariant={() => setVariants((current) => [...current, EMPTY_VARIANT()])}
                  onOpenOptionModal={(variantId) => {
                    setFormError(null);
                    setOptionModalVariantId(variantId);
                  }}
                  addVariantLabel="Add Row"
                  denseInputClassName={DENSE_INPUT_CLASS}
                  showPricingFields
                  showPurchasePrice={showPurchasePrice}
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
