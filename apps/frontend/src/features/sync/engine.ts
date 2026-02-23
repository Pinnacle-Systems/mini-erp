import { apiFetch } from "../../lib/api";
import {
  applyDeltas,
  listEntities,
  queueMutation,
  syncDb,
  type EntityRecord,
  type OutboxItem,
} from "./db";
import type { PullResponse, PushResponse, SyncMutation } from "./types";

const CURSOR_KEY = "cursor";
const DEVICE_ID_KEY = "mini_erp_device_id_v1";
const isNetworkOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const getOrCreateDeviceId = () => {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
};

const getCursor = async (tenantId: string) => {
  const cursor = await syncDb.syncMeta.get([tenantId, CURSOR_KEY]);
  return cursor?.value ?? "0";
};

const setCursor = async (tenantId: string, cursor: string) => {
  await syncDb.syncMeta.put({ tenantId, key: CURSOR_KEY, value: cursor });
};

const toMutation = (item: OutboxItem): SyncMutation => ({
  mutationId: item.mutationId,
  deviceId: item.deviceId,
  userId: item.userId,
  entity: item.entity,
  entityId: item.entityId,
  op: item.op,
  payload: item.payload,
  baseVersion: item.baseVersion,
  clientTimestamp: item.clientTimestamp
});

export type VariantInput = {
  id?: string;
  itemId?: string;
  name?: string;
  sku?: string;
  barcode?: string;
  isDefault?: boolean;
  isActive?: boolean;
  optionValues?: Record<string, string>;
};

export type ItemInput = {
  sku?: string;
  name?: string;
  description?: string;
  unit?: "PCS" | "KG" | "M" | "BOX";
  itemType?: "PRODUCT" | "SERVICE";
  variants?: VariantInput[];
};

export const queueItemCreate = async (
  tenantId: string,
  userId: string,
  payload: {
    sku?: string;
    name: string;
    description: string;
    unit: "PCS" | "KG" | "M" | "BOX";
    itemType: "PRODUCT" | "SERVICE";
    variants?: VariantInput[];
  }
) => {
  const entityId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item",
    entityId,
    op: "create",
    payload,
    clientTimestamp: new Date().toISOString()
  });
};

