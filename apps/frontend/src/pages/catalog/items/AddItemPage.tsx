import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
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
import { GstSlabSelect } from "../../../design-system/molecules/GstSlabSelect";
import { LookupDropdownInput } from "../../../design-system/molecules/LookupDropdownInput";
import { PageActionBar } from "../../../design-system/molecules/PageActionBar";
import {
  spreadsheetCellControlClassName,
  spreadsheetCellNumericClassName,
  spreadsheetCellSelectClassName,
} from "../../../design-system/molecules/spreadsheetStyles";
import {
  TabularBody,
  TabularCell,
  TabularFooter,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../../design-system/molecules/tabularSerialNumbers";
import {
  tabularFooterBarClassName,
  tabularFooterButtonClassName,
} from "../../../design-system/molecules/tabularTokens";
import { TokenizerInput } from "../../../design-system/molecules/TokenizerInput";
import {
  DESKTOP_GROW_AS_NEEDED_STARTER_ROWS,
  MOBILE_GROW_AS_NEEDED_STARTER_ROWS,
  useSpreadsheetNavigation,
} from "../../../design-system/molecules/useSpreadsheetNavigation";
import {
  ItemVariantCardsEditor,
  type ItemVariantDraft,
} from "../../../design-system/organisms/ItemVariantCardsEditor";
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
import { useToast } from "../../../features/toast/useToast";
import { runLocalItemPreflightChecks, toUserItemErrorMessage } from "./item-utils";
import { normalizeGstSlab } from "../../../lib/gst-slabs";
import { cn } from "../../../lib/utils";

type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

const getNextTaxMode = (value: TaxMode) =>
  value === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE";

const groupedHeaderRows = "1.65rem 1.2rem";
const groupedParentHeaderClassName = "h-full justify-center text-center";
const groupedSubHeaderClassName =
  "h-full text-[9px] font-medium tracking-[0.03em] text-muted-foreground";

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
const DENSE_INPUT_CLASS = "app-catalog-editor-input";
const DENSE_SELECT_CLASS = "app-catalog-editor-select";
const BULK_OPTION_INPUT_CLASS = "app-catalog-option-input";
const QUICK_ENTRY_INPUT_CLASS = "h-8 rounded-lg px-2.5 text-[11px]";
const QUICK_ENTRY_SELECT_CLASS = "h-8 rounded-lg px-2.5 text-[11px]";
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
const normalizeOptionKey = (value: string) => value.trim().toLowerCase();
const normalizeHsnSac = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};
const normalizeGstSlabDraft = (value: string) => normalizeGstSlab(value) ?? undefined;
const normalizeBaseSku = (value: string) => {
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

const hasQuickRowContent = (row: QuickItemDraft) =>
  Boolean(
    row.name.trim() ||
      row.sku.trim() ||
      row.hsnSac.trim() ||
      row.gstSlab.trim() ||
      row.salesPrice.trim() ||
      row.purchasePrice.trim() ||
      row.salesTaxMode !== "EXCLUSIVE" ||
      row.purchaseTaxMode !== "EXCLUSIVE" ||
      row.category.trim() ||
      row.unit !== "PCS",
  );

const validateTaxCodeDraft = (
  itemType: "PRODUCT" | "SERVICE",
  value: string,
) => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    return itemType === "SERVICE"
      ? "SAC must contain digits only."
      : "HSN must contain digits only.";
  }

  if (itemType === "SERVICE") {
    return normalized.length === 6 ? null : "SAC must be 6 digits.";
  }

  return normalized.length >= 4 && normalized.length <= 8
    ? null
    : "HSN must be 4 to 8 digits.";
};

const sanitizeSkuChunk = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const toCondensedSkuChunk = (value: string) => {
  const sanitized = sanitizeSkuChunk(value);
  if (!sanitized) return "";
  const disemvoweled = `${sanitized[0]}${sanitized.slice(1).replace(/[AEIOU]/g, "")}`.replace(
    /CK/g,
    "K",
  );
  return disemvoweled.length > 0 ? disemvoweled.replace(/^MNTH/, "MTH") : sanitized;
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
  return optionValues.length > 0 ? `${baseName} / ${optionValues.join(" / ")}` : baseName;
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
  skuManuallyEdited: boolean;
  hsnSac: string;
  gstSlab: string;
  salesPrice: string;
  purchasePrice: string;
  salesTaxMode: TaxMode;
  purchaseTaxMode: TaxMode;
  category: string;
  unit: UnitOption;
};

type QuickEntryFieldKey =
  | "name"
  | "sku"
  | "hsnSac"
  | "salesPrice"
  | "salesTaxMode"
  | "purchasePrice"
  | "purchaseTaxMode"
  | "gstSlab"
  | "unit"
  | "category";

type QuickRowErrors = Partial<Record<QuickEntryFieldKey, string>>;

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
  id: `temp-${crypto.randomUUID()}`,
  name: "",
  nameManuallyEdited: false,
  sku: "",
  barcode: "",
  salesPrice: "",
  purchasePrice: "",
  salesTaxMode: "EXCLUSIVE",
  purchaseTaxMode: "EXCLUSIVE",
  gstSlab: "",
  skuManuallyEdited: false,
  optionRows: [],
});

const EMPTY_QUICK_ROW = (): QuickItemDraft => ({
  id: crypto.randomUUID(),
  name: "",
  sku: "",
  skuManuallyEdited: false,
  hsnSac: "",
  gstSlab: "",
  salesPrice: "",
  purchasePrice: "",
  salesTaxMode: "EXCLUSIVE",
  purchaseTaxMode: "EXCLUSIVE",
  category: "",
  unit: "PCS",
});

