import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../shared/utils/errors.js";

const SUPPORTED_ENTITIES = new Set([
  "item",
  "item_variant",
  "item_category",
  "item_collection",
  "item_collection_item",
]);
const SUPPORTED_ITEM_FIELDS = new Set([
  "sku",
  "name",
  "category",
  "unit",
  "itemType",
  "variants",
]);
type ItemPayload = {
  sku?: string | null;
  name?: string;
  category?: string | null;
  unit?: string;
  itemType?: string;
  variants?: VariantPayload[];
};
type VariantPayload = {
  id?: string;
  itemId?: string;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  optionValues?: Record<string, string>;
};
const DEFAULT_ITEM_VALUES = {
  name: "Untitled Item",
  unit: "PCS",
  itemType: "PRODUCT",
};
const prismaAny = prisma as any;

const toPrismaSyncOperation = (op) => {
  if (op === "create") return "CREATE";
  if (op === "update") return "UPDATE";
  return "DELETE";
};

const toSyncOperation = (op) => {
  if (op === "CREATE") return "create";
  if (op === "UPDATE") return "update";
  return "delete";
};

const sanitizeItemPayload = (payload) => {
  const normalized: ItemPayload = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!SUPPORTED_ITEM_FIELDS.has(key)) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
};

const sanitizeVariantPayload = (payload) => {
  const raw = (payload ?? {}) as VariantPayload;
  const normalized: VariantPayload = {};

  if (typeof raw.itemId === "string" && raw.itemId) {
    normalized.itemId = raw.itemId;
  }
  if (raw.name === null) {
    normalized.name = null;
  } else if (typeof raw.name === "string") {
    normalized.name = raw.name;
  }
  if (raw.barcode === null) {
    normalized.barcode = null;
  } else if (typeof raw.barcode === "string") {
    normalized.barcode = raw.barcode;
  }
  if (typeof raw.isDefault === "boolean") {
    normalized.isDefault = raw.isDefault;
  }
  if (typeof raw.isActive === "boolean") {
    normalized.isActive = raw.isActive;
  }

  const normalizedSku = normalizeSku(raw.sku);
  if (raw.sku === null) {
    normalized.sku = null;
  } else if (normalizedSku !== undefined) {
    normalized.sku = normalizedSku;
  }

  if (raw.optionValues && typeof raw.optionValues === "object") {
    const entries = Object.entries(raw.optionValues).filter(
      ([key, value]) =>
        typeof key === "string" &&
        key.trim().length > 0 &&
        typeof value === "string" &&
        value.trim().length > 0,
    );
    normalized.optionValues = Object.fromEntries(
      entries.map(([key, value]) => [key.trim(), String(value).trim()]),
    );
  }

  return normalized;
};

const normalizeSku = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeCategory = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const ensureCategoryExists = async (tx, tenantId: string, category: string) => {
  const trimmed = category.trim();
  if (!trimmed) return;
  const txAny = tx as any;
  await txAny.itemCategory.upsert({
    where: {
      business_id_name: {
        business_id: tenantId,
        name: trimmed,
      },
    },
    update: {},
    create: {
      business_id: tenantId,
      name: trimmed,
    },
  });
};

const buildItemForCreate = (payload) => {
  const normalized = sanitizeItemPayload(payload);

  return {
    item: {
      name:
        typeof normalized.name === "string" && normalized.name.trim()
          ? normalized.name.trim()
          : DEFAULT_ITEM_VALUES.name,
      category: normalizeCategory(normalized.category) ?? null,
      unit:
        typeof normalized.unit === "string" ? normalized.unit : DEFAULT_ITEM_VALUES.unit,
      item_type:
        normalized.itemType === "SERVICE" ? "SERVICE" : DEFAULT_ITEM_VALUES.itemType,
    },
    defaultVariant: {
      sku: normalizeSku(normalized.sku) ?? null,
      is_default: true,
      is_active: true,
    },
    variants: Array.isArray(normalized.variants)
      ? normalized.variants.map((variant) => sanitizeVariantPayload(variant))
      : [],
  };
};

