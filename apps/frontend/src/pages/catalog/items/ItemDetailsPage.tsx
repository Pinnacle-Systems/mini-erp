import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { TokenizerInput } from "../../../design-system/molecules/TokenizerInput";
import {
  ItemVariantCardsEditor,
  type ItemVariantDraft,
} from "../../../design-system/organisms/ItemVariantCardsEditor";
import { useSessionStore } from "../../../features/auth/session-business";
import {
  getLocalItemDetailForDisplay,
  getLocalItemsForDisplay,
  getLocalItemPricingRowsForDisplay,
  getLocalItemCategoriesForStore,
  getLocalOptionDiscoveryForStore,
  getRemoteItemCategoriesForStore,
  getRemoteOptionDiscoveryForStore,
  queueItemPurge,
  queueItemPriceUpsert,
  queueItemUpdate,
  queueItemVariantCreate,
  queueItemVariantDelete,
  queueItemVariantPurge,
  queueItemVariantUpdate,
  syncOnce,
  type ItemDetailDisplay,
  type OptionDiscovery,
  type VariantInput,
} from "../../../features/sync/engine";
import { useToast } from "../../../features/toast/useToast";
import {
  runLocalItemPreflightChecks,
  toUserItemErrorMessage,
} from "./item-utils";
import { normalizeGstSlab } from "../../../lib/gst-slabs";
import { Button } from "../../../design-system/atoms/Button";
import { GstSlabSelect } from "../../../design-system/molecules/GstSlabSelect";

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
const getOrderedUnitGroups = (itemType: "PRODUCT" | "SERVICE") => {
  if (itemType !== "SERVICE") {
    return UNIT_GROUPS;
  }

  const serviceGroup = UNIT_GROUPS.find((group) => group.label === "Service");
  const remainingGroups = UNIT_GROUPS.filter(
    (group) => group.label !== "Service",
  );
  return serviceGroup ? [serviceGroup, ...remainingGroups] : UNIT_GROUPS;
};
type UnitOption = (typeof UNIT_GROUPS)[number]["options"][number];
const DENSE_INPUT_CLASS = "app-catalog-editor-input";
const DENSE_SELECT_CLASS = "app-catalog-editor-select";
const BULK_OPTION_INPUT_CLASS = "app-catalog-option-input";
const OPTION_DISCOVERY_STORAGE_KEY = "mini-erp-option-discovery";
const MAX_BULK_OPTION_KEYS = 3;
const SIMPLE_ROW_INPUT_CLASS = "app-catalog-simple-row-input";

type PricingSnapshot = {
  amount: number | null;
  currency: string;
  serverVersion: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  gstSlab?: string;
};

type DraftVariant = ItemVariantDraft & {
  isActive: boolean;
  usageCount: number;
  isLocked: boolean;
  salesPriceAmount: number | null;
  purchasePriceAmount: number | null;
  salesCurrency: string;
  purchaseCurrency: string;
  salesServerVersion: number;
  purchaseServerVersion: number;
  salesTaxMode: "EXCLUSIVE" | "INCLUSIVE";
  purchaseTaxMode: "EXCLUSIVE" | "INCLUSIVE";
};

type DraftItem = {
  id: string;
  name: string;
  hsnSac: string;
  category: string;
  baseSku: string;
  unit: UnitOption;
  itemType: "PRODUCT" | "SERVICE";
  variants: DraftVariant[];
};

type BulkOptionDraft = {
  id: string;
  key: string;
  valueDraft: string;
  values: string[];
};

type ItemDetailsPageProps = {
  itemType: "PRODUCT" | "SERVICE";
  title: string;
  singularLabel: string;
  routeBasePath: string;
};

const isItemActive = (variants: DraftVariant[]) =>
  variants.some((variant) => variant.isActive);

const sortUnique = (values: string[]) =>
  Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

const emptyOptionDiscovery = (): OptionDiscovery => ({
  optionKeys: [],
  optionValuesByKey: {},
});

const getOptionDiscoveryStorageKey = (storeId: string) =>
  `${OPTION_DISCOVERY_STORAGE_KEY}:${storeId}`;

const readStoredOptionDiscovery = (storeId: string): OptionDiscovery => {
  try {
    const raw = window.localStorage.getItem(
      getOptionDiscoveryStorageKey(storeId),
    );
    if (!raw) return emptyOptionDiscovery();
    const parsed = JSON.parse(raw);
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
      parsedRecord.optionValuesByKey &&
      typeof parsedRecord.optionValuesByKey === "object"
        ? (parsedRecord.optionValuesByKey as Record<string, unknown>)
        : {};
    const optionValuesByKey = Object.fromEntries(
      Object.entries(rawOptionValues).map(([key, values]) => [
        key.trim(),
        Array.isArray(values)
          ? sortUnique(
              values.filter(
                (value): value is string => typeof value === "string",
              ),
            )
          : [],
      ]),
    ) as Record<string, string[]>;

    return {
      optionKeys: sortUnique([
        ...optionKeys,
        ...Object.keys(optionValuesByKey),
      ]),
      optionValuesByKey,
    };
  } catch {
    return emptyOptionDiscovery();
  }
};

const normalizeOptionKey = (value: string) => value.trim().toLowerCase();

const sanitizeSkuChunk = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const toCondensedSkuChunk = (value: string) => {
  const sanitized = sanitizeSkuChunk(value);
  if (!sanitized) return "";
  const disemvoweled =
    `${sanitized[0]}${sanitized.slice(1).replace(/[AEIOU]/g, "")}`.replace(
      /CK/g,
      "K",
    );
  return disemvoweled.length > 0
    ? disemvoweled.replace(/^MNTH/, "MTH")
    : sanitized;
};

const abbreviateSkuChunk = (value: string) => {
  const condensed = toCondensedSkuChunk(value);
  if (!condensed) return "";
  if (condensed.length >= 4) return condensed.slice(0, 4);
  if (condensed.length >= 3) return condensed.slice(0, 3);
  return condensed.slice(0, Math.min(4, condensed.length));
};

const buildSkuBaseIdentifier = (itemName: string) => {
  const condensed = toCondensedSkuChunk(itemName);
  if (!condensed) return "ITEM";
  return condensed.slice(0, 10);
};

const deriveBaseSkuFromItemName = (itemName: string) => {
  const trimmed = itemName.trim();
  return trimmed ? buildSkuBaseIdentifier(trimmed) : "";
};

const toComparableSku = (value: string) => value.trim().toUpperCase();