const getDefaultQuickRowCount = () => {
  if (typeof window === "undefined") return DESKTOP_GROW_AS_NEEDED_STARTER_ROWS;
  return window.matchMedia("(min-width: 1024px)").matches
    ? DESKTOP_GROW_AS_NEEDED_STARTER_ROWS
    : MOBILE_GROW_AS_NEEDED_STARTER_ROWS;
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

const collectGeneratedVariantSignatures = (variants: ItemVariantDraft[]) =>
  sortUnique(
    variants
      .map((variant) => buildVariantOptionSignature(variant.optionRows))
      .filter((signature) => signature.length > 0),
  );

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
  const { showToast } = useToast();

  const [hasVariants, setHasVariants] = useState(false);
  const [name, setName] = useState("");
  const [baseSku, setBaseSku] = useState("");
  const [baseSkuManuallyEdited, setBaseSkuManuallyEdited] = useState(false);
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<UnitOption>("PCS");
  const [variants, setVariants] = useState<ItemVariantDraft[]>([EMPTY_VARIANT()]);
  const [excludedVariantSignatures, setExcludedVariantSignatures] = useState<string[]>([]);
  const [bulkOptions, setBulkOptions] = useState<BulkOptionDraft[]>([EMPTY_BULK_OPTION()]);
  const [quickRows, setQuickRows] = useState<QuickItemDraft[]>(() =>
    buildInitialRows(),
  );
  const [savedOptionKeys, setSavedOptionKeys] = useState<string[]>([]);
  const [savedOptionValuesByKey, setSavedOptionValuesByKey] = useState<
    Record<string, string[]>
  >({});
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
  const [reservedSkus, setReservedSkus] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isDesktopQuickEntry, setIsDesktopQuickEntry] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 1024px)").matches,
  );
  const [pendingQuickRowFocus, setPendingQuickRowFocus] = useState(false);
  const quickEntryContainerRef = useRef<HTMLDivElement | null>(null);
  const previousQuickRowIdsRef = useRef<string[]>([]);
  const showPurchasePrice = forcedItemType !== "SERVICE";
  const taxCodeLabel = forcedItemType === "SERVICE" ? "SAC" : "HSN";
  const taxCodePlaceholder =
    forcedItemType === "SERVICE" ? "SAC (6 digits)" : "HSN (4-8 digits)";
  const quickEntryDesktopGridTemplate = showPurchasePrice
    ? withTabularSerialNumberColumn(
        "minmax(0, 2fr) minmax(0, 1.35fr) minmax(0, 1.15fr) minmax(0, 1fr) 5.25rem minmax(0, 1fr) 5.25rem minmax(0, 1fr) 5.75rem minmax(0, 1.6fr) 3.5rem",
      )
    : withTabularSerialNumberColumn(
        "minmax(0, 2fr) minmax(0, 1.35fr) minmax(0, 1.15fr) minmax(0, 1fr) 5.25rem minmax(0, 1fr) 5.75rem minmax(0, 1.6fr) 3.5rem",
      );
  const orderedUnitGroups = useMemo(
    () => getOrderedUnitGroups(forcedItemType),
    [forcedItemType],
  );
  const quickEntryFieldOrder = useMemo<QuickEntryFieldKey[]>(
    () =>
      showPurchasePrice
        ? [
            "name",
            "sku",
            "hsnSac",
            "salesPrice",
            "salesTaxMode",
            "purchasePrice",
            "purchaseTaxMode",
            "gstSlab",
            "unit",
            "category",
          ]
        : ["name", "sku", "hsnSac", "salesPrice", "salesTaxMode", "gstSlab", "unit", "category"],
    [showPurchasePrice],
  );
  const reportError = (message: string) => {
    showToast({
      title: "Unable to save",
      description: message,
      tone: "error",
      dedupeKey: `add-item-error:${message}`,
    });
  };
  const renderQuickEntryHeaderCells = () => {
    let column = 1;
    const rowSpanStyle = (targetColumn: number) => ({
      gridColumn: String(targetColumn),
      gridRow: "1 / span 2",
    });
    const firstRowStyle = (targetColumn: number, span = 1) => ({
      gridColumn: span > 1 ? `${targetColumn} / span ${span}` : String(targetColumn),
      gridRow: "1",
    });
    const secondRowStyle = (targetColumn: number) => ({
      gridColumn: String(targetColumn),
      gridRow: "2",
    });
    const cells = [
      <TabularSerialNumberHeaderCell key="serial" rowSpan={2} style={rowSpanStyle(column)} />,
    ];
    column += 1;

    for (const label of ["Name", "SKU", taxCodeLabel]) {
      cells.push(
        <TabularCell key={label} variant="header" rowSpan={2} style={rowSpanStyle(column)}>
          {label}
        </TabularCell>,
      );
      column += 1;
    }

    cells.push(
      <TabularCell
        key="sales"
        variant="header"
        align="center"
        span={2}
        className={groupedParentHeaderClassName}
        style={firstRowStyle(column, 2)}
      >
        Sales
      </TabularCell>,
      <TabularCell
        key="sales-price"
        variant="header"
        align="end"
        className={groupedSubHeaderClassName}
        style={secondRowStyle(column)}
      >
        Price
      </TabularCell>,
      <TabularCell
        key="sales-tax"
        variant="header"
        align="center"
        className={groupedSubHeaderClassName}
        style={secondRowStyle(column + 1)}
      >
        Tax
      </TabularCell>,
    );
    column += 2;

    if (showPurchasePrice) {
      cells.push(
        <TabularCell
          key="purchase"
          variant="header"
          align="center"
          span={2}
          className={groupedParentHeaderClassName}
          style={firstRowStyle(column, 2)}
        >
          Purchase
        </TabularCell>,
        <TabularCell
          key="purchase-price"
          variant="header"
          align="end"
          className={groupedSubHeaderClassName}
          style={secondRowStyle(column)}
        >
          Price
        </TabularCell>,
        <TabularCell
          key="purchase-tax"
          variant="header"
          align="center"
          className={groupedSubHeaderClassName}
          style={secondRowStyle(column + 1)}
        >
          Tax
        </TabularCell>,
      );
      column += 2;
    }

    for (const label of ["GST %", "Unit", "Category", "Actions"]) {
      cells.push(
        <TabularCell
          key={label}
          variant="header"
          align={label === "Actions" ? "center" : "start"}
          rowSpan={2}
          style={rowSpanStyle(column)}
        >
          {label}
        </TabularCell>,
      );
      column += 1;
    }

    return cells;
  };
  const appendQuickRow = (focusNewRow = false) => {
    if (focusNewRow) {
      setPendingQuickRowFocus(true);
    }
    setQuickRows((current) => [...current, EMPTY_QUICK_ROW()]);
  };
  const getQuickRowErrors = useCallback((row: QuickItemDraft): QuickRowErrors => {
    const nextErrors: QuickRowErrors = {};
    const rowHasContent = hasQuickRowContent(row);

    if (rowHasContent && row.name.trim().length === 0) {
      nextErrors.name = "Item name is required.";
    }

    const taxCodeError = validateTaxCodeDraft(forcedItemType, row.hsnSac);
    if (taxCodeError) {
      nextErrors.hsnSac = taxCodeError;
    }

    const salesPrice = parsePriceDraft(row.salesPrice);
    if (salesPrice.error) {
      nextErrors.salesPrice = salesPrice.error;
    }

    if (showPurchasePrice) {
      const purchasePrice = parsePriceDraft(row.purchasePrice);
      if (purchasePrice.error) {
        nextErrors.purchasePrice = purchasePrice.error;
      }
    }

    return nextErrors;
  }, [forcedItemType, showPurchasePrice]);
  const duplicateQuickSkus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of quickRows) {
      const normalizedSku = toComparableSku(row.sku);
      if (!normalizedSku) {
        continue;
      }
      counts.set(normalizedSku, (counts.get(normalizedSku) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([sku]) => sku),
    );
  }, [quickRows]);
  const quickRowErrorsById = useMemo(() => {
    const entries = quickRows.map((row) => {
      const rowErrors = getQuickRowErrors(row);
      const normalizedSku = toComparableSku(row.sku);
      if (normalizedSku && duplicateQuickSkus.has(normalizedSku)) {
        rowErrors.sku = "SKU must be unique within this quick-entry batch.";
      }
      return [row.id, rowErrors] as const;
    });
    return new Map<string, QuickRowErrors>(entries);
  }, [duplicateQuickSkus, getQuickRowErrors, quickRows]);
  const {
    focusCell: focusQuickRowCell,
    getCellDataAttributes: getQuickRowCellDataAttributes,
    handleCellFocus: handleQuickRowCellFocus,
    handleCellKeyDown: handleQuickRowCellKeyDown,
  } = useSpreadsheetNavigation<QuickEntryFieldKey>({
    containerRef: quickEntryContainerRef,
    getRowOrder: () => quickRows.map((row) => row.id),
    getFieldOrderForRow: () => quickEntryFieldOrder,
    appendMode: "grow-as-needed",
    canAppendFromRow: (rowId) => {
      const row = quickRows.find((entry) => entry.id === rowId);
      return Boolean(row && row.name.trim().length > 0);
    },
    onRequestAppendRow: () => {
      appendQuickRow(true);
    },
  });

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
              values: entry.values.slice(0, Math.max(0, entry.values.length - 1)),
            }
          : entry,
      ),
    );
  };

  const confirmOptionValueRemoval = (optionKey: string, optionValue: string) => {
    const affectedVariants = variants.filter((variant) =>
      variant.optionRows.some(
        (entry) =>
          normalizeOptionKey(entry.key) === normalizeOptionKey(optionKey) &&
          entry.value.trim().toLowerCase() === optionValue.trim().toLowerCase(),
      ),
    );
    if (affectedVariants.length === 0) {
      return true;
    }

    return window.confirm(
      [
        `Delete "${optionValue}"?`,
        `You are about to delete the "${optionValue}" option value from "${optionKey}".`,
        `${affectedVariants.length} generated ${affectedVariants.length === 1 ? "variant" : "variants"} will be permanently deleted.`,
      ].join("\n\n"),
    );
  };

  const confirmOptionKeyRemoval = (optionKey: string) => {
    const affectedVariants = variants.filter((variant) =>
      variant.optionRows.some(
        (entry) => normalizeOptionKey(entry.key) === normalizeOptionKey(optionKey),
      ),
    );
    if (affectedVariants.length === 0) {
      return true;
    }

    return window.confirm(
      [
        `Delete option "${optionKey}"?`,
        `You are about to delete the "${optionKey}" option and all variants that depend on it.`,
        `${affectedVariants.length} generated ${affectedVariants.length === 1 ? "variant" : "variants"} will be permanently deleted.`,
      ].join("\n\n"),
    );
  };

  const handleVariantTableChange = (nextVariants: ItemVariantDraft[]) => {
    setVariants((current) => {
      const nextVariantIds = new Set(nextVariants.map((variant) => variant.id));
      const removedSignatures = collectGeneratedVariantSignatures(
        current.filter((variant) => !nextVariantIds.has(variant.id)),
      );
      if (removedSignatures.length > 0) {
        setExcludedVariantSignatures((currentExcluded) =>
          sortUnique([...currentExcluded, ...removedSignatures]),
        );
      }
      return nextVariants;
    });
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
      setIsDesktopQuickEntry(desktopMedia.matches);
      setQuickRows((current) => {
        const isPristine = current.every(
          (row) =>
            row.name.trim().length === 0 &&
            row.sku.trim().length === 0 &&
            !row.skuManuallyEdited &&
            row.hsnSac.trim().length === 0 &&
            row.gstSlab.trim().length === 0 &&
            row.salesPrice.trim().length === 0 &&
            row.purchasePrice.trim().length === 0 &&
            row.category.trim().length === 0 &&
            row.unit === "PCS",
        );
        if (!isPristine) return current;

        const nextCount = desktopMedia.matches
          ? DESKTOP_GROW_AS_NEEDED_STARTER_ROWS
          : MOBILE_GROW_AS_NEEDED_STARTER_ROWS;
        if (current.length === nextCount) return current;

        return buildInitialRows(nextCount);
      });
    };

    desktopMedia.addEventListener("change", syncQuickRowDefaults);
    syncQuickRowDefaults();

    return () => {
      desktopMedia.removeEventListener("change", syncQuickRowDefaults);
    };
  }, []);

  useEffect(() => {
    if (!pendingQuickRowFocus) {
      previousQuickRowIdsRef.current = quickRows.map((row) => row.id);
      return;
    }

    const previousIds = new Set(previousQuickRowIdsRef.current);
    const appendedRow = quickRows.find((row) => !previousIds.has(row.id));
    previousQuickRowIdsRef.current = quickRows.map((row) => row.id);

    if (!appendedRow) {
      return;
    }

    if (isDesktopQuickEntry) {
      focusQuickRowCell(appendedRow.id, "name");
    }
    setPendingQuickRowFocus(false);
  }, [focusQuickRowCell, isDesktopQuickEntry, pendingQuickRowFocus, quickRows]);

  useEffect(() => {
    if (!activeStore) return;
    persistOptionDiscovery(activeStore, savedOptionKeys, savedOptionValuesByKey);
  }, [activeStore, savedOptionKeys, savedOptionValuesByKey]);

  useEffect(() => {
    if (!hasVariants) {
      setExcludedVariantSignatures([]);
    }
  }, [hasVariants]);

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
    if (hasVariants) return;
    if (quickRows.length === 0) return;

    const used = new Set(reservedSkus);
    for (const row of quickRows) {
      if (!row.skuManuallyEdited) continue;
      const normalized = toComparableSku(row.sku);
      if (normalized) used.add(normalized);
    }

    let changed = false;
    const nextRows = quickRows.map((row) => {
      if (row.skuManuallyEdited) return row;

      const baseIdentifier = deriveBaseSkuFromItemName(row.name);
      if (!baseIdentifier) {
        if (row.sku === "") return row;
        changed = true;
        return {
          ...row,
          sku: "",
        };
      }

      const normalizedBase = toComparableSku(baseIdentifier);
      let candidate = normalizedBase || "ITEM";
      let suffix = 0;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${normalizedBase || "ITEM"}-${suffix}`;
      }
      used.add(candidate);

      if (row.sku === candidate) return row;
      changed = true;
      return {
        ...row,
        sku: candidate,
      };
    });

    if (changed) {
      setQuickRows(nextRows);
    }
  }, [hasVariants, quickRows, reservedSkus]);

  useEffect(() => {
    if (!hasVariants) return;
    if (baseSkuManuallyEdited) return;

    const generatedBaseSku = ensureUniqueSku(
      deriveBaseSkuFromItemName(name),
      reservedSkus,
    );
    if (baseSku !== generatedBaseSku) {
      setBaseSku(generatedBaseSku);
    }
  }, [baseSku, baseSkuManuallyEdited, hasVariants, name, reservedSkus]);

  useEffect(() => {
    if (!hasVariants) return;
    if (variants.length === 0) return;

    const used = new Set(reservedSkus);
    for (const variant of variants) {
      if (!variant.skuManuallyEdited) continue;
      const normalized = toComparableSku(variant.sku);
      if (normalized) used.add(normalized);
    }

    const normalizedBaseSku = normalizeBaseSku(baseSku);
    const baseIdentifier = normalizedBaseSku || "ITEM";
    let changed = false;

    const next = variants.map((variant) => {
      if (variant.skuManuallyEdited) return variant;

      const optionParts = variant.optionRows
        .map((entry) => abbreviateSkuChunk(entry.value))
        .filter((entry) => entry.length > 0);
      const variantSku = [baseIdentifier, ...optionParts].join("-");
      const normalizedBase = toComparableSku(variantSku || "ITEM");
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
  }, [baseSku, hasVariants, name, reservedSkus, variants]);

  useEffect(() => {
    if (!hasVariants) return;
    if (variants.length === 0) return;

    let changed = false;
    const next = variants.map((variant) => {
      if (variant.nameManuallyEdited) return variant;

      const generatedName = buildAutoVariantName(name, variant.optionRows);
      if (variant.name !== generatedName) {
        changed = true;
        return {
          ...variant,
          name: generatedName,
        };
      }
      return variant;
    });

    if (changed) {
      setVariants(next);
    }
  }, [hasVariants, name, variants]);

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

  const applyBulkOptionsToVariants = (options?: { resetExcluded?: boolean }) => {
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
      reportError("Add at least one option key with values before applying.");
      return;
    }
    if (normalizedOptions.some((option) => option.values.length === 0)) {
      reportError("Each option key must include at least one value.");
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
      variants.map((variant) => [buildVariantOptionSignature(variant.optionRows), variant]),
    );

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
      if (existing) {
        return [{
          ...existing,
          optionRows,
        }];
      }
      return [{
        ...EMPTY_VARIANT(),
        optionRows,
      } satisfies ItemVariantDraft];
    });

    setExcludedVariantSignatures(nextExcludedSignatures);
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
  };

  const resetGeneratedVariants = () => {
    applyBulkOptionsToVariants({ resetExcluded: true });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityId || !activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      if (!hasVariants) {
        const rowsToCreate = quickRows
          .map((row) => ({
            ...row,
            name: row.name.trim(),
            sku: row.sku.trim(),
            hsnSac: row.hsnSac.trim(),
            gstSlab: normalizeGstSlab(row.gstSlab) ?? "",
            salesPrice: row.salesPrice.trim(),
            purchasePrice: row.purchasePrice.trim(),
            category: normalizeCategory(row.category),
          }))
          .filter((row) => row.name.length > 0);

        if (rowsToCreate.length === 0) {
          reportError("Add at least one item name to save.");
          return;
        }

        const hasInlineRowErrors = rowsToCreate.some((row) => {
          const rowErrors = quickRowErrorsById.get(row.id) ?? {};
          return Object.keys(rowErrors).length > 0;
        });
        if (hasInlineRowErrors) {
          reportError("Fix the highlighted quick-entry cells before saving.");
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
          reportError(quickEntryPreflightError);
          return;
        }

        for (const row of rowsToCreate) {
          const salesPrice = parsePriceDraft(row.salesPrice).amount;
          const purchasePrice = showPurchasePrice
            ? parsePriceDraft(row.purchasePrice).amount
            : undefined;
          const gstSlab = normalizeGstSlabDraft(row.gstSlab);
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
          if (typeof salesPrice === "number" || gstSlab || row.salesTaxMode !== "EXCLUSIVE") {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              variantId,
              salesPrice ?? null,
              "INR",
              undefined,
              "SALES",
              row.salesTaxMode,
              gstSlab,
            );
          }
          if (
            showPurchasePrice &&
            (typeof purchasePrice === "number" || row.purchaseTaxMode !== "EXCLUSIVE")
          ) {
            await queueItemPriceUpsert(
              activeStore,
              identityId,
              variantId,
              purchasePrice ?? null,
              "INR",
              undefined,
              "PURCHASE",
              row.purchaseTaxMode,
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
        reportError("Item name is required.");
        return;
      }
      if (variants.length === 0) {
        reportError("Add at least one variant.");
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
      const normalizedBaseSku = normalizeBaseSku(baseSku);

      const preflightError = await runLocalItemPreflightChecks(activeStore, [
        {
          name: name.trim(),
          variants: variantPayload.map((variant) => ({
            sku: variant.sku,
          })),
        },
      ]);
      if (preflightError) {
        reportError(preflightError);
        return;
      }

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
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

      await queueItemCreate(activeStore, identityId, {
        itemType: forcedItemType,
        name: name.trim(),
        category: normalizeCategory(category) || undefined,
        unit,
        metadata: normalizedBaseSku
          ? {
              custom: {
                base_sku: normalizedBaseSku,
              },
            }
          : undefined,
        variants: variantPayload,
      });
      for (const variant of variants) {
        const salesPrice = parsePriceDraft(variant.salesPrice ?? "").amount;
        const purchasePrice = showPurchasePrice
          ? parsePriceDraft(variant.purchasePrice ?? "").amount
          : undefined;
        const gstSlab = normalizeGstSlabDraft(variant.gstSlab ?? "");
        if (
          typeof salesPrice === "number" ||
          gstSlab ||
          (variant.salesTaxMode ?? "EXCLUSIVE") !== "EXCLUSIVE"
        ) {
          await queueItemPriceUpsert(
            activeStore,
            identityId,
            variant.id,
            salesPrice ?? null,
            "INR",
            undefined,
            "SALES",
            variant.salesTaxMode ?? "EXCLUSIVE",
            gstSlab,
          );
        }
        if (
          showPurchasePrice &&
          (typeof purchasePrice === "number" ||
            (variant.purchaseTaxMode ?? "EXCLUSIVE") !== "EXCLUSIVE")
        ) {
          await queueItemPriceUpsert(
            activeStore,
            identityId,
            variant.id,
            purchasePrice ?? null,
            "INR",
            undefined,
            "PURCHASE",
            variant.purchaseTaxMode ?? "EXCLUSIVE",
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
      reportError(toUserItemErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getQuickRowLabelBase = (row: QuickItemDraft, index: number) =>
    row.name.trim() || `${singularLabel.toLowerCase()} ${index + 1}`;

  const getQuickRowAriaLabel = (
    row: QuickItemDraft,
    index: number,
    label: string,
  ) => `${label} for ${getQuickRowLabelBase(row, index)}`;

  const getQuickEntryFieldClassName = (
    rowId: string,
    field: QuickEntryFieldKey,
    mobileClassName?: string,
    desktopClassName?: string,
  ) =>
    cn(
      isDesktopQuickEntry
        ? field === "gstSlab" || field === "unit"
          ? spreadsheetCellSelectClassName
          : spreadsheetCellControlClassName
        : mobileClassName,
      isDesktopQuickEntry ? desktopClassName : undefined,
      !isDesktopQuickEntry && quickRowErrorsById.get(rowId)?.[field]
        ? "border-red-500 bg-red-50/60 focus:border-red-500 focus:ring-red-500/20"
        : undefined,
    );

  const handleQuickEntryFieldFocus = (
    rowId: string,
    field: QuickEntryFieldKey,
  ) => {
    if (!isDesktopQuickEntry) {
      return;
    }
    handleQuickRowCellFocus(rowId, field);
  };

  const handleQuickEntryFieldKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    rowId: string,
    field: QuickEntryFieldKey,
  ) => {
    if (!isDesktopQuickEntry) {
      return;
    }
    handleQuickRowCellKeyDown(event, rowId, field);
  };

  const handleNumericFieldFocus = (
    event: FocusEvent<HTMLInputElement>,
    rowId: string,
    field: Extract<QuickEntryFieldKey, "salesPrice" | "purchasePrice">,
  ) => {
    handleQuickEntryFieldFocus(rowId, field);
    event.currentTarget.select();
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
                  <div className="grid gap-1.5 lg:min-w-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_92px_minmax(0,1.6fr)]">
                    <div className="grid gap-1">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        className={DENSE_INPUT_CLASS}
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value);
                        }}
                        required={hasVariants}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="base-sku">Base SKU</Label>
                      <Input
                        id="base-sku"
                        className={DENSE_INPUT_CLASS}
                        value={baseSku}
                        onChange={(event) => {
                          const nextBaseSku = event.target.value;
                          setBaseSku(nextBaseSku);
                          setBaseSkuManuallyEdited(
                            nextBaseSku.trim().length > 0 &&
                              nextBaseSku.trim().toUpperCase() !==
                                ensureUniqueSku(deriveBaseSkuFromItemName(name), reservedSkus),
                          );
                        }}
                        placeholder="Auto-generated from item name"
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
                    }}
                    className="h-6 w-11 border"
                    checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                    uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                  />
                  <Label htmlFor="variant-mode">Variant mode (single item)</Label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:space-y-px">
              {!hasVariants ? (
              <>
              <div className="space-y-1.5 lg:hidden">
                <div className="grid gap-1.5">
                  {quickRows.map((row, index) => {
                    const rowErrors = quickRowErrorsById.get(row.id) ?? {};
                    return (
                      <div
                        key={row.id}
                        className="grid gap-1.5 rounded-lg border border-border/70 bg-white p-1.5"
                      >
                        <div className="grid gap-1">
                          <Label>Name</Label>
                          <Input
                            className={getQuickEntryFieldClassName(row.id, "name", QUICK_ENTRY_INPUT_CLASS)}
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
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "name")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "name")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "Name")}
                            aria-invalid={rowErrors.name ? true : undefined}
                            title={rowErrors.name}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label>SKU</Label>
                          <Input
                            className={getQuickEntryFieldClassName(row.id, "sku", QUICK_ENTRY_INPUT_CLASS)}
                            value={row.sku}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        sku: event.target.value,
                                        skuManuallyEdited:
                                          event.target.value.trim().length > 0 &&
                                          event.target.value.trim().toUpperCase() !==
                                            deriveBaseSkuFromItemName(entry.name),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "sku")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "sku")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "SKU")}
                            aria-invalid={rowErrors.sku ? true : undefined}
                            title={rowErrors.sku}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label>{taxCodeLabel}</Label>
                          <Input
                            className={getQuickEntryFieldClassName(row.id, "hsnSac", QUICK_ENTRY_INPUT_CLASS)}
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
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "hsnSac")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "hsnSac")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, taxCodeLabel)}
                            aria-invalid={rowErrors.hsnSac ? true : undefined}
                            title={rowErrors.hsnSac ?? taxCodePlaceholder}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label>Sales price</Label>
                          <Input
                            className={getQuickEntryFieldClassName(
                              row.id,
                              "salesPrice",
                              QUICK_ENTRY_INPUT_CLASS,
                              spreadsheetCellNumericClassName,
                            )}
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
                            onFocus={(event) =>
                              handleNumericFieldFocus(event, row.id, "salesPrice")
                            }
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "salesPrice")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "Sales price")}
                            aria-invalid={rowErrors.salesPrice ? true : undefined}
                            title={rowErrors.salesPrice}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label>Sales tax</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(QUICK_ENTRY_SELECT_CLASS, "w-full justify-center")}
                            onClick={() =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        salesTaxMode: getNextTaxMode(entry.salesTaxMode),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "salesTaxMode")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "salesTaxMode")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "Sales tax")}
                          >
                            {row.salesTaxMode === "INCLUSIVE" ? "Inclusive" : "Exclusive"}
                          </Button>
                        </div>
                        {showPurchasePrice ? (
                          <div className="grid gap-1">
                            <Label>Purchase price</Label>
                            <Input
                              className={getQuickEntryFieldClassName(
                                row.id,
                                "purchasePrice",
                                QUICK_ENTRY_INPUT_CLASS,
                                spreadsheetCellNumericClassName,
                              )}
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
                              onFocus={(event) =>
                                handleNumericFieldFocus(event, row.id, "purchasePrice")
                              }
                              onKeyDown={(event) =>
                                handleQuickEntryFieldKeyDown(event, row.id, "purchasePrice")
                              }
                              aria-label={getQuickRowAriaLabel(row, index, "Purchase price")}
                              aria-invalid={rowErrors.purchasePrice ? true : undefined}
                              title={rowErrors.purchasePrice}
                              inputMode="decimal"
                            />
                          </div>
                        ) : null}
                        {showPurchasePrice ? (
                          <div className="grid gap-1">
                            <Label>Purchase tax</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(QUICK_ENTRY_SELECT_CLASS, "w-full justify-center")}
                              onClick={() =>
                                setQuickRows((current) =>
                                  current.map((entry) =>
                                    entry.id === row.id
                                      ? {
                                          ...entry,
                                          purchaseTaxMode: getNextTaxMode(entry.purchaseTaxMode),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              onFocus={() =>
                                handleQuickEntryFieldFocus(row.id, "purchaseTaxMode")
                              }
                              onKeyDown={(event) =>
                                handleQuickEntryFieldKeyDown(
                                  event,
                                  row.id,
                                  "purchaseTaxMode",
                                )
                              }
                              aria-label={getQuickRowAriaLabel(row, index, "Purchase tax")}
                            >
                              {row.purchaseTaxMode === "INCLUSIVE" ? "Inclusive" : "Exclusive"}
                            </Button>
                          </div>
                        ) : null}
                        <div className="grid gap-1">
                          <Label>GST %</Label>
                          <GstSlabSelect
                            className={getQuickEntryFieldClassName(
                              row.id,
                              "gstSlab",
                              `${QUICK_ENTRY_SELECT_CLASS} w-full`,
                            )}
                            value={row.gstSlab}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, gstSlab: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "gstSlab")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "gstSlab")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "GST")}
                            placeholderOption="GST %"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label>Unit</Label>
                          <Select
                            className={getQuickEntryFieldClassName(
                              row.id,
                              "unit",
                              `${QUICK_ENTRY_SELECT_CLASS} w-full`,
                            )}
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
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "unit")}
                            onKeyDown={(event) =>
                              handleQuickEntryFieldKeyDown(event, row.id, "unit")
                            }
                            aria-label={getQuickRowAriaLabel(row, index, "Unit")}
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
                          <Label>Category</Label>
                          <LookupDropdownInput
                            inputProps={{
                              onFocus: () => handleQuickEntryFieldFocus(row.id, "category"),
                              onKeyDown: (event) =>
                                handleQuickEntryFieldKeyDown(event, row.id, "category"),
                              "aria-label": getQuickRowAriaLabel(row, index, "Category"),
                            }}
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
                            inputClassName={getQuickEntryFieldClassName(
                              row.id,
                              "category",
                              QUICK_ENTRY_INPUT_CLASS,
                            )}
                            optionClassName="text-[10px]"
                          />
                        </div>
                        <div className="p-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Delete item row"
                            title="Delete row"
                            className="h-8 whitespace-nowrap gap-1.5 px-2 text-[#8a2b2b] hover:bg-[#fff5f5] hover:text-[#7a1f1f]"
                            disabled={quickRows.length <= 1}
                            onClick={() =>
                              setQuickRows((current) =>
                                current.filter((entry) => entry.id !== row.id),
                              )
                            }
                          >
                            <Trash2 aria-hidden="true" />
                            <span>Delete row</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-1.5",
                    tabularFooterBarClassName,
                  )}
                >
                  <p className="text-[11px] text-muted-foreground">
                    Ready:{" "}
                    <span className="font-semibold text-foreground">{quickRowsWithName}</span>{" "}
                    item{quickRowsWithName === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("px-2", tabularFooterButtonClassName)}
                      onClick={() => appendQuickRow(false)}
                    >
                      Add Row
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("px-2", tabularFooterButtonClassName)}
                      onClick={() => setQuickRows(buildInitialRows())}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
              <TabularSurface
                ref={quickEntryContainerRef}
                role="grid"
                aria-label="Quick add items"
                className="hidden overflow-hidden bg-white lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
              >
                <TabularHeader>
                  <TabularRow columns={quickEntryDesktopGridTemplate} rows={groupedHeaderRows}>
                    {renderQuickEntryHeaderCells()}
                  </TabularRow>
                </TabularHeader>
                <TabularBody className="overflow-y-auto">
                  {quickRows.map((row, index) => {
                    const rowErrors = quickRowErrorsById.get(row.id) ?? {};
                    return (
                      <TabularRow key={row.id} columns={quickEntryDesktopGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell variant="editable" error={Boolean(rowErrors.name)}>
                          <Input
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "name")}
                            className={getQuickEntryFieldClassName(row.id, "name", undefined, "lg:pl-2.5")}
                            value={row.name}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id ? { ...entry, name: event.target.value } : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "name")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "name")}
                            aria-label={getQuickRowAriaLabel(row, index, "Name")}
                            aria-invalid={rowErrors.name ? true : undefined}
                            title={rowErrors.name}
                            placeholder="Name"
                          />
                        </TabularCell>
                        <TabularCell variant="editable" error={Boolean(rowErrors.sku)}>
                          <Input
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "sku")}
                            className={getQuickEntryFieldClassName(row.id, "sku", undefined, "lg:pl-2.5")}
                            value={row.sku}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        sku: event.target.value,
                                        skuManuallyEdited:
                                          event.target.value.trim().length > 0 &&
                                          event.target.value.trim().toUpperCase() !== deriveBaseSkuFromItemName(entry.name),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "sku")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "sku")}
                            aria-label={getQuickRowAriaLabel(row, index, "SKU")}
                            aria-invalid={rowErrors.sku ? true : undefined}
                            title={rowErrors.sku}
                            placeholder="SKU"
                          />
                        </TabularCell>
                        <TabularCell variant="editable" error={Boolean(rowErrors.hsnSac)}>
                          <Input
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "hsnSac")}
                            className={getQuickEntryFieldClassName(row.id, "hsnSac", undefined, "lg:pl-2.5")}
                            value={row.hsnSac}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id ? { ...entry, hsnSac: event.target.value } : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "hsnSac")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "hsnSac")}
                            aria-label={getQuickRowAriaLabel(row, index, taxCodeLabel)}
                            aria-invalid={rowErrors.hsnSac ? true : undefined}
                            title={rowErrors.hsnSac ?? taxCodePlaceholder}
                            inputMode="numeric"
                            placeholder={taxCodeLabel}
                          />
                        </TabularCell>
                        <TabularCell variant="editable" align="end" error={Boolean(rowErrors.salesPrice)}>
                          <Input
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "salesPrice")}
                            className={getQuickEntryFieldClassName(
                              row.id,
                              "salesPrice",
                              undefined,
                              spreadsheetCellNumericClassName,
                            )}
                            value={row.salesPrice}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id ? { ...entry, salesPrice: event.target.value } : entry,
                                ),
                              )
                            }
                            onFocus={(event) => handleNumericFieldFocus(event, row.id, "salesPrice")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "salesPrice")}
                            aria-label={getQuickRowAriaLabel(row, index, "Sales price")}
                            aria-invalid={rowErrors.salesPrice ? true : undefined}
                            title={rowErrors.salesPrice}
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </TabularCell>
                        <TabularCell variant="editable">
                          <Button
                            {...getQuickRowCellDataAttributes(row.id, "salesTaxMode")}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-[var(--tabular-row-height)] w-full min-w-0 rounded-none border-none bg-transparent px-0 text-[10px] text-muted-foreground shadow-none hover:bg-muted/55"
                            onClick={() =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        salesTaxMode: getNextTaxMode(entry.salesTaxMode),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "salesTaxMode")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "salesTaxMode")}
                            aria-label={getQuickRowAriaLabel(row, index, "Sales tax")}
                          >
                            {row.salesTaxMode === "INCLUSIVE" ? "Incl." : "Excl."}
                          </Button>
                        </TabularCell>
                        {showPurchasePrice ? (
                          <TabularCell variant="editable" align="end" error={Boolean(rowErrors.purchasePrice)}>
                            <Input
                              unstyled
                              {...getQuickRowCellDataAttributes(row.id, "purchasePrice")}
                              className={getQuickEntryFieldClassName(
                                row.id,
                                "purchasePrice",
                                undefined,
                                spreadsheetCellNumericClassName,
                              )}
                              value={row.purchasePrice}
                              onChange={(event) =>
                                setQuickRows((current) =>
                                  current.map((entry) =>
                                    entry.id === row.id ? { ...entry, purchasePrice: event.target.value } : entry,
                                  ),
                                )
                              }
                              onFocus={(event) => handleNumericFieldFocus(event, row.id, "purchasePrice")}
                              onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "purchasePrice")}
                              aria-label={getQuickRowAriaLabel(row, index, "Purchase price")}
                              aria-invalid={rowErrors.purchasePrice ? true : undefined}
                              title={rowErrors.purchasePrice}
                              inputMode="decimal"
                              placeholder="0.00"
                            />
                          </TabularCell>
                        ) : null}
                        {showPurchasePrice ? (
                          <TabularCell variant="editable">
                            <Button
                              {...getQuickRowCellDataAttributes(row.id, "purchaseTaxMode")}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-[var(--tabular-row-height)] w-full min-w-0 rounded-none border-none bg-transparent px-0 text-[10px] text-muted-foreground shadow-none hover:bg-muted/55"
                              onClick={() =>
                                setQuickRows((current) =>
                                  current.map((entry) =>
                                    entry.id === row.id
                                      ? {
                                          ...entry,
                                          purchaseTaxMode: getNextTaxMode(entry.purchaseTaxMode),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              onFocus={() =>
                                handleQuickEntryFieldFocus(row.id, "purchaseTaxMode")
                              }
                              onKeyDown={(event) =>
                                handleQuickEntryFieldKeyDown(event, row.id, "purchaseTaxMode")
                              }
                              aria-label={getQuickRowAriaLabel(row, index, "Purchase tax")}
                            >
                              {row.purchaseTaxMode === "INCLUSIVE" ? "Incl." : "Excl."}
                            </Button>
                          </TabularCell>
                        ) : null}
                        <TabularCell variant="editable">
                          <GstSlabSelect
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "gstSlab")}
                            className={getQuickEntryFieldClassName(row.id, "gstSlab", undefined, `${QUICK_ENTRY_SELECT_CLASS} w-full`)}
                            value={row.gstSlab}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id ? { ...entry, gstSlab: event.target.value } : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "gstSlab")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "gstSlab")}
                            aria-label={getQuickRowAriaLabel(row, index, "GST")}
                            placeholderOption="GST %"
                          />
                        </TabularCell>
                        <TabularCell variant="editable">
                          <Select
                            unstyled
                            {...getQuickRowCellDataAttributes(row.id, "unit")}
                            className={getQuickEntryFieldClassName(row.id, "unit", undefined, `${QUICK_ENTRY_SELECT_CLASS} w-full`)}
                            value={row.unit}
                            onChange={(event) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, unit: event.target.value as UnitOption }
                                    : entry,
                                ),
                              )
                            }
                            onFocus={() => handleQuickEntryFieldFocus(row.id, "unit")}
                            onKeyDown={(event) => handleQuickEntryFieldKeyDown(event, row.id, "unit")}
                            aria-label={getQuickRowAriaLabel(row, index, "Unit")}
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
                        </TabularCell>
                        <TabularCell variant="editable">
                          <LookupDropdownInput
                            inputProps={{
                              ...getQuickRowCellDataAttributes(row.id, "category"),
                              onFocus: () => handleQuickEntryFieldFocus(row.id, "category"),
                              onKeyDown: (event) => handleQuickEntryFieldKeyDown(event, row.id, "category"),
                              "aria-label": getQuickRowAriaLabel(row, index, "Category"),
                            }}
                            value={row.category}
                            onValueChange={(value) =>
                              setQuickRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id ? { ...entry, category: value } : entry,
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
                                  entry.id === row.id ? { ...entry, category: categoryValue } : entry,
                                ),
                              )
                            }
                            renderOption={(categoryValue) => (
                              <div className="truncate font-medium">{categoryValue}</div>
                            )}
                            maxVisibleOptions={10}
                            inputClassName={getQuickEntryFieldClassName(row.id, "category", undefined, "lg:pl-2.5")}
                            inputUnstyled
                            optionClassName="text-[10px]"
                          />
                        </TabularCell>
                        <TabularCell variant="editable" align="center" className="p-0">
                          <IconButton
                            type="button"
                            icon={Trash2}
                            variant="ghost"
                            aria-label="Delete item row"
                            title="Delete row"
                            className="h-full w-full rounded-none border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                            disabled={quickRows.length <= 1}
                            onClick={() =>
                              setQuickRows((current) => current.filter((entry) => entry.id !== row.id))
                            }
                            iconSize={14}
                          />
                        </TabularCell>
                      </TabularRow>
                    );
                  })}
                </TabularBody>
                <TabularFooter>
                  <p className="text-[10px] leading-none text-muted-foreground">
                    Ready:{" "}
                    <span className="font-semibold text-foreground">{quickRowsWithName}</span>{" "}
                    item{quickRowsWithName === 1 ? "" : "s"}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("px-2", tabularFooterButtonClassName)}
                      onClick={() => appendQuickRow(false)}
                    >
                      Add Row
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("px-2", tabularFooterButtonClassName)}
                      onClick={() => setQuickRows(buildInitialRows())}
                    >
                      Reset
                    </Button>
                  </div>
                </TabularFooter>
              </TabularSurface>
              </>
            ) : (
              <div className="space-y-1.5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-1">
                <div className="rounded-lg border border-border/80 bg-white p-1.5">
                  <p className="text-[11px] font-semibold text-foreground lg:text-[10px]">Options</p>
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
                          className="grid gap-1.5 rounded-md border border-border/70 bg-slate-50/60 p-1.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:grid-cols-[220px_minmax(0,1fr)_auto]"
                        >
                          <div className="grid gap-1">
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
                                    entry.id === option.id ? { ...entry, valueDraft: value } : entry,
                                  ),
                                )
                              }
                              onCommitValue={(value) => commitBulkOptionValue(option.id, value)}
                              onRemoveValue={(value) =>
                                confirmOptionValueRemoval(option.key, value)
                                  ? setBulkOptions((current) =>
                                      current.map((entry) =>
                                        entry.id === option.id
                                          ? {
                                              ...entry,
                                              values: entry.values.filter(
                                                (entryValue) => entryValue !== value,
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
                          />
                        </div>
                        <div className="app-mobile-action-stack lg:items-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="app-mobile-action-button w-full lg:hidden"
                            disabled={option.valueDraft.trim().length === 0}
                            onClick={() => commitBulkOptionValue(option.id, option.valueDraft)}
                          >
                            Add value
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="app-mobile-action-button w-full lg:hidden"
                            disabled={bulkOptions.length <= 1}
                            onClick={() =>
                              confirmOptionKeyRemoval(option.key)
                                ? setBulkOptions((current) =>
                                    current.filter((entry) => entry.id !== option.id),
                                  )
                                : undefined
                            }
                          >
                            Remove option
                          </Button>
                            <IconButton
                              type="button"
                              icon={Trash2}
                              variant="ghost"
                              aria-label="Remove option key"
                              title="Remove option key"
                              className="hidden h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f] lg:inline-flex"
                              disabled={bulkOptions.length <= 1}
                              onClick={() =>
                                confirmOptionKeyRemoval(option.key)
                                  ? setBulkOptions((current) =>
                                      current.filter((entry) => entry.id !== option.id),
                                    )
                                  : undefined
                              }
                              iconSize={14}
                            />
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
                        className="app-mobile-action-button w-full lg:w-auto"
                        onClick={() => applyBulkOptionsToVariants()}
                      >
                        Apply Options
                      </Button>
                    </div>
                  </div>
                </div>

                <ItemVariantCardsEditor
                  variants={variants}
                  onVariantsChange={handleVariantTableChange}
                  onVariantNameChange={(variantId, variantName) => {
                    setVariants((current) =>
                      current.map((variant) =>
                        variant.id === variantId
                          ? {
                              ...variant,
                              name: variantName,
                              nameManuallyEdited: variantName.trim().length > 0,
                            }
                          : variant,
                      ),
                    );
                  }}
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
                  onAddVariant={() => undefined}
                  appendMode="restricted"
                  generatedVariantMode
                  onResetGeneratedVariants={resetGeneratedVariants}
                  showAddVariantAction={false}
                  denseInputClassName={DENSE_INPUT_CLASS}
                  showPricingFields
                  showPurchasePrice={showPurchasePrice}
                />
              </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </section>
  );
}
