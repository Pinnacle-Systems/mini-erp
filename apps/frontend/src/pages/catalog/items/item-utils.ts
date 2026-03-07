import {
  getLocalItemDetailForDisplay,
  getLocalItemsForDisplay,
  getSyncRejectionFromError,
} from "../../../features/sync/engine";

type ItemPreflightCandidate = {
  itemId?: string;
  name: string;
  variants: Array<{
    id?: string;
    sku?: string | null;
    isActive?: boolean;
  }>;
};

const normalizeComparableValue = (value: string | null | undefined) => value?.trim() ?? "";

export const toUserItemErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);

  if (
    rejection?.reasonCode === "VERSION_CONFLICT" &&
    (rejection.entity === "item" || rejection.entity === "item_variant")
  ) {
    return "This item changed on another device. Refresh and apply your edits again.";
  }

  if (
    rejection?.reasonCode === "DEPENDENCY_MISSING" &&
    (rejection.entity === "item" || rejection.entity === "item_variant")
  ) {
    return "This item is no longer available. Refresh and try again.";
  }

  if (
    rejection?.reasonCode === "VALIDATION_FAILED" &&
    (rejection.entity === "item" || rejection.entity === "item_variant")
  ) {
    return rejection.message;
  }

  if (
    rejection?.reasonCode === "ENTITY_IN_USE" &&
    (
      rejection.entity === "item" ||
      rejection.entity === "item_variant" ||
      rejection.entity === "item_category" ||
      rejection.entity === "item_collection" ||
      rejection.entity === "item_collection_item"
    )
  ) {
    return rejection.message;
  }

  if (!(error instanceof Error)) {
    return "Unable to save items right now.";
  }

  return error.message || "Unable to save items right now.";
};

export const runLocalItemPreflightChecks = async (
  tenantId: string,
  candidates: ItemPreflightCandidate[],
) => {
  const items = await getLocalItemsForDisplay(tenantId);
  const itemDetails = await Promise.all(
    items
      .filter((item) => !item.pending)
      .map(async (item) => ({
        itemId: item.entityId,
        detail: await getLocalItemDetailForDisplay(tenantId, item.entityId).catch(() => null),
      })),
  );

  const detailsByItemId = new Map(
    itemDetails.map((entry) => [entry.itemId, entry.detail]),
  );

  const reservedItemNames = new Map<string, string>();
  const reservedSkus = new Map<string, string>();

  for (const item of items) {
    const normalizedName = normalizeComparableValue(item.name);
    if (normalizedName.length > 0) {
      reservedItemNames.set(item.entityId, normalizedName);
    }

    const detail = detailsByItemId.get(item.entityId);
    if (detail) {
      for (const variant of detail.variants) {
        const normalizedSku = normalizeComparableValue(variant.sku);
        if (variant.isActive && normalizedSku.length > 0) {
          reservedSkus.set(variant.id, normalizedSku);
        }
      }
      continue;
    }

    for (const sku of item.variantSkus) {
      const normalizedSku = normalizeComparableValue(sku);
      if (normalizedSku.length > 0) {
        reservedSkus.set(`${item.entityId}:${normalizedSku}`, normalizedSku);
      }
    }
  }

  const stagedNames = new Set<string>();
  const stagedSkus = new Set<string>();

  for (const candidate of candidates) {
    const normalizedName = normalizeComparableValue(candidate.name);
    if (normalizedName.length > 0) {
      const nameConflict = Array.from(reservedItemNames.entries()).some(
        ([existingItemId, existingName]) =>
          existingName === normalizedName && existingItemId !== candidate.itemId,
      );

      if (nameConflict || stagedNames.has(normalizedName)) {
        return "Item name already exists in this business.";
      }

      stagedNames.add(normalizedName);
    }

    const seenSkusInItem = new Set<string>();

    for (const variant of candidate.variants) {
      if (variant.isActive === false) {
        continue;
      }

      const normalizedSku = normalizeComparableValue(variant.sku);
      if (normalizedSku.length === 0) {
        continue;
      }

      if (seenSkusInItem.has(normalizedSku)) {
        return "SKU must be unique within the item.";
      }
      seenSkusInItem.add(normalizedSku);

      const skuConflict = Array.from(reservedSkus.entries()).some(
        ([existingVariantId, existingSku]) =>
          existingSku === normalizedSku && existingVariantId !== variant.id,
      );

      if (skuConflict || stagedSkus.has(normalizedSku)) {
        return "SKU already exists in this business.";
      }

      stagedSkus.add(normalizedSku);
    }
  }

  return null;
};