const buildItemForUpdate = (payload) => {
  const normalized = sanitizeItemPayload(payload);
  const patch: ItemPayload & { item_type?: string } = {};
  let sku: string | null | undefined = undefined;
  let category: string | null | undefined = undefined;

  const normalizedSku = normalizeSku(normalized.sku);
  if (normalized.sku === null) {
    sku = null;
  } else if (normalizedSku !== undefined) {
    sku = normalizedSku;
  }
  if (typeof normalized.name === "string" && normalized.name.trim()) {
    patch.name = normalized.name.trim();
  }
  const normalizedCategory = normalizeCategory(normalized.category);
  if (normalized.category === null) {
    category = null;
  } else if (normalizedCategory !== undefined) {
    category = normalizedCategory;
  }
  if (typeof normalized.unit === "string") {
    patch.unit = normalized.unit;
  }
  if (normalized.itemType === "PRODUCT" || normalized.itemType === "SERVICE") {
    patch.item_type = normalized.itemType;
  }

  return {
    itemPatch: patch,
    category,
    sku,
  };
};

const toItemSnapshot = (item, defaultVariant) => {
  return {
    id: item.id,
    business_id: item.business_id,
    item_type: item.item_type,
    itemType: item.item_type,
    name: item.name,
    category: item.category ?? null,
    unit: item.unit,
    sku: defaultVariant?.sku ?? null,
    default_variant_id: defaultVariant?.id ?? null,
  };
};

const toVariantSnapshot = (
  variant,
  optionValues: Record<string, string> = {},
  usageCount = 0,
) => {
  const isLocked = usageCount > 0;
  return {
    id: variant.id,
    item_id: variant.item_id,
    itemId: variant.item_id,
    business_id: variant.business_id,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    name: variant.name ?? null,
    is_default: variant.is_default,
    isDefault: variant.is_default,
    is_active: variant.is_active,
    isActive: variant.is_active,
    option_values: optionValues,
    optionValues,
    usage_count: usageCount,
    usageCount,
    is_locked: isLocked,
    isLocked,
  };
};

const toItemCategorySnapshot = (category) => {
  return {
    id: category.id,
    business_id: category.business_id,
    name: category.name,
  };
};

const toItemCollectionSnapshot = (collection) => {
  return {
    id: collection.id,
    business_id: collection.business_id,
    name: collection.name,
  };
};

const toItemCollectionItemSnapshot = (membership) => {
  return {
    id: membership.id,
    business_id: membership.business_id,
    collection_id: membership.collection_id,
    collectionId: membership.collection_id,
    item_id: membership.item_id,
    itemId: membership.item_id,
  };
};

const getNextServerVersion = async (txAny, tenantId, entity, entityId) => {
  const latestEntityChange = await txAny.syncChangeLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
    },
    orderBy: { server_version: "desc" },
    select: { server_version: true },
  });
  return (latestEntityChange?.server_version ?? 0) + 1;
};

const appendSyncChange = async (
  txAny,
  tenantId,
  entity,
  entityId,
  operation,
  data,
) => {
  const serverVersion = await getNextServerVersion(txAny, tenantId, entity, entityId);
  await txAny.syncChangeLog.create({
    data: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
      operation,
      data,
      server_version: serverVersion,
    },
  });
};

const getDefaultVariant = async (tx, tenantId, itemId) => {
  return tx.itemVariant.findFirst({
    where: {
      item_id: itemId,
      business_id: tenantId,
      is_default: true,
    },
  });
};

const getVariantOptionValues = async (tx, variantId) => {
  const links = await tx.itemVariantOptionValue.findMany({
    where: { variant_id: variantId },
    include: {
      option_value: {
        include: {
          option: true,
        },
      },
    },
  });

  const optionValues: Record<string, string> = {};
  for (const link of links) {
    const optionName = link.option_value?.option?.name;
    const value = link.option_value?.value;
    if (optionName && value) {
      optionValues[optionName] = value;
    }
  }
  return optionValues;
};