const ensureUniqueSku = (value: string, usedSkus: Set<string>) => {
  const normalizedBase = toComparableSku(value) || "ITEM";
  let candidate = normalizedBase;
  let suffix = 0;
  while (usedSkus.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
  return candidate;
};

const buildAutoVariantName = (
  itemName: string,
  optionRows: Array<{ key: string; value: string }>,
) => {
  const baseName = itemName.trim() || "Item";
  const optionValues = optionRows
    .map((entry) => entry.value.trim())
    .filter((value) => value.length > 0);
  return optionValues.length > 0
    ? `${baseName} / ${optionValues.join(" / ")}`
    : baseName;
};

const buildVariantOptionSignature = (
  optionRows: { key: string; value: string }[],
) =>
  optionRows
    .map(
      (entry) =>
        `${entry.key.trim().toLowerCase()}=${entry.value.trim().toLowerCase()}`,
    )
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

const collectGeneratedVariantSignatures = (variants: DraftVariant[]) =>
  sortUnique(
    variants
      .map((variant) => buildVariantOptionSignature(variant.optionRows))
      .filter((signature) => signature.length > 0),
  );

const EMPTY_BULK_OPTION = (): BulkOptionDraft => ({
  id: crypto.randomUUID(),
  key: "",
  valueDraft: "",
  values: [],
});

const buildBulkOptionsFromVariants = (variants: DraftVariant[]) => {
  const valuesByKey = variants.reduce<Record<string, string[]>>(
    (acc, variant) => {
      for (const option of variant.optionRows) {
        const key = option.key.trim();
        const value = option.value.trim();
        if (!key || !value) continue;
        acc[key] = sortUnique([...(acc[key] ?? []), value]);
      }
      return acc;
    },
    {},
  );

  const options = Object.entries(valuesByKey).map(([key, values]) => ({
    id: crypto.randomUUID(),
    key,
    valueDraft: "",
    values,
  }));

  return options.length > 0 ? options : [EMPTY_BULK_OPTION()];
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
    isActive: variant.isActive,
    optionValues:
      Object.keys(optionValues).length > 0 ? optionValues : undefined,
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
    return (
      (key.length > 0 && value.length === 0) ||
      (key.length === 0 && value.length > 0)
    );
  });
};

const hasAdvancedVariantStructure = (variant: DraftVariant) =>
  variant.name.trim().length > 0;

const canUseSimpleVariantEditor = (draft: DraftItem) =>
  draft.variants.length === 1 &&
  !hasAdvancedVariantStructure(draft.variants[0]);

const shouldShowVariantEditorByDefault = (draft: DraftItem) =>
  !canUseSimpleVariantEditor(draft);

const parsePriceDraft = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return { amount: undefined as number | undefined, error: null as string | null };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { amount: undefined, error: "Price must be a non-negative number." };
  }
  return { amount: Number(parsed.toFixed(2)), error: null };
};

const formatPriceDraft = (amount: number | null) => {
  if (amount === null || Number.isNaN(amount)) return "";
  return amount.toFixed(2);
};

const toDraft = (
  item: ItemDetailDisplay,
  salesPricingByVariantId: Map<string, PricingSnapshot>,
  purchasePricingByVariantId: Map<string, PricingSnapshot>,
): DraftItem => ({
  id: item.id,
  name: item.name,
  hsnSac: item.hsnSac,
  category: item.category,
  baseSku: item.baseSku,
  unit: item.unit,
  itemType: item.itemType,
  variants: item.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    skuManuallyEdited: variant.sku.trim().length > 0,
    barcode: variant.barcode,
    gstSlab:
      normalizeGstSlab(salesPricingByVariantId.get(variant.id)?.gstSlab) ?? "",
    salesPrice: formatPriceDraft(salesPricingByVariantId.get(variant.id)?.amount ?? null),
    purchasePrice: formatPriceDraft(purchasePricingByVariantId.get(variant.id)?.amount ?? null),
    isActive: variant.isActive,
    optionRows: toOptionRows(variant.optionValues),
    usageCount: variant.usageCount,
    isLocked: variant.isLocked,
    salesPriceAmount: salesPricingByVariantId.get(variant.id)?.amount ?? null,
    purchasePriceAmount: purchasePricingByVariantId.get(variant.id)?.amount ?? null,
    salesCurrency: salesPricingByVariantId.get(variant.id)?.currency ?? "INR",
    purchaseCurrency: purchasePricingByVariantId.get(variant.id)?.currency ?? "INR",
    salesServerVersion:
      salesPricingByVariantId.get(variant.id)?.serverVersion ?? 0,
    purchaseServerVersion:
      purchasePricingByVariantId.get(variant.id)?.serverVersion ?? 0,
    salesTaxMode:
      salesPricingByVariantId.get(variant.id)?.taxMode ?? "EXCLUSIVE",
    purchaseTaxMode:
      purchasePricingByVariantId.get(variant.id)?.taxMode ?? "EXCLUSIVE",
  })),
});