export const queueItemUpdate = async (
  tenantId: string,
  userId: string,
  itemId: string,
  payload: ItemInput,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item",
    entityId: itemId,
    op: "update",
    payload,
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemVariantCreate = async (
  tenantId: string,
  userId: string,
  itemId: string,
  payload: VariantInput,
) => {
  const variantId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_variant",
    entityId: variantId,
    op: "create",
    payload: {
      ...payload,
      itemId,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemVariantUpdate = async (
  tenantId: string,
  userId: string,
  variantId: string,
  payload: VariantInput,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_variant",
    entityId: variantId,
    op: "update",
    payload,
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemVariantDelete = async (
  tenantId: string,
  userId: string,
  variantId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_variant",
    entityId: variantId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

const push = async (tenantId: string) => {
  if (!isNetworkOnline()) return;

  const pending = await syncDb.outbox
    .where("[tenantId+status]")
    .equals([tenantId, "pending"])
    .limit(100)
    .toArray();

  if (pending.length === 0) return;

  const response = await apiFetch("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      mutations: pending.map(toMutation)
    })
  });

  if (!response.ok) {
    throw new Error(`Push failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PushResponse;
  const now = new Date().toISOString();

  await syncDb.transaction("rw", syncDb.outbox, async () => {
    for (const ack of payload.acknowledgements) {
      const current = await syncDb.outbox.get(ack.mutationId);
      if (!current) continue;

      await syncDb.outbox.put({
        ...current,
        status: ack.status,
        error: ack.reason,
        updatedAt: now
      });
    }
  });
};

const pull = async (tenantId: string) => {
  if (!isNetworkOnline()) return;

  const cursor = await getCursor(tenantId);
  const params = new URLSearchParams({ tenantId, cursor, limit: "200" });
  const response = await apiFetch(`/api/sync/pull?${params.toString()}`, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Pull failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PullResponse;

  await syncDb.transaction("rw", syncDb.syncMeta, syncDb.entities, async () => {
    await applyDeltas(tenantId, payload.deltas);
    await setCursor(tenantId, payload.nextCursor);
  });
};

export const syncOnce = async (tenantId: string) => {
  if (!isNetworkOnline()) return;

  await push(tenantId);
  await pull(tenantId);
};

export const resetLocalSyncState = async () => {
  await syncDb.transaction(
    "rw",
    syncDb.outbox,
    syncDb.syncMeta,
    syncDb.entities,
    async () => {
      await syncDb.outbox.clear();
      await syncDb.syncMeta.clear();
      await syncDb.entities.clear();
    },
  );
};

export const resetTenantSyncState = async (tenantId: string) => {
  await syncDb.transaction(
    "rw",
    syncDb.outbox,
    syncDb.syncMeta,
    syncDb.entities,
    async () => {
      await syncDb.outbox.where("tenantId").equals(tenantId).delete();
      await syncDb.syncMeta.where("tenantId").equals(tenantId).delete();
      await syncDb.entities.where("tenantId").equals(tenantId).delete();
    },
  );
};

export const getPendingOutboxCount = async (tenantId: string) => {
  return syncDb.outbox.where("[tenantId+status]").equals([tenantId, "pending"]).count();
};

export const getLocalItems = async (tenantId: string) => {
  return listEntities(tenantId, "item");
};

export type ItemDisplay = {
  entityId: string;
  name: string;
  description: string;
  sku: string;
  variantCount: number;
  pending: boolean;
};

export type ItemVariantDisplay = {
  id: string;
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  isDefault: boolean;
  isActive: boolean;
  optionValues: Record<string, string>;
  pending: boolean;
};

export type ItemDetailDisplay = {
  id: string;
  name: string;
  description: string;
  unit: "PCS" | "KG" | "M" | "BOX";
  itemType: "PRODUCT" | "SERVICE";
  pending: boolean;
  variants: ItemVariantDisplay[];
};

const extractVariantsFromItemData = (itemData: Record<string, unknown>, itemId: string) => {
  const raw = itemData.variants;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((value) => typeof value === "object" && value !== null)
    .map((value) => {
      const variant = value as Record<string, unknown>;
      const optionValuesRaw =
        variant.optionValues && typeof variant.optionValues === "object"
          ? (variant.optionValues as Record<string, unknown>)
          : variant.option_values && typeof variant.option_values === "object"
            ? (variant.option_values as Record<string, unknown>)
            : {};
      const optionValues = Object.fromEntries(
        Object.entries(optionValuesRaw)
          .filter((entry) => typeof entry[1] === "string")
          .map(([key, optionValue]) => [key, String(optionValue)]),
      );

      return {
        id: String(variant.id ?? ""),
        itemId: String(variant.itemId ?? variant.item_id ?? itemId),
        name: String(variant.name ?? ""),
        sku: String(variant.sku ?? ""),
        barcode: String(variant.barcode ?? ""),
        isDefault: Boolean(variant.isDefault ?? variant.is_default ?? false),
        isActive: Boolean(variant.isActive ?? variant.is_active ?? true),
        optionValues,
        pending: false,
      } satisfies ItemVariantDisplay;
    })
    .filter((variant) => Boolean(variant.id));
};

const mergeVariants = (
  base: ItemVariantDisplay[],
  overlays: ItemVariantDisplay[],
): ItemVariantDisplay[] => {
  const map = new Map<string, ItemVariantDisplay>();
  for (const variant of base) {
    map.set(variant.id, variant);
  }
  for (const variant of overlays) {
    map.set(variant.id, variant);
  }

  const merged = Array.from(map.values());
  if (merged.length === 0) return merged;
  if (merged.some((variant) => variant.isDefault)) return merged;
  return merged.map((variant, index) =>
    index === 0 ? { ...variant, isDefault: true } : variant,
  );
};

export const getLocalItemsForDisplay = async (
  tenantId: string,
): Promise<ItemDisplay[]> => {
  const [entities, variantEntities, pendingCreates] = await Promise.all([
    getLocalItems(tenantId),
    listEntities(tenantId, "item_variant"),
    syncDb.outbox
      .where("[tenantId+status]")
      .equals([tenantId, "pending"])
      .filter((item) => item.entity === "item" && item.op === "create")
      .toArray(),
  ]);

  const activeVariants = variantEntities.filter((variant) => !variant.deletedAt);
  const variantsByItemId = activeVariants.reduce<Record<string, EntityRecord[]>>(
    (acc, variant) => {
      const itemId = String(variant.data.itemId ?? variant.data.item_id ?? "");
      if (!itemId) return acc;
      acc[itemId] = [...(acc[itemId] ?? []), variant];
      return acc;
    },
    {},
  );

  const confirmed = entities
    .filter((item) => !item.deletedAt)
    .map((item) => ({
      entityId: item.entityId,
      name: String(item.data.name ?? "Untitled Item"),
      description: String(item.data.description ?? ""),
      sku: (() => {
        const baseVariants = extractVariantsFromItemData(item.data, item.entityId);
        const overlayVariants = (variantsByItemId[item.entityId] ?? []).map((variant) => {
          const optionValuesRaw =
            variant.data.optionValues && typeof variant.data.optionValues === "object"
              ? (variant.data.optionValues as Record<string, unknown>)
              : variant.data.option_values && typeof variant.data.option_values === "object"
                ? (variant.data.option_values as Record<string, unknown>)
                : {};
          const optionValues = Object.fromEntries(
            Object.entries(optionValuesRaw)
              .filter((entry) => typeof entry[1] === "string")
              .map(([key, value]) => [key, String(value)]),
          );

          return {
            id: variant.entityId,
            itemId: String(variant.data.itemId ?? variant.data.item_id ?? item.entityId),
            name: String(variant.data.name ?? ""),
            sku: String(variant.data.sku ?? ""),
            barcode: String(variant.data.barcode ?? ""),
            isDefault: Boolean(variant.data.isDefault ?? variant.data.is_default ?? false),
            isActive: Boolean(variant.data.isActive ?? variant.data.is_active ?? true),
            optionValues,
            pending: false,
          } satisfies ItemVariantDisplay;
        });
        const merged = mergeVariants(baseVariants, overlayVariants);
        if (merged.length > 0) {
          const defaultVariant =
            merged.find((variant) => variant.isDefault) ?? merged[0];
          return defaultVariant.sku;
        }
        return String(item.data.sku ?? "");
      })(),
      variantCount: (() => {
        const baseVariants = extractVariantsFromItemData(item.data, item.entityId);
        const overlayVariants = (variantsByItemId[item.entityId] ?? []).map((variant) => ({
          id: variant.entityId,
          itemId: String(variant.data.itemId ?? variant.data.item_id ?? item.entityId),
          name: String(variant.data.name ?? ""),
          sku: String(variant.data.sku ?? ""),
          barcode: String(variant.data.barcode ?? ""),
          isDefault: Boolean(variant.data.isDefault ?? variant.data.is_default ?? false),
          isActive: Boolean(variant.data.isActive ?? variant.data.is_active ?? true),
          optionValues: {},
          pending: false,
        }));
        return mergeVariants(baseVariants, overlayVariants).length;
      })(),
      pending: false,
    }));

  const confirmedByEntityId = new Set(confirmed.map((item) => item.entityId));

  const pendingOnly = pendingCreates
    .filter((item) => !confirmedByEntityId.has(item.entityId))
    .map((item) => {
      const payload = item.payload as {
        sku?: unknown;
        name?: unknown;
        description?: unknown;
        variants?: unknown;
      };
      const variants = Array.isArray(payload.variants)
        ? payload.variants.filter((value) => typeof value === "object" && value !== null)
        : [];
      const defaultVariant =
        variants.find(
          (variant) =>
            "isDefault" in variant &&
            Boolean((variant as { isDefault?: unknown }).isDefault),
        ) ?? variants[0];
      const variantSku =
        defaultVariant &&
        typeof (defaultVariant as { sku?: unknown }).sku === "string"
          ? String((defaultVariant as { sku?: unknown }).sku)
          : "";
      return {
        entityId: item.entityId,
        name: String(payload.name ?? "Untitled Item"),
        description: String(payload.description ?? ""),
        sku: variantSku || String(payload.sku ?? ""),
        variantCount: variants.length,
        pending: true,
      };
    });

  return [...pendingOnly, ...confirmed];
};

export const getLocalItemDetailForDisplay = async (
  tenantId: string,
  itemId: string,
): Promise<ItemDetailDisplay | null> => {
  const [item, variantEntities] = await Promise.all([
    syncDb.entities.get([tenantId, "item", itemId]),
    listEntities(tenantId, "item_variant"),
  ]);

  if (!item || item.deletedAt) return null;

  const variantRows = variantEntities
    .filter((variant) => !variant.deletedAt)
    .filter(
      (variant) =>
        String(variant.data.itemId ?? variant.data.item_id ?? "") === item.entityId,
    )
    .map((variant) => {
      const optionValuesRaw =
        variant.data.optionValues && typeof variant.data.optionValues === "object"
          ? (variant.data.optionValues as Record<string, unknown>)
          : variant.data.option_values && typeof variant.data.option_values === "object"
            ? (variant.data.option_values as Record<string, unknown>)
            : {};
      const optionValues = Object.fromEntries(
        Object.entries(optionValuesRaw)
          .filter((entry) => typeof entry[1] === "string")
          .map(([key, value]) => [key, String(value)]),
      );

      return {
        id: variant.entityId,
        itemId: String(variant.data.itemId ?? variant.data.item_id ?? item.entityId),
        name: String(variant.data.name ?? ""),
        sku: String(variant.data.sku ?? ""),
        barcode: String(variant.data.barcode ?? ""),
        isDefault: Boolean(variant.data.isDefault ?? variant.data.is_default ?? false),
        isActive: Boolean(variant.data.isActive ?? variant.data.is_active ?? true),
        optionValues,
        pending: false,
      } satisfies ItemVariantDisplay;
    });

  const fallbackFromItem = extractVariantsFromItemData(item.data, item.entityId);
  const mergedVariants = mergeVariants(fallbackFromItem, variantRows);
  const variants =
    mergedVariants.length > 0
      ? mergedVariants
      : [
          {
            id: `temp-${item.entityId}`,
            itemId: item.entityId,
            name: "",
            sku: String(item.data.sku ?? ""),
            barcode: "",
            isDefault: true,
            isActive: true,
            optionValues: {},
            pending: false,
          } satisfies ItemVariantDisplay,
        ];

  return {
    id: item.entityId,
    name: String(item.data.name ?? "Untitled Item"),
    description: String(item.data.description ?? ""),
    unit: String(item.data.unit ?? "PCS") as "PCS" | "KG" | "M" | "BOX",
    itemType: String(item.data.itemType ?? item.data.item_type ?? "PRODUCT") as
      | "PRODUCT"
      | "SERVICE",
    pending: false,
    variants,
  };
};

export const getLocalItemLabels = async (tenantId: string) => {
  const items = await getLocalItemsForDisplay(tenantId);
  return items.map((item) => {
    const pendingSuffix = item.pending ? " (pending sync)" : "";
    return `${item.sku}: ${item.name}${pendingSuffix}`;
  });
};