const getVariantUsageCount = async (tx, tenantId, variantId) => {
  const txAny = tx as any;
  const stockLedgerCountPromise = tx.stockLedger.count({
    where: {
      variant_id: variantId,
      location: {
        business_id: tenantId,
      },
    },
  });

  const activityDelegate = txAny.itemActivityProjection;
  const activityCountPromise =
    activityDelegate && typeof activityDelegate.count === "function"
      ? activityDelegate
          .count({
            where: {
              business_id: tenantId,
              variant_id: variantId,
            },
          })
          .catch(() => 0)
      : Promise.resolve(0);

  const [stockLedgerCount, activityCount] = await Promise.all([
    stockLedgerCountPromise,
    activityCountPromise,
  ]);

  return stockLedgerCount + activityCount;
};

const toNullableTrimmedValue = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionValuesForCompare = (value: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, optionValue]) => [key.trim(), optionValue.trim()])
      .filter(([key, optionValue]) => key.length > 0 && optionValue.length > 0)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
};

const variantImmutableFieldsChanged = (
  current,
  currentOptionValues: Record<string, string>,
  payload: VariantPayload,
) => {
  const currentSku = toNullableTrimmedValue(current.sku);
  const currentName = toNullableTrimmedValue(current.name);
  const currentBarcode = toNullableTrimmedValue(current.barcode);

  const requestedSku = toNullableTrimmedValue(payload.sku);
  if (requestedSku !== undefined && requestedSku !== currentSku) {
    return true;
  }

  const requestedName = toNullableTrimmedValue(payload.name);
  if (requestedName !== undefined && requestedName !== currentName) {
    return true;
  }

  const requestedBarcode = toNullableTrimmedValue(payload.barcode);
  if (requestedBarcode !== undefined && requestedBarcode !== currentBarcode) {
    return true;
  }

  if (payload.optionValues !== undefined) {
    const normalizedCurrent = normalizeOptionValuesForCompare(currentOptionValues);
    const normalizedRequested = normalizeOptionValuesForCompare(payload.optionValues);
    if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedRequested)) {
      return true;
    }
  }

  return false;
};

const attachOptionValuesToVariant = async (tx, itemId, variantId, optionValues?: Record<string, string>) => {
  if (!optionValues || Object.keys(optionValues).length === 0) {
    return;
  }

  for (const [optionName, value] of Object.entries(optionValues)) {
    const option = await tx.itemOption.upsert({
      where: {
        item_id_name: {
          item_id: itemId,
          name: optionName,
        },
      },
      update: {},
      create: {
        item_id: itemId,
        name: optionName,
      },
    });

    const optionValue = await tx.itemOptionValue.upsert({
      where: {
        option_id_value: {
          option_id: option.id,
          value,
        },
      },
      update: {},
      create: {
        option_id: option.id,
        value,
      },
    });

    await tx.itemVariantOptionValue.upsert({
      where: {
        variant_id_option_value_id: {
          variant_id: variantId,
          option_value_id: optionValue.id,
        },
      },
      update: {},
      create: {
        variant_id: variantId,
        option_value_id: optionValue.id,
      },
    });
  }
};

const ensureSingleDefaultVariant = async (tx, itemId, preferredVariantId?: string) => {
  const variants = await tx.itemVariant.findMany({
    where: { item_id: itemId },
    orderBy: { id: "asc" },
    select: { id: true, is_default: true },
  });
  if (variants.length === 0) return;

  const desiredDefaultId =
    preferredVariantId ??
    variants.find((variant) => variant.is_default)?.id ??
    variants[0].id;

  await tx.itemVariant.updateMany({
    where: { item_id: itemId, id: { not: desiredDefaultId } },
    data: { is_default: false },
  });
  await tx.itemVariant.update({
    where: { id: desiredDefaultId },
    data: { is_default: true },
  });
};