export function ItemDetailsPage({
  itemType: forcedItemType,
  title: _title,
  singularLabel,
  routeBasePath,
}: ItemDetailsPageProps) {
  const navigate = useNavigate();
  const { itemId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore(
    (state) => state.isBusinessSelected,
  );
  const { showToast } = useToast();
  const showPurchasePrice = forcedItemType !== "SERVICE";
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<DraftItem | null>(null);
  const [initialItem, setInitialItem] = useState<DraftItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showVariantEditor, setShowVariantEditor] = useState(true);
  const [baseSkuManuallyEdited, setBaseSkuManuallyEdited] = useState(false);
  const [excludedVariantSignatures, setExcludedVariantSignatures] = useState<string[]>([]);
  const [bulkOptions, setBulkOptions] = useState<BulkOptionDraft[]>([
    EMPTY_BULK_OPTION(),
  ]);
  const [savedOptionKeys, setSavedOptionKeys] = useState<string[]>([]);
  const [savedOptionValuesByKey, setSavedOptionValuesByKey] = useState<
    Record<string, string[]>
  >({});
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
  const [reservedSkus, setReservedSkus] = useState<Set<string>>(new Set());
  const orderedUnitGroups = useMemo(
    () => getOrderedUnitGroups(forcedItemType),
    [forcedItemType],
  );
  const taxCodeLabel = forcedItemType === "SERVICE" ? "SAC" : "HSN";
  const taxCodePlaceholder =
    forcedItemType === "SERVICE" ? "SAC (6 digits)" : "HSN (4-8 digits)";
  const reportError = (message: string) => {
    showToast({
      title: "Unable to save",
      description: message,
      tone: "error",
      dedupeKey: `item-details-error:${message}`,
    });
  };

  useEffect(() => {
    if (!activeStore || !itemId) return;
    void Promise.all([
      getLocalItemDetailForDisplay(activeStore, itemId),
      getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "SALES"),
      getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "PURCHASE"),
    ]).then(([detail, salesPricingRows, purchasePricingRows]) => {
      if (!detail) {
        setItem(null);
        setInitialItem(null);
        setIsEditing(false);
        return;
      }
      if (detail.itemType !== forcedItemType) {
        navigate(
          detail.itemType === "PRODUCT"
            ? `/app/products/${itemId}`
            : `/app/services/${itemId}`,
          { replace: true },
        );
        return;
      }
      const salesPricingByVariantId = new Map(
        salesPricingRows
          .filter((row) => row.itemId === detail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                  gstSlab: normalizeGstSlab(row.gstSlab) ?? "",
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const purchasePricingByVariantId = new Map(
        purchasePricingRows
          .filter((row) => row.itemId === detail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const draft = toDraft(detail, salesPricingByVariantId, purchasePricingByVariantId);
      setItem(draft);
      setInitialItem(draft);
      setBaseSkuManuallyEdited(false);
      setExcludedVariantSignatures([]);
      setBulkOptions(buildBulkOptionsFromVariants(draft.variants));
      setIsEditing(false);
      setShowVariantEditor(shouldShowVariantEditorByDefault(draft));
    });
  }, [activeStore, forcedItemType, itemId, navigate]);

  useEffect(() => {
    if (!activeStore) return;
    try {
      window.localStorage.setItem(
        getOptionDiscoveryStorageKey(activeStore),
        JSON.stringify({
          optionKeys: savedOptionKeys,
          optionValuesByKey: savedOptionValuesByKey,
        } satisfies OptionDiscovery),
      );
    } catch {
      // Ignore storage failures and keep in-memory suggestions.
    }
  }, [activeStore, savedOptionKeys, savedOptionValuesByKey]);

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

  useEffect(() => {
    let cancelled = false;

    const loadReservedSkus = async () => {
      if (!activeStore || !itemId) {
        setReservedSkus(new Set());
        return;
      }

      const items = await getLocalItemsForDisplay(activeStore).catch(() => []);
      if (cancelled) return;

      const collected = new Set<string>();
      for (const listedItem of items) {
        if (listedItem.entityId === itemId) continue;
        for (const sku of listedItem.variantSkus) {
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
  }, [activeStore, itemId]);

  useEffect(() => {
    if (!initialItem || excludedVariantSignatures.length > 0) return;
    setBulkOptions(buildBulkOptionsFromVariants(initialItem.variants));
  }, [excludedVariantSignatures.length, initialItem]);

  useEffect(() => {
    if (!item || !showVariantEditor) return;
    if (baseSkuManuallyEdited) return;

    const generatedBaseSku = ensureUniqueSku(
      deriveBaseSkuFromItemName(item.name),
      reservedSkus,
    );
    if (item.baseSku !== generatedBaseSku) {
      setItem((current) =>
        current ? { ...current, baseSku: generatedBaseSku } : current,
      );
    }
  }, [baseSkuManuallyEdited, item, reservedSkus, showVariantEditor]);

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
        getLocalOptionDiscoveryForStore(activeStore).catch(() =>
          emptyOptionDiscovery(),
        ),
        getRemoteOptionDiscoveryForStore(activeStore).catch(() =>
          emptyOptionDiscovery(),
        ),
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

      setSavedOptionKeys(
        sortUnique([
          ...persisted.optionKeys,
          ...localDiscovered.optionKeys,
          ...remoteDiscovered.optionKeys,
          ...Object.keys(mergedValuesByKey),
        ]),
      );
      setSavedOptionValuesByKey(mergedValuesByKey);
    };

    void loadOptionSuggestions();
    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  useEffect(() => {
    if (!item || !showVariantEditor) return;
    if (item.variants.length === 0) return;

    let changed = false;
    const nextVariants = item.variants.map((variant) => {
      if (variant.nameManuallyEdited) return variant;
      const generatedName = buildAutoVariantName(item.name, variant.optionRows);
      if (variant.name === generatedName) return variant;
      changed = true;
      return {
        ...variant,
        name: generatedName,
      };
    });

    if (changed) {
      setItem((current) =>
        current ? { ...current, variants: nextVariants } : current,
      );
    }
  }, [item, showVariantEditor]);

  useEffect(() => {
    if (!item || !showVariantEditor) return;
    if (item.variants.length === 0) return;

    const baseIdentifier = item.baseSku.trim() || "ITEM";
    let changed = false;
    const nextVariants = item.variants.map((variant) => {
      if (variant.skuManuallyEdited) return variant;
      const optionParts = variant.optionRows
        .map((entry) => abbreviateSkuChunk(entry.value))
        .filter((value) => value.length > 0);
      const generatedSku = [baseIdentifier, ...optionParts].join("-") || "ITEM";
      if (variant.sku === generatedSku) return variant;
      changed = true;
      return {
        ...variant,
        sku: generatedSku,
      };
    });

    if (changed) {
      setItem((current) =>
        current ? { ...current, variants: nextVariants } : current,
      );
    }
  }, [item, showVariantEditor]);

  const isDirty = useMemo(
    () =>
      Boolean(
        item &&
        initialItem &&
        JSON.stringify(item) !== JSON.stringify(initialItem),
      ),
    [initialItem, item],
  );

  const categorySuggestions = useMemo(
    () => sortUnique([...savedCategories, item?.category ?? ""]),
    [item?.category, savedCategories],
  );
  const optionKeySuggestions = useMemo(() => {
    const fromVariants =
      item?.variants
        .flatMap((variant) => variant.optionRows)
        .map((row) => row.key.trim())
        .filter(Boolean) ?? [];
    return Array.from(new Set([...savedOptionKeys, ...fromVariants])).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [item?.variants, savedOptionKeys]);
  const bulkOptionKeySuggestions = useMemo(
    () =>
      sortUnique([
        ...optionKeySuggestions,
        ...bulkOptions.map((option) => option.key.trim()).filter(Boolean),
      ]),
    [bulkOptions, optionKeySuggestions],
  );

  const itemActiveState = useMemo(
    () => (item ? isItemActive(item.variants) : true),
    [item],
  );
  const canShowSimpleEditor = useMemo(
    () => (item ? canUseSimpleVariantEditor(item) : false),
    [item],
  );
  const primaryVariant = item?.variants[0] ?? null;

  const commitBulkOptionValue = (optionId: string, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;
    setBulkOptions((current) =>
      current.map((entry) =>
        entry.id === optionId
          ? {
              ...entry,
              values: sortUnique([...entry.values, value]),
              valueDraft: "",
            }
          : entry,
      ),
    );
  };

  const removeLastBulkOptionValue = (optionId: string) => {
    setBulkOptions((current) =>
      current.map((entry) =>
        entry.id === optionId
          ? {
              ...entry,
              values: entry.values.slice(
                0,
                Math.max(0, entry.values.length - 1),
              ),
            }
          : entry,
      ),
    );
  };

  const confirmOptionValueRemoval = (optionKey: string, optionValue: string) => {
    if (!item) return true;

    const affectedVariants = item.variants.filter((variant) =>
      variant.optionRows.some(
        (entry) =>
          normalizeOptionKey(entry.key) === normalizeOptionKey(optionKey) &&
          entry.value.trim().toLowerCase() === optionValue.trim().toLowerCase(),
      ),
    );
    if (affectedVariants.length === 0) {
      return true;
    }

    const messageLines = [
      `Delete "${optionValue}"?`,
      `You are about to delete the "${optionValue}" option value from "${optionKey}".`,
      "Variants with existing usage will be archived to preserve history. Variants with no usage will be permanently deleted if the server confirms they are unused.",
      "Final archive and purge results will be confirmed after sync completes.",
    ];

    return window.confirm(messageLines.join("\n\n"));
  };

  const confirmOptionKeyRemoval = (optionKey: string) => {
    if (!item) return true;

    const affectedVariants = item.variants.filter((variant) =>
      variant.optionRows.some(
        (entry) => normalizeOptionKey(entry.key) === normalizeOptionKey(optionKey),
      ),
    );
    if (affectedVariants.length === 0) {
      return true;
    }

    const messageLines = [
      `Delete option "${optionKey}"?`,
      `You are about to delete the "${optionKey}" option and all variants that depend on it.`,
      "Variants with existing usage will be archived to preserve history. Variants with no usage will be permanently deleted if the server confirms they are unused.",
      "Final archive and purge results will be confirmed after sync completes.",
    ];

    return window.confirm(messageLines.join("\n\n"));
  };

  const applyBulkOptionsToVariants = (options?: { resetExcluded?: boolean }) => {
    if (!item) return;

    const normalizedOptions = bulkOptions
      .map((option) => ({
        key: option.key.trim(),
        values: sortUnique([
          ...option.values,
          ...(option.valueDraft.trim().length > 0 ? [option.valueDraft] : []),
        ]),
      }))
      .filter((option) => option.key.length > 0 && option.values.length > 0);

    if (normalizedOptions.length === 0) {
      reportError("Add at least one option key with values before applying.");
      return;
    }

    const combinations = buildOptionCombinations(normalizedOptions);
    if (combinations.length === 0) {
      reportError("No option combinations generated.");
      return;
    }

    const possibleSignatures = combinations.map((combination) =>
      buildVariantOptionSignature(combination),
    );
    const nextExcludedSignatures = (options?.resetExcluded ? [] : excludedVariantSignatures).filter(
      (signature) => possibleSignatures.includes(signature),
    );
    const excludedSignatureSet = new Set(nextExcludedSignatures);
    const existingBySignature = new Map(
      item.variants.map((variant) => [
        buildVariantOptionSignature(variant.optionRows),
        variant,
      ]),
    );
    const reusableSimpleVariant =
      item.variants.length === 1 &&
      !item.variants[0].id.startsWith("temp-") &&
      item.variants[0].optionRows.length === 0 &&
      (item.variants[0].usageCount ?? 0) === 0 &&
      !item.variants[0].isLocked
        ? item.variants[0]
        : null;
    let reusableSimpleVariantConsumed = false;

    const nextVariants = combinations.flatMap((combination) => {
      const signature = buildVariantOptionSignature(combination);
      if (excludedSignatureSet.has(signature)) {
        return [];
      }
      const existing = existingBySignature.get(signature);
      const optionRows = combination.map((entry) => ({
        id: crypto.randomUUID(),
        key: entry.key,
        value: entry.value,
      }));
      const variantToReuse =
        existing ??
        (!reusableSimpleVariantConsumed && reusableSimpleVariant
          ? reusableSimpleVariant
          : null);
      if (variantToReuse) {
        if (variantToReuse.id === reusableSimpleVariant?.id) {
          reusableSimpleVariantConsumed = true;
        }
        return [{
          ...variantToReuse,
          optionRows,
        }];
      }
      return [{
        id: `temp-${crypto.randomUUID()}`,
        name: buildAutoVariantName(item.name, optionRows),
        nameManuallyEdited: false,
        sku: "",
        skuManuallyEdited: false,
        barcode: "",
        salesPrice: "",
        purchasePrice: "",
        gstSlab: "",
        isActive: itemActiveState,
        optionRows,
        usageCount: 0,
        isLocked: false,
        salesPriceAmount: null,
        purchasePriceAmount: null,
        salesCurrency: "INR",
        purchaseCurrency: "INR",
        salesServerVersion: 0,
        purchaseServerVersion: 0,
        salesTaxMode: "EXCLUSIVE" as const,
        purchaseTaxMode: "EXCLUSIVE" as const,
      } satisfies DraftVariant];
    });

    setExcludedVariantSignatures(nextExcludedSignatures);
    setItem({
      ...item,
      variants: nextVariants,
    });
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
      sortUnique([
        ...current,
        ...normalizedOptions.map((option) => option.key),
      ]),
    );
    setSavedOptionValuesByKey((current) => {
      const next = { ...current };
      for (const option of normalizedOptions) {
        const existingValues =
          Object.entries(next)
            .filter(
              ([key]) =>
                normalizeOptionKey(key) === normalizeOptionKey(option.key),
            )
            .flatMap(([, values]) => values) ?? [];
        next[option.key] = sortUnique([...existingValues, ...option.values]);
      }
      return next;
    });
  };

  const resetGeneratedVariants = () => {
    applyBulkOptionsToVariants({ resetExcluded: true });
  };

  const handleVariantTableChange = (nextVariants: DraftVariant[]) => {
    setItem((current) => {
      if (!current) {
        return current;
      }

      const nextVariantIds = new Set(nextVariants.map((variant) => variant.id));
      const removedSignatures = collectGeneratedVariantSignatures(
        current.variants.filter((variant) => !nextVariantIds.has(variant.id)),
      );
      if (removedSignatures.length > 0) {
        setExcludedVariantSignatures((currentExcluded) =>
          sortUnique([...currentExcluded, ...removedSignatures]),
        );
      }

      return {
        ...current,
        variants: nextVariants,
      };
    });
  };

  const onSave = async () => {
    if (
      !item ||
      !initialItem ||
      !identityId ||
      !activeStore ||
      !isBusinessSelected
    )
      return;
    if (!isEditing) return;
    if (item.variants.length === 0) return;
    const nextItem = item;

    setLoading(true);
    try {
      const shouldUpdateItemRecord =
        nextItem.name !== initialItem.name ||
        nextItem.hsnSac !== initialItem.hsnSac ||
        nextItem.category !== initialItem.category ||
        nextItem.unit !== initialItem.unit;

      if (shouldUpdateItemRecord) {
        await queueItemUpdate(activeStore, identityId, nextItem.id, {
          name: nextItem.name,
          hsnSac: nextItem.hsnSac.trim() || null,
          category: nextItem.category.trim() || null,
          unit: nextItem.unit,
          metadata: nextItem.baseSku.trim()
            ? {
                custom: {
                  base_sku: nextItem.baseSku.trim(),
                },
              }
            : null,
        });
      }

      const initialVariantsById = new Map(
        initialItem.variants.map((variant) => [variant.id, variant]),
      );
      for (let index = 0; index < nextItem.variants.length; index += 1) {
        const variant = nextItem.variants[index];
        const initialVariant = initialVariantsById.get(variant.id);
        const salesPriceChanged =
          parsePriceDraft(variant.salesPrice ?? "").amount !==
          parsePriceDraft(initialVariant?.salesPrice ?? "").amount;
        const purchasePriceChanged =
          parsePriceDraft(variant.purchasePrice ?? "").amount !==
          parsePriceDraft(initialVariant?.purchasePrice ?? "").amount;
        const gstSlabChanged =
          (normalizeGstSlab(variant.gstSlab) ?? "") !==
          (normalizeGstSlab(initialVariant?.gstSlab) ?? "");
        const salesTaxModeChanged =
          variant.salesTaxMode !== initialVariant?.salesTaxMode;
        const purchaseTaxModeChanged =
          variant.purchaseTaxMode !== initialVariant?.purchaseTaxMode;
        const isChangedOrNew =
          variant.id.startsWith("temp-") ||
          salesPriceChanged ||
          purchasePriceChanged ||
          gstSlabChanged ||
          salesTaxModeChanged ||
          purchaseTaxModeChanged ||
          (initialVariant &&
            JSON.stringify(normalizeVariantForUpdate(variant)) !==
              JSON.stringify(normalizeVariantForUpdate(initialVariant)));

        const mustValidate = isChangedOrNew;
        if (!mustValidate) continue;

        if (!hasAtLeastOneVariantDetail(variant)) {
          reportError(
            `Variant ${index + 1} is empty. Enter at least one of name, SKU, barcode, or option key/value.`,
          );
          return;
        }

        if (hasIncompleteOptionRows(variant)) {
          reportError(
            `Variant ${index + 1} has incomplete option rows. Fill both key and value or remove the row.`,
          );
          return;
        }

        const salesPrice = parsePriceDraft(variant.salesPrice ?? "");
        if (salesPrice.error) {
          reportError(`Variant ${index + 1}: Sales price must be a non-negative number.`);
          return;
        }
        const purchasePrice = showPurchasePrice
          ? parsePriceDraft(variant.purchasePrice ?? "")
          : { amount: undefined, error: null };
        if (showPurchasePrice && purchasePrice.error) {
          reportError(`Variant ${index + 1}: Purchase price must be a non-negative number.`);
          return;
        }
      }

      const currentVariantIds = new Set(
        nextItem.variants
          .filter((variant) => !variant.id.startsWith("temp-"))
          .map((variant) => variant.id),
      );

      const preflightError = await runLocalItemPreflightChecks(activeStore, [
        {
          itemId: nextItem.id,
          name: nextItem.name,
          variants: nextItem.variants.map((variant) => ({
            id: variant.id.startsWith("temp-") ? undefined : variant.id,
            sku: variant.sku,
            isActive: variant.isActive,
          })),
        },
      ]);
      if (preflightError) {
        reportError(preflightError);
        return;
      }

      const [latestSalesPricingRows, latestPurchasePricingRows] = await Promise.all([
        getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "SALES"),
        getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "PURCHASE"),
      ]);
      const latestSalesVersionByVariantId = new Map(
        latestSalesPricingRows.map((row) => [row.variantId, row.serverVersion] as const),
      );
      const latestPurchaseVersionByVariantId = new Map(
        latestPurchasePricingRows.map((row) => [row.variantId, row.serverVersion] as const),
      );

      for (const variant of nextItem.variants) {
        if (variant.id.startsWith("temp-")) {
          const payload = normalizeVariantForCreate(variant);
          const createdVariantId = await queueItemVariantCreate(
            activeStore,
            identityId,
            nextItem.id,
            payload,
          );
          const salesPrice = parsePriceDraft(variant.salesPrice ?? "").amount;
          const purchasePrice = showPurchasePrice
            ? parsePriceDraft(variant.purchasePrice ?? "").amount
            : undefined;
          if (
            typeof salesPrice === "number" ||
            normalizeGstSlab(variant.gstSlab) ||
            variant.salesTaxMode !== "EXCLUSIVE"
          ) {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              createdVariantId,
              salesPrice ?? null,
              variant.salesCurrency,
              0,
              "SALES",
              variant.salesTaxMode,
              normalizeGstSlab(variant.gstSlab),
            );
          }
          if (
            showPurchasePrice &&
            (typeof purchasePrice === "number" || variant.purchaseTaxMode !== "EXCLUSIVE")
          ) {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              createdVariantId,
              purchasePrice ?? null,
              variant.purchaseCurrency,
              0,
              "PURCHASE",
              variant.purchaseTaxMode,
            );
          }
          continue;
        }

        const initialVariant = initialVariantsById.get(variant.id);
        if (!initialVariant) continue;

        const payload = normalizeVariantForUpdate(variant);
        if (
          JSON.stringify(payload) !==
          JSON.stringify(normalizeVariantForUpdate(initialVariant))
        ) {
          await queueItemVariantUpdate(
            activeStore,
            identityId,
            variant.id,
            payload,
          );
        }

        const nextGstSlab = normalizeGstSlab(variant.gstSlab) ?? "";
        const initialGstSlab = normalizeGstSlab(initialVariant.gstSlab) ?? "";
        const nextSalesPrice = parsePriceDraft(variant.salesPrice ?? "").amount ?? null;
        const initialSalesPrice = parsePriceDraft(initialVariant.salesPrice ?? "").amount ?? null;
        if (
          nextGstSlab !== initialGstSlab ||
          nextSalesPrice !== initialSalesPrice ||
          variant.salesTaxMode !== initialVariant.salesTaxMode
        ) {
          await queueItemPriceUpsert(
            activeStore,
            identityId,
            variant.id,
            nextSalesPrice,
            variant.salesCurrency,
            latestSalesVersionByVariantId.get(variant.id) ?? variant.salesServerVersion,
            "SALES",
            variant.salesTaxMode,
            nextGstSlab || null,
          );
        }
        if (showPurchasePrice) {
          const nextPurchasePrice = parsePriceDraft(variant.purchasePrice ?? "").amount ?? null;
          const initialPurchasePrice =
            parsePriceDraft(initialVariant.purchasePrice ?? "").amount ?? null;
          if (
            nextPurchasePrice !== initialPurchasePrice ||
            variant.purchaseTaxMode !== initialVariant.purchaseTaxMode
          ) {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              variant.id,
              nextPurchasePrice,
              variant.purchaseCurrency,
              latestPurchaseVersionByVariantId.get(variant.id) ?? variant.purchaseServerVersion,
              "PURCHASE",
              variant.purchaseTaxMode,
            );
          }
        }
      }

      for (const initialVariant of initialItem.variants) {
        if (initialVariant.id.startsWith("temp-")) continue;
        if (!currentVariantIds.has(initialVariant.id)) {
          if ((initialVariant.usageCount ?? 0) > 0 || initialVariant.isLocked) {
            await queueItemVariantDelete(
              activeStore,
              identityId,
              initialVariant.id,
            );
          } else {
            await queueItemVariantPurge(
              activeStore,
              identityId,
              initialVariant.id,
            );
          }
        }
      }

      await syncOnce(activeStore);
      const [refreshedDetail, refreshedSalesPricingRows, refreshedPurchasePricingRows] = await Promise.all([
        getLocalItemDetailForDisplay(activeStore, nextItem.id),
        getLocalItemPricingRowsForDisplay(
          activeStore,
          undefined,
          true,
          "SALES",
        ),
        getLocalItemPricingRowsForDisplay(
          activeStore,
          undefined,
          true,
          "PURCHASE",
        ),
      ]);
      if (!refreshedDetail) {
        navigate(routeBasePath, { replace: true });
        return;
      }
      const refreshedSalesPricingByVariantId = new Map(
        refreshedSalesPricingRows
          .filter((row) => row.itemId === nextItem.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                  gstSlab: normalizeGstSlab(row.gstSlab) ?? "",
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const refreshedPurchasePricingByVariantId = new Map(
        refreshedPurchasePricingRows
          .filter((row) => row.itemId === nextItem.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const refreshedDraft = toDraft(
        refreshedDetail,
        refreshedSalesPricingByVariantId,
        refreshedPurchasePricingByVariantId,
      );
      setItem(refreshedDraft);
      setInitialItem(refreshedDraft);
      setExcludedVariantSignatures([]);
      setIsEditing(false);
      setShowVariantEditor(shouldShowVariantEditorByDefault(refreshedDraft));
    } catch (error) {
      console.error(error);
      reportError(toUserItemErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(routeBasePath);
  };

  const onDeleteItem = async () => {
    if (!item || !activeStore || !identityId || !isBusinessSelected || loading) return;
    const confirmed = window.confirm(
      `Delete '${item.name}'? If the server finds no usage history it will be permanently deleted. Otherwise keep using archive to preserve history.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await queueItemPurge(activeStore, identityId, item.id);
      await syncOnce(activeStore);
      navigate(routeBasePath, {
        replace: true,
      });
    } catch (error) {
      console.error(error);
      reportError(toUserItemErrorMessage(error));
      setLoading(false);
    }
  };

  const onDeleteVariant = async (variantId: string) => {
    if (!item || !activeStore || !identityId || !isBusinessSelected || loading) return;
    const targetVariant = item.variants.find((variant) => variant.id === variantId);
    if (!targetVariant || targetVariant.id.startsWith("temp-")) return;
    const removedSignature = buildVariantOptionSignature(targetVariant.optionRows);
    const confirmed = window.confirm(
      `Delete variant '${targetVariant.name || targetVariant.sku || "Untitled Variant"}'? If the server finds no usage history it will be permanently deleted. Otherwise archive it to preserve history. Unsaved edits on this screen will be discarded.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await queueItemVariantPurge(activeStore, identityId, variantId);
      await syncOnce(activeStore);
      const [refreshedDetail, refreshedSalesPricingRows, refreshedPurchasePricingRows] =
        await Promise.all([
          getLocalItemDetailForDisplay(activeStore, item.id),
          getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "SALES"),
          getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "PURCHASE"),
        ]);
      if (!refreshedDetail) {
        navigate(routeBasePath, { replace: true });
        return;
      }
      const refreshedSalesPricingByVariantId = new Map(
        refreshedSalesPricingRows
          .filter((row) => row.itemId === refreshedDetail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                  gstSlab: normalizeGstSlab(row.gstSlab) ?? "",
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const refreshedPurchasePricingByVariantId = new Map(
        refreshedPurchasePricingRows
          .filter((row) => row.itemId === refreshedDetail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const refreshedDraft = toDraft(
        refreshedDetail,
        refreshedSalesPricingByVariantId,
        refreshedPurchasePricingByVariantId,
      );
      setItem(refreshedDraft);
      setInitialItem(refreshedDraft);
      if (removedSignature) {
        setExcludedVariantSignatures((current) =>
          sortUnique([...current, removedSignature]),
        );
      }
      setBaseSkuManuallyEdited(false);
      setIsEditing(false);
      setShowVariantEditor(shouldShowVariantEditorByDefault(refreshedDraft));
    } catch (error) {
      console.error(error);
      reportError(toUserItemErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onDeleteVariants = async (variantIds: string[]) => {
    if (!item || !activeStore || !identityId || !isBusinessSelected || loading) return;

    const persistedVariantIds = variantIds.filter((variantId) => !variantId.startsWith("temp-"));
    const tempVariantIds = variantIds.filter((variantId) => variantId.startsWith("temp-"));
    const removedSignatures = collectGeneratedVariantSignatures(
      item.variants.filter((variant) => variantIds.includes(variant.id)),
    );

    if (persistedVariantIds.length === 0) {
      if (tempVariantIds.length === 0) return;
      setItem({
        ...item,
        variants: item.variants.filter((variant) => !tempVariantIds.includes(variant.id)),
      });
      if (removedSignatures.length > 0) {
        setExcludedVariantSignatures((current) =>
          sortUnique([...current, ...removedSignatures]),
        );
      }
      return;
    }

    const confirmed = window.confirm(
      `Delete ${persistedVariantIds.length} selected variant${persistedVariantIds.length === 1 ? "" : "s"}? If the server finds no usage history they will be permanently deleted. Otherwise they will be archived to preserve history. Unsaved edits on this screen will be discarded.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await Promise.all(
        persistedVariantIds.map((variantId) =>
          queueItemVariantPurge(activeStore, identityId, variantId),
        ),
      );
      await syncOnce(activeStore);
      const [refreshedDetail, refreshedSalesPricingRows, refreshedPurchasePricingRows] =
        await Promise.all([
          getLocalItemDetailForDisplay(activeStore, item.id),
          getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "SALES"),
          getLocalItemPricingRowsForDisplay(activeStore, undefined, true, "PURCHASE"),
        ]);
      if (!refreshedDetail) {
        navigate(routeBasePath, { replace: true });
        return;
      }
      const refreshedSalesPricingByVariantId = new Map(
        refreshedSalesPricingRows
          .filter((row) => row.itemId === refreshedDetail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                  gstSlab: normalizeGstSlab(row.gstSlab) ?? "",
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const refreshedPurchasePricingByVariantId = new Map(
        refreshedPurchasePricingRows
          .filter((row) => row.itemId === refreshedDetail.id)
          .map(
            (row) =>
              [
                row.variantId,
                {
                  amount: row.amount,
                  currency: row.currency,
                  serverVersion: row.serverVersion,
                  taxMode: row.taxMode,
                } satisfies PricingSnapshot,
              ] as const,
          ),
      );
      const nextDraft = toDraft(
        refreshedDetail,
        refreshedSalesPricingByVariantId,
        refreshedPurchasePricingByVariantId,
      );
      setItem(nextDraft);
      setInitialItem(nextDraft);
      if (removedSignatures.length > 0) {
        setExcludedVariantSignatures((current) =>
          sortUnique([...current, ...removedSignatures]),
        );
      }
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      reportError(toUserItemErrorMessage(error));
    } finally {
      setLoading(false);
    }
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
              <CardTitle className="text-base">
                Manage {singularLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                Edit {singularLabel.toLowerCase()} details and variants.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/75 px-2 py-1">
                <Label
                  htmlFor="item-active-status"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  {itemActiveState ? "Active" : "Inactive"}
                </Label>
                <Switch
                  id="item-active-status"
                  aria-label="Toggle item active state"
                  checked={itemActiveState}
                  onCheckedChange={() => {
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
                  className="h-6 w-11"
                  checkedTrackClassName="bg-[#4a8dd9]"
                  uncheckedTrackClassName="bg-[#e7eff8]"
                />
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
                    setExcludedVariantSignatures([]);
                    setBulkOptions(
                      buildBulkOptionsFromVariants(initialItem.variants),
                    );
                    setBaseSkuManuallyEdited(false);
                    setIsEditing(false);
                    setShowVariantEditor(
                      shouldShowVariantEditorByDefault(initialItem),
                    );
                  }}
                />
              ) : (
                <PageActionBar
                  primaryLabel="Edit Details"
                  onPrimaryClick={() => {
                    setIsEditing(true);
                    setShowVariantEditor(
                      shouldShowVariantEditorByDefault(item),
                    );
                  }}
                  primaryDisabled={loading}
                  secondaryLabel="Back"
                  onSecondaryClick={onBack}
                  trailingDesktopContent={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hidden h-7 border-destructive/35 px-2 text-destructive hover:bg-destructive/12 hover:text-destructive lg:inline-flex"
                      onClick={() => void onDeleteItem()}
                      disabled={loading}
                      aria-label={`Delete ${singularLabel.toLowerCase()}`}
                      title={`Delete ${singularLabel.toLowerCase()}`}
                    >
                      <span>Delete</span>
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-1.5 pb-20 sm:pb-24 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:pb-0">
          <div className="rounded-lg border border-border/80 bg-white p-1.5 lg:shrink-0">
            <div className="grid gap-1.5">
              <div className="app-mobile-variant-inline-control shrink-0 font-medium text-foreground lg:min-h-0 lg:gap-1.5 lg:text-[10px]">
                <Switch
                  id="edit-variant-mode"
                  checked={showVariantEditor}
                  aria-label="Variant mode"
                  onCheckedChange={(checked) => {
                    if (!isEditing || loading) return;
                    if (!checked && !canShowSimpleEditor) return;
                    setShowVariantEditor(checked);
                  }}
                  disabled={
                    !isEditing ||
                    loading ||
                    (!showVariantEditor && !canShowSimpleEditor)
                  }
                  className="h-7 w-12 border lg:h-6 lg:w-11"
                  checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                  uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                />
                <Label htmlFor="edit-variant-mode">
                  Variant mode{" "}
                  {canShowSimpleEditor ? "(advanced)" : "(required)"}
                </Label>
              </div>
              {showVariantEditor ? (
                <div className="grid gap-1.5 lg:min-w-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,2fr)_120px]">
                  <div className="grid gap-1">
                    <Label>Name</Label>
                    <Input
                      className={DENSE_INPUT_CLASS}
                      value={item.name}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({ ...item, name: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Base SKU</Label>
                    <Input
                      className={DENSE_INPUT_CLASS}
                      value={item.baseSku}
                      disabled={!isEditing || loading}
                      onChange={(event) => {
                        const nextBaseSku = event.target.value;
                        setItem({
                          ...item,
                          baseSku: nextBaseSku,
                        });
                        setBaseSkuManuallyEdited(
                          nextBaseSku.trim().length > 0 &&
                            nextBaseSku.trim().toUpperCase() !==
                              ensureUniqueSku(
                                deriveBaseSkuFromItemName(item.name),
                                reservedSkus,
                              ),
                        );
                      }}
                      placeholder="Auto-generated from item name"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Category</Label>
                    <LookupDropdownInput
                      value={item.category}
                      disabled={!isEditing || loading}
                      onValueChange={(value) => setItem({ ...item, category: value })}
                      placeholder="Category"
                      options={categorySuggestions}
                      getOptionKey={(categoryValue) => categoryValue}
                      getOptionSearchText={(categoryValue) => categoryValue}
                      onOptionSelect={(categoryValue) =>
                        setItem({ ...item, category: categoryValue })
                      }
                      renderOption={(categoryValue) => (
                        <div className="truncate font-medium">{categoryValue}</div>
                      )}
                      maxVisibleOptions={10}
                      inputClassName={DENSE_INPUT_CLASS}
                      optionClassName="text-[10px]"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Unit</Label>
                    <Select
                      className={`${DENSE_SELECT_CLASS} w-full`}
                      value={item.unit}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          unit: event.target.value as UnitOption,
                        })
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
                </div>
              ) : primaryVariant ? (
                <div className="grid gap-1.5 lg:min-w-0 lg:flex-1">
                  <div
                    className={`hidden items-center gap-1 px-1 font-semibold uppercase tracking-[0.03em] text-muted-foreground/90 lg:grid ${
                      showPurchasePrice
                        ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1fr)_84px_minmax(0,1fr)_84px_minmax(0,1fr)_92px_minmax(0,1.6fr)]"
                        : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1fr)_84px_minmax(0,1fr)_92px_minmax(0,1.6fr)]"
                    }`}
                    style={{ fontSize: "10px", lineHeight: "12px" }}
                  >
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>Name</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>SKU</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>{taxCodeLabel}</span>
                    {showPurchasePrice ? (
                      <span style={{ fontSize: "10px", lineHeight: "12px" }}>Purchase</span>
                    ) : null}
                    {showPurchasePrice ? (
                      <span style={{ fontSize: "10px", lineHeight: "12px" }}>Purchase tax</span>
                    ) : null}
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>Sales</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>Sales tax</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>GST %</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>Unit</span>
                    <span style={{ fontSize: "10px", lineHeight: "12px" }}>Category</span>
                  </div>
                  <div
                    className={`grid gap-1.5 rounded-lg border border-border/70 bg-white p-1.5 lg:items-center lg:border-0 lg:bg-transparent lg:p-0 ${
                      showPurchasePrice
                        ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1fr)_84px_minmax(0,1fr)_84px_minmax(0,1fr)_92px_minmax(0,1.6fr)]"
                        : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1fr)_84px_minmax(0,1fr)_92px_minmax(0,1.6fr)]"
                    }`}
                  >
                    <Input
                      className={SIMPLE_ROW_INPUT_CLASS}
                      value={item.name}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({ ...item, name: event.target.value })
                      }
                      placeholder={`${singularLabel} name`}
                    />
                    <Input
                      className={SIMPLE_ROW_INPUT_CLASS}
                      value={primaryVariant.sku}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((variant, index) =>
                            index === 0
                              ? {
                                  ...variant,
                                  sku: event.target.value,
                                  skuManuallyEdited: true,
                                }
                              : variant,
                          ),
                        })
                      }
                      placeholder="SKU (optional)"
                    />
                    <Input
                      className={SIMPLE_ROW_INPUT_CLASS}
                      value={item.hsnSac}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({ ...item, hsnSac: event.target.value })
                      }
                      placeholder={taxCodePlaceholder}
                    />
                    {showPurchasePrice ? (
                      <Input
                        className={SIMPLE_ROW_INPUT_CLASS}
                        value={primaryVariant.purchasePrice ?? ""}
                        disabled={!isEditing || loading}
                        onChange={(event) =>
                          setItem({
                            ...item,
                            variants: item.variants.map((variant, index) =>
                              index === 0
                                ? { ...variant, purchasePrice: event.target.value }
                                : variant,
                            ),
                          })
                        }
                        placeholder="Purchase price"
                        inputMode="decimal"
                      />
                    ) : null}
                    {showPurchasePrice ? (
                      <Select
                        className={`${SIMPLE_ROW_INPUT_CLASS} w-full`}
                        value={primaryVariant.purchaseTaxMode}
                        disabled={!isEditing || loading}
                        onChange={(event) =>
                          setItem({
                            ...item,
                            variants: item.variants.map((variant, index) =>
                              index === 0
                                ? {
                                    ...variant,
                                    purchaseTaxMode:
                                      event.target.value === "INCLUSIVE"
                                        ? "INCLUSIVE"
                                        : "EXCLUSIVE",
                                  }
                                : variant,
                            ),
                          })
                        }
                      >
                        <option value="EXCLUSIVE">Excl.</option>
                        <option value="INCLUSIVE">Incl.</option>
                      </Select>
                    ) : null}
                    <Input
                      className={SIMPLE_ROW_INPUT_CLASS}
                      value={primaryVariant.salesPrice ?? ""}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((variant, index) =>
                            index === 0
                              ? { ...variant, salesPrice: event.target.value }
                              : variant,
                          ),
                        })
                      }
                      placeholder="Sales price"
                      inputMode="decimal"
                    />
                    <Select
                      className={`${SIMPLE_ROW_INPUT_CLASS} w-full`}
                      value={primaryVariant.salesTaxMode}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((variant, index) =>
                            index === 0
                              ? {
                                  ...variant,
                                  salesTaxMode:
                                    event.target.value === "INCLUSIVE"
                                      ? "INCLUSIVE"
                                      : "EXCLUSIVE",
                                }
                              : variant,
                          ),
                        })
                      }
                    >
                      <option value="EXCLUSIVE">Excl.</option>
                      <option value="INCLUSIVE">Incl.</option>
                    </Select>
                    <GstSlabSelect
                      className={`${SIMPLE_ROW_INPUT_CLASS} w-full`}
                      value={primaryVariant.gstSlab ?? ""}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          variants: item.variants.map((variant, index) =>
                            index === 0
                              ? { ...variant, gstSlab: event.target.value }
                              : variant,
                          ),
                        })
                      }
                      placeholderOption="GST %"
                    />
                    <Select
                      className={`${SIMPLE_ROW_INPUT_CLASS} w-full`}
                      value={item.unit}
                      disabled={!isEditing || loading}
                      onChange={(event) =>
                        setItem({
                          ...item,
                          unit: event.target.value as UnitOption,
                        })
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
                      value={item.category}
                      disabled={!isEditing || loading}
                      onValueChange={(value) => setItem({ ...item, category: value })}
                      placeholder="Category"
                      options={categorySuggestions}
                      getOptionKey={(categoryValue) => categoryValue}
                      getOptionSearchText={(categoryValue) => categoryValue}
                      onOptionSelect={(categoryValue) =>
                        setItem({ ...item, category: categoryValue })
                      }
                      renderOption={(categoryValue) => (
                        <div className="truncate font-medium">{categoryValue}</div>
                      )}
                      maxVisibleOptions={10}
                      inputClassName={SIMPLE_ROW_INPUT_CLASS}
                      optionClassName="text-[10px]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {showVariantEditor ? (
            <div className="mt-1 grid gap-1.5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
              <div className="grid gap-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1">
                <div className="rounded-lg border border-border/80 bg-white p-1.5 lg:shrink-0">
                  <p className="app-shell-action-title lg:text-[10px]">
                    Options
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    <div className="space-y-1 lg:rounded-md lg:border lg:border-border/70 lg:bg-slate-50/50 lg:p-1.5">
                      <div className="hidden items-center gap-1.5 px-1 text-[10px] font-semibold text-muted-foreground lg:grid lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                        <span>Option Name</span>
                        <span>Values</span>
                        <span className="sr-only">Actions</span>
                      </div>
                      {bulkOptions.map((option) => (
                        <div
                          key={option.id}
                          className="grid gap-1.5 rounded-md border border-border/70 bg-slate-50/60 p-1.5 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
                        >
                          <div className="grid gap-1">
                            <LookupDropdownInput
                              value={option.key}
                              disabled={!isEditing || loading}
                              onValueChange={(value) =>
                                setBulkOptions((current) =>
                                  current.map((entry) =>
                                    entry.id === option.id
                                      ? { ...entry, key: value }
                                      : entry,
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
                                    entry.id === option.id
                                      ? { ...entry, key: value }
                                      : entry,
                                  ),
                                )
                              }
                              renderOption={(value) => (
                                <div className="truncate font-medium">
                                  {value}
                                </div>
                              )}
                              inputClassName={BULK_OPTION_INPUT_CLASS}
                              optionClassName="text-[10px]"
                            />
                          </div>
                          <div className="grid gap-1">
                            <TokenizerInput
                              values={option.values}
                              draftValue={option.valueDraft}
                              onDraftChange={(value) =>
                                setBulkOptions((current) =>
                                  current.map((entry) =>
                                    entry.id === option.id
                                      ? { ...entry, valueDraft: value }
                                      : entry,
                                  ),
                                )
                              }
                              onCommitValue={(value) =>
                                commitBulkOptionValue(option.id, value)
                              }
                              onRemoveValue={(value) =>
                                confirmOptionValueRemoval(option.key, value)
                                  ? setBulkOptions((current) =>
                                      current.map((entry) =>
                                        entry.id === option.id
                                          ? {
                                              ...entry,
                                              values: entry.values.filter(
                                                (entryValue) =>
                                                  entryValue !== value,
                                              ),
                                            }
                                          : entry,
                                      ),
                                    )
                                  : undefined
                              }
                              onRemoveLastValue={() =>
                                option.values.length > 0 &&
                                confirmOptionValueRemoval(
                                  option.key,
                                  option.values[option.values.length - 1],
                                )
                                  ? removeLastBulkOptionValue(option.id)
                                  : undefined
                              }
                              placeholder="Type and press Enter"
                              mobilePlaceholder="Add value"
                              inputAriaLabel="Option values"
                              disabled={!isEditing || loading}
                            />
                          </div>
                          <div className="app-mobile-action-stack lg:items-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="app-mobile-action-button w-full lg:hidden"
                              disabled={
                                !isEditing ||
                                loading ||
                                option.valueDraft.trim().length === 0
                              }
                              onClick={() =>
                                commitBulkOptionValue(
                                  option.id,
                                  option.valueDraft,
                                )
                              }
                            >
                              Add value
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="app-mobile-action-button w-full lg:hidden"
                              disabled={
                                !isEditing || loading || bulkOptions.length <= 1
                              }
                              onClick={() =>
                                confirmOptionKeyRemoval(option.key)
                                  ? setBulkOptions((current) =>
                                      current.filter(
                                        (entry) => entry.id !== option.id,
                                      ),
                                    )
                                  : undefined
                              }
                            >
                              Remove option
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="hidden h-7 px-2 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f] lg:inline-flex"
                              disabled={
                                !isEditing || loading || bulkOptions.length <= 1
                              }
                              onClick={() =>
                                confirmOptionKeyRemoval(option.key)
                                  ? setBulkOptions((current) =>
                                      current.filter(
                                        (entry) => entry.id !== option.id,
                                      ),
                                    )
                                  : undefined
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-1.5 min-[420px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="app-mobile-action-button w-full lg:w-auto"
                        disabled={
                          !isEditing ||
                          loading ||
                          bulkOptions.length >= MAX_BULK_OPTION_KEYS
                        }
                        onClick={() =>
                          setBulkOptions((current) => [
                            ...current,
                            EMPTY_BULK_OPTION(),
                          ])
                        }
                      >
                        + Add another option
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="app-mobile-action-button w-full lg:w-auto"
                        disabled={!isEditing || loading}
                        onClick={() => applyBulkOptionsToVariants()}
                      >
                        Apply Options
                      </Button>
                    </div>
                  </div>
                </div>

                <ItemVariantCardsEditor
                  variants={item.variants}
                  onVariantsChange={(next) =>
                    handleVariantTableChange(next as DraftVariant[])
                  }
                  onVariantNameChange={(variantId, variantName) =>
                    setItem({
                      ...item,
                      variants: item.variants.map((variant) =>
                        variant.id === variantId
                          ? {
                              ...variant,
                              name: variantName,
                              nameManuallyEdited: variantName.trim().length > 0,
                            }
                          : variant,
                      ),
                    })
                  }
                  onVariantSkuChange={(variantId, sku) =>
                    setItem({
                      ...item,
                      variants: item.variants.map((variant) =>
                        variant.id === variantId
                          ? {
                              ...variant,
                              sku,
                              skuManuallyEdited: true,
                            }
                          : variant,
                      ),
                    })
                  }
                  onAddVariant={() => undefined}
                  appendMode="restricted"
                  generatedVariantMode
                  onResetGeneratedVariants={resetGeneratedVariants}
                  onVariantPurge={(variantId) => {
                    void onDeleteVariant(variantId);
                  }}
                  onBulkVariantPurge={(variantIds) => {
                    void onDeleteVariants(variantIds);
                  }}
                  showAddVariantAction={false}
                  denseInputClassName={DENSE_INPUT_CLASS}
                  showActiveToggle
                  showPricingFields
                  showPurchasePrice={showPurchasePrice}
                  disabled={!isEditing || loading}
                />
              </div>
            </div>
          ) : null}

        </CardContent>
      </Card>
    </main>
  );
}