const getItemSnapshot = async (tx, tenantId, itemId) => {
  const item = await tx.item.findUnique({
    where: { id: itemId },
  });
  if (!item || item.business_id !== tenantId) {
    throw new AppError("Entity not found in business", 404);
  }

  const variants = await tx.itemVariant.findMany({
    where: { item_id: itemId, business_id: tenantId },
  });

  const snapshotVariants = await Promise.all(
    variants.map(async (variant) => {
      const [optionValues, usageCount] = await Promise.all([
        getVariantOptionValues(tx, variant.id),
        getVariantUsageCount(tx, tenantId, variant.id),
      ]);
      return toVariantSnapshot(variant, optionValues, usageCount);
    }),
  );

  const defaultVariant =
    variants.find((variant) => variant.is_default) ??
    variants[0] ??
    null;

  return {
    ...toItemSnapshot(item, defaultVariant),
    variants: snapshotVariants,
    variant_count: snapshotVariants.length,
    variantCount: snapshotVariants.length,
  };
};

const getTenantCursor = async (tenantId) => {
  const latestChange = await prismaAny.syncChangeLog.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { cursor: "desc" },
    select: { cursor: true },
  });

  return latestChange?.cursor?.toString() ?? "0";
};

const applyItemMutation = async (tx, tenantId, mutation) => {
  if (mutation.op === "create") {
    const createData = buildItemForCreate(mutation.payload);
    if (createData.item.category) {
      await ensureCategoryExists(tx, tenantId, createData.item.category);
    }
    const item = await tx.item.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        ...createData.item,
      },
    });
    const variantInputs = createData.variants.filter(
      (variant) =>
        variant.sku !== undefined ||
        variant.name !== undefined ||
        variant.barcode !== undefined ||
        (variant.optionValues && Object.keys(variant.optionValues).length > 0),
    );

    const createdVariantIds: string[] = [];
    let preferredDefaultId: string | undefined;

    if (variantInputs.length === 0) {
      const defaultVariant = await tx.itemVariant.create({
        data: {
          business_id: tenantId,
          item_id: item.id,
          ...createData.defaultVariant,
        },
      });
      createdVariantIds.push(defaultVariant.id);
      preferredDefaultId = defaultVariant.id;
    } else {
      for (const variant of variantInputs) {
        const createdVariant = await tx.itemVariant.create({
          data: {
            business_id: tenantId,
            item_id: item.id,
            sku: variant.sku ?? null,
            name: variant.name?.trim() || null,
            barcode: variant.barcode?.trim() || null,
            is_default: Boolean(variant.isDefault),
            is_active: variant.isActive ?? true,
          },
        });
        createdVariantIds.push(createdVariant.id);
        if (!preferredDefaultId && variant.isDefault) {
          preferredDefaultId = createdVariant.id;
        }
        await attachOptionValuesToVariant(
          tx,
          item.id,
          createdVariant.id,
          variant.optionValues,
        );
      }
    }

    preferredDefaultId ??= createdVariantIds[0];
    await ensureSingleDefaultVariant(
      tx,
      item.id,
      preferredDefaultId,
    );

    return getItemSnapshot(tx, tenantId, item.id);
  }

  const current = await tx.item.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    throw new AppError("Entity not found in business", 404);
  }

  if (mutation.op === "delete") {
    await tx.item.delete({
      where: { id: mutation.entityId },
    });
    return null;
  }

  const { itemPatch, category, sku } = buildItemForUpdate(mutation.payload);
  const itemPatchWithCategory =
    category !== undefined ? { ...itemPatch, category } : itemPatch;
  if (typeof category === "string" && category.trim()) {
    await ensureCategoryExists(tx, tenantId, category);
  }
  let nextItem = current;

  if (Object.keys(itemPatchWithCategory).length > 0) {
    nextItem = await tx.item.update({
      where: { id: mutation.entityId },
      data: itemPatchWithCategory,
    });
  }

  let defaultVariant = await getDefaultVariant(tx, tenantId, mutation.entityId);

  if (sku !== undefined) {
    if (defaultVariant) {
      const nextSku = toNullableTrimmedValue(sku);
      const currentSku = toNullableTrimmedValue(defaultVariant.sku);
      if (nextSku !== currentSku) {
        const usageCount = await getVariantUsageCount(tx, tenantId, defaultVariant.id);
        if (usageCount > 0) {
          throw new AppError(
            "Default variant SKU is locked after usage. Create a new variant for SKU changes.",
            400,
          );
        }
      }
      defaultVariant = await tx.itemVariant.update({
        where: { id: defaultVariant.id },
        data: { sku },
      });
    } else {
      defaultVariant = await tx.itemVariant.create({
        data: {
          business_id: tenantId,
          item_id: mutation.entityId,
          sku,
          is_default: true,
          is_active: true,
        },
      });
    }
  }

  if (!defaultVariant) {
    defaultVariant = await tx.itemVariant.create({
      data: {
        business_id: tenantId,
        item_id: mutation.entityId,
        sku: null,
        is_default: true,
        is_active: true,
      },
    });
  }

  const snapshot = await getItemSnapshot(tx, tenantId, nextItem.id);
  return snapshot;
};

const applyItemVariantMutation = async (tx, tenantId, mutation) => {
  const payload = sanitizeVariantPayload(mutation.payload);

  if (mutation.op === "create") {
    if (!payload.itemId) {
      throw new AppError("itemId is required for variant create", 400);
    }

    const parentItem = await tx.item.findUnique({
      where: { id: payload.itemId },
    });
    if (!parentItem || parentItem.business_id !== tenantId) {
      throw new AppError("Item not found in business", 404);
    }

    const variant = await tx.itemVariant.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        item_id: payload.itemId,
        sku: payload.sku ?? null,
        barcode: payload.barcode?.trim() || null,
        name: payload.name?.trim() || null,
        is_default: Boolean(payload.isDefault),
        is_active: payload.isActive ?? true,
      },
    });

    await attachOptionValuesToVariant(tx, payload.itemId, variant.id, payload.optionValues);

    await ensureSingleDefaultVariant(
      tx,
      payload.itemId,
      payload.isDefault ? variant.id : undefined,
    );

    const optionValues = await getVariantOptionValues(tx, variant.id);
    const usageCount = await getVariantUsageCount(tx, tenantId, variant.id);
    return toVariantSnapshot(variant, optionValues, usageCount);
  }

  const current = await tx.itemVariant.findUnique({
    where: { id: mutation.entityId },
  });

  if (mutation.op === "delete") {
    if (!current) {
      return null;
    }
    if (current.business_id !== tenantId) {
      throw new AppError("Variant not found in business", 404);
    }
    const usageCount = await getVariantUsageCount(tx, tenantId, mutation.entityId);
    if (usageCount > 0) {
      throw new AppError(
        "Variant cannot be deleted because it has been used in transactions. Archive it instead.",
        400,
      );
    }
    await tx.itemVariant.delete({
      where: { id: mutation.entityId },
    });
    await ensureSingleDefaultVariant(tx, current.item_id);
    return null;
  }

  if (!current || current.business_id !== tenantId) {
    throw new AppError("Variant not found in business", 404);
  }

  const patch: Record<string, unknown> = {};
  if (payload.sku !== undefined) patch.sku = payload.sku;
  if (payload.name !== undefined) patch.name = payload.name?.trim() || null;
  if (payload.barcode !== undefined) patch.barcode = payload.barcode?.trim() || null;
  if (payload.isActive !== undefined) patch.is_active = payload.isActive;
  if (payload.isDefault !== undefined) patch.is_default = payload.isDefault;

  const [currentOptionValues, usageCount] = await Promise.all([
    getVariantOptionValues(tx, mutation.entityId),
    getVariantUsageCount(tx, tenantId, mutation.entityId),
  ]);
  if (usageCount > 0 && variantImmutableFieldsChanged(current, currentOptionValues, payload)) {
    throw new AppError(
      "Variant identity fields are locked after usage. Create a new variant for these changes.",
      400,
    );
  }

  const variant =
    Object.keys(patch).length > 0
      ? await tx.itemVariant.update({
          where: { id: mutation.entityId },
          data: patch,
        })
      : current;

  if (payload.optionValues) {
    await tx.itemVariantOptionValue.deleteMany({
      where: { variant_id: mutation.entityId },
    });
    await attachOptionValuesToVariant(
      tx,
      variant.item_id,
      mutation.entityId,
      payload.optionValues,
    );
  }

  if (payload.isDefault) {
    await ensureSingleDefaultVariant(tx, variant.item_id, variant.id);
  } else {
    await ensureSingleDefaultVariant(tx, variant.item_id);
  }

  const optionValues = await getVariantOptionValues(tx, variant.id);
  const nextUsageCount = await getVariantUsageCount(tx, tenantId, variant.id);
  return toVariantSnapshot(variant, optionValues, nextUsageCount);
};

const applyItemCategoryMutation = async (tx, tenantId, mutation) => {
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const payloadName = typeof payload.name === "string" ? payload.name.trim() : "";

  if (mutation.op === "create") {
    if (!payloadName) {
      throw new AppError("Category name is required", 400);
    }

    const existing = await tx.itemCategory.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
      },
    });
    if (existing) {
      throw new AppError("Category already exists", 400);
    }

    const created = await tx.itemCategory.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name: payloadName,
      },
    });
    return {
      snapshot: toItemCategorySnapshot(created),
      additionalChanges: [],
    };
  }

  const current = await tx.itemCategory.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete") {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    throw new AppError("Category not found in business", 404);
  }

  if (mutation.op === "delete") {
    const itemsWithCategory = await tx.item.findMany({
      where: {
        business_id: tenantId,
        category: current.name,
      },
      select: { id: true },
    });

    await tx.item.updateMany({
      where: {
        business_id: tenantId,
        category: current.name,
      },
      data: {
        category: null,
      },
    });

    await tx.itemCategory.delete({
      where: { id: mutation.entityId },
    });

    const additionalChanges = await Promise.all(
      itemsWithCategory.map(async (item) => ({
        entity: "item",
        entityId: item.id,
        operation: "UPDATE",
        data: await getItemSnapshot(tx, tenantId, item.id),
      })),
    );

    return {
      snapshot: null,
      additionalChanges,
    };
  }

  if (mutation.op === "update") {
    if (!payloadName) {
      throw new AppError("Category name is required", 400);
    }

    const existing = await tx.itemCategory.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        id: {
          not: current.id,
        },
      },
    });
    if (existing) {
      throw new AppError("Category already exists", 400);
    }

    const needsRename = payloadName !== current.name;
    const itemsWithCategory = needsRename
      ? await tx.item.findMany({
          where: {
            business_id: tenantId,
            category: current.name,
          },
          select: { id: true },
        })
      : [];

    if (needsRename) {
      await tx.item.updateMany({
        where: {
          business_id: tenantId,
          category: current.name,
        },
        data: {
          category: payloadName,
        },
      });
    }

    const updated = await tx.itemCategory.update({
      where: { id: mutation.entityId },
      data: {
        name: payloadName,
      },
    });

    const additionalChanges = needsRename
      ? await Promise.all(
          itemsWithCategory.map(async (item) => ({
            entity: "item",
            entityId: item.id,
            operation: "UPDATE",
            data: await getItemSnapshot(tx, tenantId, item.id),
          })),
        )
      : [];

    return {
      snapshot: toItemCategorySnapshot(updated),
      additionalChanges,
    };
  }

  throw new AppError("Unsupported operation for item category", 400);
};

const applyItemCollectionMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const payloadName = typeof payload.name === "string" ? payload.name.trim() : "";

  if (mutation.op === "create") {
    if (!payloadName) {
      throw new AppError("Collection name is required", 400);
    }

    const existing = await txAny.itemCollection.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
      },
    });
    if (existing) {
      throw new AppError("Collection already exists", 400);
    }

    const created = await txAny.itemCollection.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name: payloadName,
      },
    });
    return {
      snapshot: toItemCollectionSnapshot(created),
      additionalChanges: [],
    };
  }

  const current = await txAny.itemCollection.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete") {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    throw new AppError("Collection not found in business", 404);
  }

  if (mutation.op === "delete") {
    const memberships = await txAny.itemCollectionItem.findMany({
      where: {
        business_id: tenantId,
        collection_id: current.id,
      },
      select: { id: true },
    });

    await txAny.itemCollectionItem.deleteMany({
      where: {
        business_id: tenantId,
        collection_id: current.id,
      },
    });

    await txAny.itemCollection.delete({
      where: { id: mutation.entityId },
    });

    const additionalChanges = memberships.map((membership) => ({
      entity: "item_collection_item",
      entityId: membership.id,
      operation: "DELETE" as const,
      data: {},
    }));

    return {
      snapshot: null,
      additionalChanges,
    };
  }

  if (mutation.op === "update") {
    if (!payloadName) {
      throw new AppError("Collection name is required", 400);
    }

    const existing = await txAny.itemCollection.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        id: { not: current.id },
      },
    });
    if (existing) {
      throw new AppError("Collection already exists", 400);
    }

    const updated = await txAny.itemCollection.update({
      where: { id: mutation.entityId },
      data: {
        name: payloadName,
      },
    });

    return {
      snapshot: toItemCollectionSnapshot(updated),
      additionalChanges: [],
    };
  }

  throw new AppError("Unsupported operation for item collection", 400);
};

const applyItemCollectionItemMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const collectionId =
    typeof payload.collectionId === "string"
      ? payload.collectionId
      : typeof payload.collection_id === "string"
        ? payload.collection_id
        : "";
  const itemId =
    typeof payload.itemId === "string"
      ? payload.itemId
      : typeof payload.item_id === "string"
        ? payload.item_id
        : "";

  if (mutation.op === "create") {
    if (!collectionId || !itemId) {
      throw new AppError("collectionId and itemId are required", 400);
    }

    const [collection, item] = await Promise.all([
      txAny.itemCollection.findUnique({ where: { id: collectionId } }),
      tx.item.findUnique({ where: { id: itemId } }),
    ]);
    if (!collection || collection.business_id !== tenantId) {
      throw new AppError("Collection not found in business", 404);
    }
    if (!item || item.business_id !== tenantId) {
      throw new AppError("Item not found in business", 404);
    }

    const existing = await txAny.itemCollectionItem.findFirst({
      where: {
        business_id: tenantId,
        collection_id: collectionId,
        item_id: itemId,
      },
    });
    if (existing) {
      throw new AppError("Item is already in this collection", 400);
    }

    const created = await txAny.itemCollectionItem.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        collection_id: collectionId,
        item_id: itemId,
      },
    });
    return toItemCollectionItemSnapshot(created);
  }

  if (mutation.op === "delete") {
    const current = await txAny.itemCollectionItem.findUnique({
      where: { id: mutation.entityId },
    });
    if (!current) return null;
    if (current.business_id !== tenantId) {
      throw new AppError("Collection item link not found in business", 404);
    }
    await txAny.itemCollectionItem.delete({
      where: { id: mutation.entityId },
    });
    return null;
  }

  throw new AppError("Unsupported operation for item collection item", 400);
};

const applyMutation = async (tenantId, mutation) => {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const existing = await txAny.syncMutationLog.findUnique({
      where: { mutation_id: mutation.mutationId },
      select: { id: true },
    });

    if (existing) {
      return { status: "applied" };
    }

    let snapshot = null;
    let additionalChanges: Array<{
      entity: string;
      entityId: string;
      operation: "CREATE" | "UPDATE" | "DELETE";
      data: Record<string, unknown>;
    }> = [];
    if (mutation.entity === "item") {
      snapshot = await applyItemMutation(tx, tenantId, mutation);
    } else if (mutation.entity === "item_variant") {
      snapshot = await applyItemVariantMutation(tx, tenantId, mutation);
    } else if (mutation.entity === "item_category") {
      const categoryResult = await applyItemCategoryMutation(tx, tenantId, mutation);
      snapshot = categoryResult.snapshot;
      additionalChanges = categoryResult.additionalChanges;
    } else if (mutation.entity === "item_collection") {
      const collectionResult = await applyItemCollectionMutation(tx, tenantId, mutation);
      snapshot = collectionResult.snapshot;
      additionalChanges = collectionResult.additionalChanges;
    } else if (mutation.entity === "item_collection_item") {
      snapshot = await applyItemCollectionItemMutation(tx, tenantId, mutation);
    } else {
      throw new AppError(`Unsupported entity '${mutation.entity}'`, 400);
    }

    const operation = toPrismaSyncOperation(mutation.op);

    await txAny.syncMutationLog.create({
      data: {
        mutation_id: mutation.mutationId,
        tenant_id: tenantId,
        device_id: mutation.deviceId,
        user_id: mutation.userId,
        entity: mutation.entity,
        entity_id: mutation.entityId,
        operation,
        payload: mutation.payload,
        base_version: mutation.baseVersion,
        client_timestamp: new Date(mutation.clientTimestamp),
      },
    });

    await appendSyncChange(
      txAny,
      tenantId,
      mutation.entity,
      mutation.entityId,
      operation,
      snapshot ?? {},
    );

    for (const change of additionalChanges) {
      await appendSyncChange(
        txAny,
        tenantId,
        change.entity,
        change.entityId,
        change.operation,
        change.data,
      );
    }

    return { status: "applied" };
  });
};

const processMutations = async (tenantId, userId, mutations) => {
  const acknowledgements = [];

  for (const mutation of mutations) {
    if (!SUPPORTED_ENTITIES.has(mutation.entity)) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: `Unsupported entity '${mutation.entity}'`,
      });
      continue;
    }

    if (mutation.userId !== userId) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: "Mutation user does not match authenticated user",
      });
      continue;
    }

    try {
      const result = await applyMutation(tenantId, mutation);
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: result.status,
      });
    } catch (error) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: error instanceof Error ? error.message : "Mutation failed",
      });
    }
  }

  return {
    cursor: await getTenantCursor(tenantId),
    acknowledgements,
  };
};

const getDeltasSinceCursor = async (tenantId, cursor, limit) => {
  const parsedCursor = BigInt(cursor);

  const changes = await prismaAny.syncChangeLog.findMany({
    where: {
      tenant_id: tenantId,
      cursor: { gt: parsedCursor },
    },
    orderBy: { cursor: "asc" },
    take: limit,
  });

  const deltas = changes.map((change) => ({
    cursor: change.cursor.toString(),
    entity: change.entity,
    entityId: change.entity_id,
    op: toSyncOperation(change.operation),
    data:
      change.data && typeof change.data === "object" && !Array.isArray(change.data)
        ? change.data
        : {},
    serverVersion: change.server_version,
    serverTimestamp: change.server_timestamp.toISOString(),
  }));

  return {
    nextCursor:
      changes.length > 0
        ? changes[changes.length - 1].cursor.toString()
        : cursor,
    deltas,
  };
};

const getOptionKeys = async (tenantId: string) => {
  const optionRows = await prisma.itemOption.findMany({
    where: {
      item: {
        business_id: tenantId,
      },
    },
    select: {
      name: true,
      values: {
        select: {
          value: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const valueSetsByKey = new Map<string, Set<string>>();
  for (const row of optionRows) {
    const key = row.name.trim();
    if (!key) continue;

    const values = valueSetsByKey.get(key) ?? new Set<string>();
    for (const optionValue of row.values) {
      const value = optionValue.value.trim();
      if (value) {
        values.add(value);
      }
    }
    valueSetsByKey.set(key, values);
  }

  const optionKeys = Array.from(valueSetsByKey.keys()).sort((a, b) => a.localeCompare(b));
  const optionValuesByKey = Object.fromEntries(
    optionKeys.map((key) => {
      const values = Array.from(valueSetsByKey.get(key) ?? []).sort((a, b) =>
        a.localeCompare(b),
      );
      return [key, values];
    }),
  );

  return {
    optionKeys,
    optionValuesByKey,
  };
};

const getItemCategories = async (tenantId: string, query?: string, limit = 30) => {
  const normalizedQuery = query?.trim();
  const rows = await prismaAny.itemCategory.findMany({
    where: {
      business_id: tenantId,
      name: normalizedQuery
        ? {
            contains: normalizedQuery,
            mode: "insensitive",
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
    take: limit,
  });

  return rows
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.name.length > 0);
};

export default {
  processMutations,
  getDeltasSinceCursor,
  getOptionKeys,
  getItemCategories,
};
