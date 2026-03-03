import { apiFetch } from "../../lib/api";
import { selectStore } from "../auth/client";
import { useSessionStore } from "../auth/session-business";
import {
  applyDeltas,
  listEntities,
  queueMutation,
  syncDb,
  type EntityRecord,
  type OutboxItem,
} from "./db";
import type {
  PullResponse,
  PushResponse,
  SyncMutation,
  SyncRejection,
} from "./types";

const CURSOR_KEY = "cursor";
const DEVICE_ID_KEY = "mini_erp_device_id_v1";
const isNetworkOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const isSyncRejection = (value: unknown): value is SyncRejection =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  value.status === "rejected" &&
  "reasonCode" in value &&
  typeof value.reasonCode === "string" &&
  "message" in value &&
  typeof value.message === "string";

const isRejectedAck = (ack: PushResponse["acknowledgements"][number]): ack is SyncRejection =>
  ack.status === "rejected";

export class SyncRejectedError extends Error {
  rejection: SyncRejection;

  constructor(rejection: SyncRejection) {
    super(rejection.message);
    this.name = "SyncRejectedError";
    this.rejection = rejection;
  }
}

export const getSyncRejectionFromError = (
  error: unknown,
): SyncRejection | null => {
  if (error instanceof SyncRejectedError) {
    return error.rejection;
  }
  if (isSyncRejection(error)) {
    return error;
  }
  return null;
};

const ensureOnlineLicenseValidation = async (tenantId: string) => {
  if (!isNetworkOnline()) return;

  const sessionState = useSessionStore.getState();
  const needsValidation = sessionState.pendingOnlineLicenseValidationByStore[tenantId];
  if (!needsValidation) return;

  const result = await selectStore(tenantId);
  useSessionStore.getState().setActiveBusinessModules(result.modules ?? null);
  useSessionStore.getState().setStoreNeedsOnlineLicenseValidation(tenantId, false);
};

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
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  isActive?: boolean;
  optionValues?: Record<string, string>;
};

export type ItemInput = {
  name?: string;
  category?: string | null;
  unit?:
    | "PCS"
    | "UNIT"
    | "SET"
    | "PAIR"
    | "PACK"
    | "BOX"
    | "CARTON"
    | "BAGS"
    | "BOTTLES"
    | "CANS"
    | "ROLL"
    | "SHEET"
    | "JOB"
    | "VISIT"
    | "SESSION"
    | "HOUR"
    | "DAY"
    | "GRAM"
    | "KG"
    | "MILLILITRE"
    | "LITRE"
    | "MM"
    | "CM"
    | "M"
    | "FEET"
    | "INCH";
  itemType?: "PRODUCT" | "SERVICE";
  variants?: VariantInput[];
};

export type CustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNo?: string;
};

const toOptionalCustomerValue = (value: string | undefined) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toCustomerPayload = (input: CustomerInput) => ({
  name: input.name.trim(),
  ...(input.phone !== undefined ? { phone: toOptionalCustomerValue(input.phone) } : {}),
  ...(input.email !== undefined ? { email: toOptionalCustomerValue(input.email) } : {}),
  ...(input.address !== undefined ? { address: toOptionalCustomerValue(input.address) } : {}),
  ...(input.gstNo !== undefined ? { gstNo: toOptionalCustomerValue(input.gstNo) } : {}),
});

export const queueCustomerCreate = async (
  tenantId: string,
  userId: string,
  payload: CustomerInput,
  entityId = crypto.randomUUID(),
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "customer",
    entityId,
    op: "create",
    payload: toCustomerPayload(payload),
    clientTimestamp: new Date().toISOString(),
  });
  return entityId;
};

export const queueCustomerUpdate = async (
  tenantId: string,
  userId: string,
  customerId: string,
  payload: CustomerInput,
  baseVersion?: number,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "customer",
    entityId: customerId,
    op: "update",
    payload: toCustomerPayload(payload),
    ...(typeof baseVersion === "number" ? { baseVersion } : {}),
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueCustomerDelete = async (
  tenantId: string,
  userId: string,
  customerId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "customer",
    entityId: customerId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueSupplierCreate = async (
  tenantId: string,
  userId: string,
  payload: CustomerInput,
  entityId = crypto.randomUUID(),
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "supplier",
    entityId,
    op: "create",
    payload: toCustomerPayload(payload),
    clientTimestamp: new Date().toISOString(),
  });
  return entityId;
};

export const queueSupplierUpdate = async (
  tenantId: string,
  userId: string,
  supplierId: string,
  payload: CustomerInput,
  baseVersion?: number,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "supplier",
    entityId: supplierId,
    op: "update",
    payload: toCustomerPayload(payload),
    ...(typeof baseVersion === "number" ? { baseVersion } : {}),
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueSupplierDelete = async (
  tenantId: string,
  userId: string,
  supplierId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "supplier",
    entityId: supplierId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCreate = async (
  tenantId: string,
  userId: string,
  payload: {
    name: string;
    category?: string;
    unit:
      | "PCS"
      | "UNIT"
      | "SET"
      | "PAIR"
      | "PACK"
      | "BOX"
      | "CARTON"
      | "BAGS"
      | "BOTTLES"
      | "CANS"
      | "ROLL"
      | "SHEET"
      | "JOB"
      | "VISIT"
      | "SESSION"
      | "HOUR"
      | "DAY"
      | "GRAM"
      | "KG"
      | "MILLILITRE"
      | "LITRE"
      | "MM"
      | "CM"
      | "M"
      | "FEET"
      | "INCH";
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
        error: isRejectedAck(ack) ? ack.message : undefined,
        rejection: isRejectedAck(ack) ? ack : undefined,
        updatedAt: now
      });
    }
  });

  const rejectedAcks = payload.acknowledgements.filter(isRejectedAck);

  return rejectedAcks;
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
  await ensureOnlineLicenseValidation(tenantId);

  const rejectedAcks = (await push(tenantId)) ?? [];
  await pull(tenantId);
  if (rejectedAcks.length > 0) {
    throw new SyncRejectedError(rejectedAcks[0]);
  }
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
  sku: string;
  category: string;
  itemType: "PRODUCT" | "SERVICE";
  isActive: boolean;
  variantSkus: string[];
  variantCount: number;
  pending: boolean;
};

export type ItemVariantDisplay = {
  id: string;
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  isActive: boolean;
  optionValues: Record<string, string>;
  usageCount: number;
  isLocked: boolean;
  pending: boolean;
};

export type ItemDetailDisplay = {
  id: string;
  name: string;
  category: string;
  unit:
    | "PCS"
    | "UNIT"
    | "SET"
    | "PAIR"
    | "PACK"
    | "BOX"
    | "CARTON"
    | "BAGS"
    | "BOTTLES"
    | "CANS"
    | "ROLL"
    | "SHEET"
    | "JOB"
    | "VISIT"
    | "SESSION"
    | "HOUR"
    | "DAY"
    | "GRAM"
    | "KG"
    | "MILLILITRE"
    | "LITRE"
    | "MM"
    | "CM"
    | "M"
    | "FEET"
    | "INCH";
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
          : {};
      const optionValues = Object.fromEntries(
        Object.entries(optionValuesRaw)
          .filter((entry) => typeof entry[1] === "string")
          .map(([key, optionValue]) => [key, String(optionValue)]),
      );

      return {
        id: String(variant.id ?? ""),
        itemId: String(variant.itemId ?? itemId),
        name: String(variant.name ?? ""),
        sku: String(variant.sku ?? ""),
        barcode: String(variant.barcode ?? ""),
        isActive: Boolean(variant.isActive ?? true),
        optionValues,
        usageCount: Number(variant.usageCount ?? 0),
        isLocked: Boolean(variant.isLocked ?? false),
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

  return Array.from(map.values());
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
  const deletedVariantIdsByItemId = variantEntities
    .filter((variant) => Boolean(variant.deletedAt))
    .reduce<Record<string, Set<string>>>((acc, variant) => {
      const itemId = String(variant.data.itemId ?? "");
      if (!itemId) return acc;
      const ids = acc[itemId] ?? new Set<string>();
      ids.add(variant.entityId);
      acc[itemId] = ids;
      return acc;
    }, {});
  const variantsByItemId = activeVariants.reduce<Record<string, EntityRecord[]>>(
    (acc, variant) => {
      const itemId = String(variant.data.itemId ?? "");
      if (!itemId) return acc;
      acc[itemId] = [...(acc[itemId] ?? []), variant];
      return acc;
    },
    {},
  );

  const confirmed = entities
    .filter((item) => !item.deletedAt)
    .map((item) => {
      const deletedVariantIds = deletedVariantIdsByItemId[item.entityId] ?? new Set<string>();
      const baseVariants = extractVariantsFromItemData(item.data, item.entityId).filter(
        (variant) => !deletedVariantIds.has(variant.id),
      );
      const overlayVariants = (variantsByItemId[item.entityId] ?? []).map((variant) => {
        const optionValuesRaw =
          variant.data.optionValues && typeof variant.data.optionValues === "object"
            ? (variant.data.optionValues as Record<string, unknown>)
            : {};
        const optionValues = Object.fromEntries(
          Object.entries(optionValuesRaw)
            .filter((entry) => typeof entry[1] === "string")
            .map(([key, value]) => [key, String(value)]),
        );

        return {
          id: variant.entityId,
          itemId: String(variant.data.itemId ?? item.entityId),
          name: String(variant.data.name ?? ""),
          sku: String(variant.data.sku ?? ""),
          barcode: String(variant.data.barcode ?? ""),
          isActive: Boolean(variant.data.isActive ?? true),
          optionValues,
          usageCount: Number(variant.data.usageCount ?? 0),
          isLocked: Boolean(variant.data.isLocked ?? false),
          pending: false,
        } satisfies ItemVariantDisplay;
      });

      const mergedVariants = mergeVariants(baseVariants, overlayVariants);
      const variants =
        mergedVariants.length > 0
          ? mergedVariants
          : [
              {
                id: `temp-${item.entityId}`,
                itemId: item.entityId,
                name: "",
                sku: "",
                barcode: "",
                isActive: true,
                optionValues: {},
                usageCount: 0,
                isLocked: false,
                pending: false,
              } satisfies ItemVariantDisplay,
            ];
      const variantSkus = variants
        .map((variant) => variant.sku.trim())
        .filter((sku) => sku.length > 0);
      const primarySku = variants[0]?.sku ?? "";
      const isActive = variants.some((variant) => variant.isActive);

      return {
        entityId: item.entityId,
        name: String(item.data.name ?? "Untitled Item"),
        sku: primarySku,
        category: String(item.data.category ?? ""),
        itemType: String(item.data.itemType ?? "PRODUCT") as
          | "PRODUCT"
          | "SERVICE",
        isActive,
        variantSkus,
        variantCount: variants.length,
        pending: false,
      } satisfies ItemDisplay;
    });

  const confirmedByEntityId = new Set(confirmed.map((item) => item.entityId));

  const pendingOnly = pendingCreates
    .filter((item) => !confirmedByEntityId.has(item.entityId))
    .map((item) => {
      const payload = item.payload as {
        name?: unknown;
        category?: unknown;
        variants?: unknown;
      };
      const variants = Array.isArray(payload.variants)
        ? payload.variants.filter((value) => typeof value === "object" && value !== null)
        : [];
      const variantSku =
        variants.length > 0 && typeof (variants[0] as { sku?: unknown }).sku === "string"
          ? String((variants[0] as { sku?: unknown }).sku)
          : "";
      const variantSkus = variants
        .map((variant) => {
          const sku = (variant as { sku?: unknown }).sku;
          return typeof sku === "string" ? sku.trim() : "";
        })
        .filter((sku) => sku.length > 0);
      const isActive =
        variants.length === 0 ||
        variants.some((variant) => (variant as { isActive?: unknown }).isActive !== false);
      return {
        entityId: item.entityId,
        name: String(payload.name ?? "Untitled Item"),
        sku: variantSku,
        category: String(payload.category ?? ""),
        isActive,
        variantSkus,
        variantCount: Math.max(variants.length, 1),
        pending: true,
      } satisfies ItemDisplay;
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
    .filter((variant) => String(variant.data.itemId ?? "") === item.entityId)
    .map((variant) => {
      const optionValuesRaw =
        variant.data.optionValues && typeof variant.data.optionValues === "object"
          ? (variant.data.optionValues as Record<string, unknown>)
          : {};
      const optionValues = Object.fromEntries(
        Object.entries(optionValuesRaw)
          .filter((entry) => typeof entry[1] === "string")
          .map(([key, value]) => [key, String(value)]),
      );

      return {
        id: variant.entityId,
        itemId: String(variant.data.itemId ?? item.entityId),
        name: String(variant.data.name ?? ""),
        sku: String(variant.data.sku ?? ""),
        barcode: String(variant.data.barcode ?? ""),
        isActive: Boolean(variant.data.isActive ?? true),
        optionValues,
        usageCount: Number(variant.data.usageCount ?? 0),
        isLocked: Boolean(variant.data.isLocked ?? false),
        pending: false,
      } satisfies ItemVariantDisplay;
    });

  const deletedVariantIds = new Set(
    variantEntities
      .filter((variant) => Boolean(variant.deletedAt))
      .filter((variant) => String(variant.data.itemId ?? "") === item.entityId)
      .map((variant) => variant.entityId),
  );
  const fallbackFromItem = extractVariantsFromItemData(item.data, item.entityId).filter(
    (variant) => !deletedVariantIds.has(variant.id),
  );
  const mergedVariants = mergeVariants(fallbackFromItem, variantRows);
  const variants =
    mergedVariants.length > 0
      ? mergedVariants
      : [
          {
            id: `temp-${item.entityId}`,
            itemId: item.entityId,
            name: "",
            sku: "",
            barcode: "",
            isActive: true,
            optionValues: {},
            usageCount: 0,
            isLocked: false,
            pending: false,
          } satisfies ItemVariantDisplay,
        ];

  return {
    id: item.entityId,
    name: String(item.data.name ?? "Untitled Item"),
    category: String(item.data.category ?? ""),
    unit: String(item.data.unit ?? "PCS") as
      | "PCS"
      | "UNIT"
      | "SET"
      | "PAIR"
      | "PACK"
      | "BOX"
      | "CARTON"
      | "BAGS"
      | "BOTTLES"
      | "CANS"
      | "ROLL"
      | "SHEET"
      | "JOB"
      | "VISIT"
      | "SESSION"
      | "HOUR"
      | "DAY"
      | "GRAM"
      | "KG"
      | "MILLILITRE"
      | "LITRE"
      | "MM"
      | "CM"
      | "M"
      | "FEET"
      | "INCH",
    itemType: String(item.data.itemType ?? "PRODUCT") as
      | "PRODUCT"
      | "SERVICE",
    pending: false,
    variants,
  };
};

export const getLocalItemLabels = async (tenantId: string) => {
  const items = await getLocalItemsForDisplay(tenantId);
  return items.map((item) => `${item.sku}: ${item.name}`);
};

export type CustomerRow = {
  entityId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstNo: string;
  isActive: boolean;
  deletedAt: string | null;
  serverVersion: number;
  pending: boolean;
};

export type SupplierRow = CustomerRow;

const readCustomerText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const readEntityIsActive = (record: EntityRecord) =>
  typeof record.data.isActive === "boolean"
    ? Boolean(record.data.isActive)
    : !record.deletedAt;

const readEntityDeletedAt = (record: EntityRecord) =>
  typeof record.data.deletedAt === "string"
    ? record.data.deletedAt
    : record.deletedAt ?? null;

const toCustomerRowFromEntity = (record: EntityRecord): CustomerRow => ({
  entityId: record.entityId,
  name: readCustomerText(record.data.name) || "Untitled Customer",
  phone: readCustomerText(record.data.phone),
  email: readCustomerText(record.data.email),
  address: readCustomerText(record.data.address),
  gstNo: readCustomerText(record.data.gstNo),
  isActive: readEntityIsActive(record),
  deletedAt: readEntityDeletedAt(record),
  serverVersion: record.serverVersion ?? 0,
  pending: false,
});

const toSupplierRowFromEntity = (record: EntityRecord): SupplierRow => ({
  ...toCustomerRowFromEntity(record),
  name: readCustomerText(record.data.name) || "Untitled Supplier",
});

const applyCustomerPayloadToRow = (
  current: CustomerRow,
  payload: Record<string, unknown>,
  pending: boolean,
): CustomerRow => ({
  ...current,
  name:
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : current.name,
  phone:
    payload.phone === null
      ? ""
      : typeof payload.phone === "string"
        ? payload.phone.trim()
        : current.phone,
  email:
    payload.email === null
      ? ""
      : typeof payload.email === "string"
        ? payload.email.trim()
        : current.email,
  address:
    payload.address === null
      ? ""
      : typeof payload.address === "string"
        ? payload.address.trim()
        : current.address,
  gstNo:
    payload.gstNo === null
      ? ""
      : typeof payload.gstNo === "string"
        ? payload.gstNo.trim()
        : current.gstNo,
  isActive:
    typeof payload.isActive === "boolean" ? Boolean(payload.isActive) : current.isActive,
  deletedAt:
    typeof payload.deletedAt === "string"
      ? payload.deletedAt
      : payload.deletedAt === null
        ? null
        : current.deletedAt,
  pending,
});

const buildPendingCustomerRow = (
  entityId: string,
  payload: Record<string, unknown>,
): CustomerRow =>
  applyCustomerPayloadToRow(
    {
      entityId,
      name: "Untitled Customer",
      phone: "",
      email: "",
      address: "",
      gstNo: "",
      isActive: true,
      deletedAt: null,
      serverVersion: 0,
      pending: true,
    },
    payload,
    true,
  );

const buildPendingSupplierRow = (
  entityId: string,
  payload: Record<string, unknown>,
): SupplierRow => ({
  ...buildPendingCustomerRow(entityId, payload),
  name:
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : "Untitled Supplier",
});

export const getLocalCustomers = async (tenantId: string): Promise<CustomerRow[]> => {
  const [customerEntities, pendingMutations] = await Promise.all([
    listEntities(tenantId, "customer"),
    syncDb.outbox
      .where("[tenantId+status]")
      .equals([tenantId, "pending"])
      .filter((item) => item.entity === "customer")
      .toArray(),
  ]);

  const customersById = new Map<string, CustomerRow>();

  for (const record of customerEntities) {
    if (record.deletedAt) continue;
    customersById.set(record.entityId, toCustomerRowFromEntity(record));
  }

  for (const mutation of pendingMutations) {
    if (mutation.op === "delete") {
      customersById.delete(mutation.entityId);
      continue;
    }

    const payload =
      mutation.payload && typeof mutation.payload === "object"
        ? (mutation.payload as Record<string, unknown>)
        : {};
    const current = customersById.get(mutation.entityId);

    if (mutation.op === "create") {
      customersById.set(
        mutation.entityId,
        current
          ? applyCustomerPayloadToRow(current, payload, true)
          : buildPendingCustomerRow(mutation.entityId, payload),
      );
      continue;
    }

    customersById.set(
      mutation.entityId,
      current
        ? applyCustomerPayloadToRow(current, payload, true)
        : buildPendingCustomerRow(mutation.entityId, payload),
    );
  }

  return Array.from(customersById.values()).sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;
    return left.entityId.localeCompare(right.entityId);
  });
};

export const getLocalSuppliers = async (tenantId: string): Promise<SupplierRow[]> => {
  const [supplierEntities, pendingMutations] = await Promise.all([
    listEntities(tenantId, "supplier"),
    syncDb.outbox
      .where("[tenantId+status]")
      .equals([tenantId, "pending"])
      .filter((item) => item.entity === "supplier")
      .toArray(),
  ]);

  const suppliersById = new Map<string, SupplierRow>();

  for (const record of supplierEntities) {
    if (record.deletedAt) continue;
    suppliersById.set(record.entityId, toSupplierRowFromEntity(record));
  }

  for (const mutation of pendingMutations) {
    if (mutation.op === "delete") {
      suppliersById.delete(mutation.entityId);
      continue;
    }

    const payload =
      mutation.payload && typeof mutation.payload === "object"
        ? (mutation.payload as Record<string, unknown>)
        : {};
    const current = suppliersById.get(mutation.entityId);

    if (mutation.op === "create") {
      suppliersById.set(
        mutation.entityId,
        current
          ? applyCustomerPayloadToRow(current, payload, true)
          : buildPendingSupplierRow(mutation.entityId, payload),
      );
      continue;
    }

    suppliersById.set(
      mutation.entityId,
      current
        ? applyCustomerPayloadToRow(current, payload, true)
        : buildPendingSupplierRow(mutation.entityId, payload),
    );
  }

  return Array.from(suppliersById.values()).sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;
    return left.entityId.localeCompare(right.entityId);
  });
};

export type OptionDiscovery = {
  optionKeys: string[];
  optionValuesByKey: Record<string, string[]>;
};

export type ItemCategoryEntry = {
  id: string;
  name: string;
};

export type ItemCollectionEntry = {
  id: string;
  name: string;
};

export type ItemCollectionMembership = {
  id: string;
  collectionId: string;
  variantId: string;
  itemId: string;
  variantName?: string;
  variantSku?: string;
  variantIsActive?: boolean;
};

export type ItemPricingRow = {
  variantId: string;
  itemId: string;
  itemName: string;
  itemType: "PRODUCT" | "SERVICE";
  itemCategory: string;
  unit: string;
  variantName: string;
  sku: string;
  isDefaultVariant: boolean;
  isActive: boolean;
  amount: number | null;
  currency: string;
  updatedAt: string | null;
  serverVersion: number;
  pending: boolean;
};

export type StockVariantOption = {
  variantId: string;
  itemId: string;
  label: string;
  sku: string;
  unit: string;
};

export type StockAdjustmentReason =
  | "OPENING_BALANCE"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE";

export type StockLevelRow = {
  entityId: string;
  variantId: string;
  itemId: string;
  itemName: string;
  variantName: string;
  sku: string;
  unit: string;
  quantityOnHand: number;
};

export type StockAdjustmentHistoryRow = {
  entityId: string;
  variantId: string;
  itemId: string;
  itemName: string;
  variantName: string;
  sku: string;
  unit: string;
  quantity: number;
  reason: StockAdjustmentReason;
  quantityOnHand: number;
  createdAt: string;
};

export const queueItemCategoryCreate = async (
  tenantId: string,
  userId: string,
  name: string,
) => {
  const entityId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_category",
    entityId,
    op: "create",
    payload: {
      name,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCategoryDelete = async (
  tenantId: string,
  userId: string,
  categoryId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_category",
    entityId: categoryId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCollectionCreate = async (
  tenantId: string,
  userId: string,
  name: string,
) => {
  const entityId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_collection",
    entityId,
    op: "create",
    payload: {
      name,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCollectionUpdate = async (
  tenantId: string,
  userId: string,
  collectionId: string,
  name: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_collection",
    entityId: collectionId,
    op: "update",
    payload: {
      name,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCollectionDelete = async (
  tenantId: string,
  userId: string,
  collectionId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_collection",
    entityId: collectionId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCollectionMembershipCreate = async (
  tenantId: string,
  userId: string,
  collectionId: string,
  variantId: string,
) => {
  const entityId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_collection_item",
    entityId,
    op: "create",
    payload: {
      collectionId,
      variantId,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCollectionMembershipDelete = async (
  tenantId: string,
  userId: string,
  membershipId: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_collection_item",
    entityId: membershipId,
    op: "delete",
    payload: {},
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemCategoryUpdate = async (
  tenantId: string,
  userId: string,
  categoryId: string,
  name: string,
) => {
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_category",
    entityId: categoryId,
    op: "update",
    payload: {
      name,
    },
    clientTimestamp: new Date().toISOString(),
  });
};

export const queueItemPriceUpsert = async (
  tenantId: string,
  userId: string,
  variantId: string,
  amount: number | null,
  currency?: string,
  baseVersion?: number,
) => {
  const mutationId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId,
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "item_price",
    entityId: variantId,
    op: "update",
    payload: {
      variantId,
      amount,
      ...(currency ? { currency } : {}),
    },
    ...(typeof baseVersion === "number" ? { baseVersion } : {}),
    clientTimestamp: new Date().toISOString(),
  });
  return mutationId;
};

export const queueStockAdjustmentCreate = async (
  tenantId: string,
  userId: string,
  input: {
    variantId: string;
    quantity: number;
    reason: StockAdjustmentReason;
  },
) => {
  const mutationId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId,
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "stock_adjustment",
    entityId: crypto.randomUUID(),
    op: "create",
    payload: {
      variantId: input.variantId,
      quantity: input.quantity,
      reason: input.reason,
    },
    clientTimestamp: new Date().toISOString(),
  });
  return mutationId;
};

export const getOutboxItemsByMutationIds = async (mutationIds: string[]) => {
  if (mutationIds.length === 0) return [];
  const entries = await syncDb.outbox.bulkGet(mutationIds);
  return entries.filter((entry): entry is OutboxItem => Boolean(entry));
};

export const getLocalStockVariantOptions = async (
  tenantId: string,
): Promise<StockVariantOption[]> => {
  const [itemRecords, variantEntities] = await Promise.all([
    getLocalItems(tenantId),
    listEntities(tenantId, "item_variant"),
  ]);
  const activeVariants = variantEntities.filter((variant) => !variant.deletedAt);
  const deletedVariantIdsByItemId = variantEntities
    .filter((variant) => Boolean(variant.deletedAt))
    .reduce<Record<string, Set<string>>>((acc, variant) => {
      const itemId = String(variant.data.itemId ?? "");
      if (!itemId) return acc;
      const ids = acc[itemId] ?? new Set<string>();
      ids.add(variant.entityId);
      acc[itemId] = ids;
      return acc;
    }, {});
  const variantsByItemId = activeVariants.reduce<Record<string, EntityRecord[]>>(
    (acc, variant) => {
      const itemId = String(variant.data.itemId ?? "");
      if (!itemId) return acc;
      acc[itemId] = [...(acc[itemId] ?? []), variant];
      return acc;
    },
    {},
  );
  const options = itemRecords
    .filter((record) => !record.deletedAt)
    .flatMap((record) => {
      const deletedVariantIds = deletedVariantIdsByItemId[record.entityId] ?? new Set<string>();
      const itemName = String(record.data.name ?? "").trim();
      const baseVariants = extractVariantsFromItemData(record.data, record.entityId).filter(
        (variant) => !deletedVariantIds.has(variant.id),
      );
      const overlayVariants = (variantsByItemId[record.entityId] ?? []).map((variant) => {
        const optionValuesRaw =
          variant.data.optionValues && typeof variant.data.optionValues === "object"
            ? (variant.data.optionValues as Record<string, unknown>)
            : {};
        const optionValues = Object.fromEntries(
          Object.entries(optionValuesRaw)
            .filter((entry) => typeof entry[1] === "string")
            .map(([key, value]) => [key, String(value)]),
        );

        return {
          id: variant.entityId,
          itemId: String(variant.data.itemId ?? record.entityId),
          name: String(variant.data.name ?? ""),
          sku: String(variant.data.sku ?? ""),
          barcode: String(variant.data.barcode ?? ""),
          isActive: Boolean(variant.data.isActive ?? true),
          optionValues,
          usageCount: Number(variant.data.usageCount ?? 0),
          isLocked: Boolean(variant.data.isLocked ?? false),
          pending: false,
        } satisfies ItemVariantDisplay;
      });
      return mergeVariants(baseVariants, overlayVariants)
        .filter((variant) => variant.isActive)
        .map((variant) => {
          const suffix = variant.sku
            ? ` (${variant.sku})`
            : variant.name
              ? ` (${variant.name})`
              : "";
          return {
            variantId: variant.id,
            itemId: variant.itemId,
            label: `${itemName || "Untitled Item"}${suffix}`,
            sku: variant.sku,
            unit: String(record.data.unit ?? "PCS"),
          } satisfies StockVariantOption;
        });
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  return options;
};

export const getLocalStockLevels = async (
  tenantId: string,
): Promise<StockLevelRow[]> => {
  const records = await listEntities(tenantId, "stock_level");
  return records
    .filter((record) => !record.deletedAt)
    .map((record) => {
      const data = record.data;
      return {
        entityId: record.entityId,
        variantId: String(data.variantId ?? ""),
        itemId: String(data.itemId ?? ""),
        itemName: String(data.itemName ?? "Untitled Item"),
        variantName: String(data.variantName ?? ""),
        sku: String(data.sku ?? ""),
        unit: String(data.unit ?? "PCS"),
        quantityOnHand: Number(data.quantityOnHand ?? 0),
      } satisfies StockLevelRow;
    })
    .filter((row) => row.variantId)
    .sort((left, right) => left.itemName.localeCompare(right.itemName));
};

export const getLocalStockAdjustmentHistory = async (
  tenantId: string,
): Promise<StockAdjustmentHistoryRow[]> => {
  const [records, variantOptions, stockLevels] = await Promise.all([
    listEntities(tenantId, "stock_adjustment"),
    getLocalStockVariantOptions(tenantId),
    getLocalStockLevels(tenantId),
  ]);

  const optionByVariantId = new Map(
    variantOptions.map((option) => [option.variantId, option] as const),
  );
  const stockLevelByVariantId = new Map(
    stockLevels.map((row) => [row.variantId, row] as const),
  );

  return records
    .filter((record) => !record.deletedAt)
    .map((record) => {
      const data = record.data;
      const variantId = String(data.variantId ?? "");
      const option = optionByVariantId.get(variantId);
      const stockLevel = stockLevelByVariantId.get(variantId);
      const quantity = Number(data.quantity ?? 0);
      const rawCreatedAt = String(data.createdAt ?? record.updatedAt);
      const label = option?.label ?? stockLevel?.itemName ?? "Unknown item";
      const fallbackItemName = label.replace(/\s+\([^)]*\)\s*$/, "").trim();

      return {
        entityId: record.entityId,
        variantId,
        itemId: String(data.itemId ?? option?.itemId ?? stockLevel?.itemId ?? ""),
        itemName: (stockLevel?.itemName ?? fallbackItemName) || label,
        variantName: stockLevel?.variantName ?? "",
        sku: option?.sku ?? stockLevel?.sku ?? "",
        unit: option?.unit ?? stockLevel?.unit ?? "PCS",
        quantity,
        reason: String(data.reason ?? "OPENING_BALANCE") as StockAdjustmentReason,
        quantityOnHand: Number(data.quantityOnHand ?? 0),
        createdAt: rawCreatedAt,
      } satisfies StockAdjustmentHistoryRow;
    })
    .filter((row) => row.variantId.length > 0)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const addOptionValue = (
  map: Map<string, Set<string>>,
  rawKey: unknown,
  rawValue: unknown,
) => {
  if (typeof rawKey !== "string" || typeof rawValue !== "string") return;
  const key = rawKey.trim();
  const value = rawValue.trim();
  if (!key || !value) return;

  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
};

const toOptionDiscovery = (valueMap: Map<string, Set<string>>): OptionDiscovery => {
  const optionKeys = Array.from(valueMap.keys()).sort((a, b) => a.localeCompare(b));
  const optionValuesByKey = Object.fromEntries(
    optionKeys.map((key) => {
      const values = Array.from(valueMap.get(key) ?? []).sort((a, b) =>
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

export const getLocalOptionDiscoveryForStore = async (
  tenantId: string,
): Promise<OptionDiscovery> => {
  const [itemEntities, variantEntities] = await Promise.all([
    listEntities(tenantId, "item"),
    listEntities(tenantId, "item_variant"),
  ]);

  const optionMap = new Map<string, Set<string>>();

  for (const item of itemEntities) {
    if (item.deletedAt) continue;
    const variants = Array.isArray(item.data.variants) ? item.data.variants : [];
    for (const variant of variants) {
      if (!variant || typeof variant !== "object") continue;
      const variantRecord = variant as Record<string, unknown>;
      const optionValues =
        variantRecord.optionValues && typeof variantRecord.optionValues === "object"
          ? variantRecord.optionValues
          : undefined;
      if (!optionValues || typeof optionValues !== "object") continue;

      for (const [key, value] of Object.entries(optionValues as Record<string, unknown>)) {
        addOptionValue(optionMap, key, value);
      }
    }
  }

  for (const variant of variantEntities) {
    if (variant.deletedAt) continue;
    const optionValues =
      variant.data.optionValues && typeof variant.data.optionValues === "object"
        ? variant.data.optionValues
        : undefined;
    if (!optionValues || typeof optionValues !== "object") continue;

    for (const [key, value] of Object.entries(optionValues as Record<string, unknown>)) {
      addOptionValue(optionMap, key, value);
    }
  }

  return toOptionDiscovery(optionMap);
};

export const getRemoteOptionDiscoveryForStore = async (
  tenantId: string,
): Promise<OptionDiscovery> => {
  const params = new URLSearchParams({ tenantId });
  const response = await apiFetch(`/api/sync/option-keys?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Option key discovery failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    optionKeys?: unknown;
    optionValuesByKey?: unknown;
  };

  const optionMap = new Map<string, Set<string>>();

  if (Array.isArray(payload.optionKeys)) {
    for (const rawKey of payload.optionKeys) {
      if (typeof rawKey !== "string") continue;
      const key = rawKey.trim();
      if (!key) continue;
      if (!optionMap.has(key)) {
        optionMap.set(key, new Set<string>());
      }
    }
  }

  const rawValuesByKey =
    payload.optionValuesByKey && typeof payload.optionValuesByKey === "object"
      ? (payload.optionValuesByKey as Record<string, unknown>)
      : {};
  for (const [key, rawValues] of Object.entries(rawValuesByKey)) {
    if (!Array.isArray(rawValues)) continue;
    for (const rawValue of rawValues) {
      addOptionValue(optionMap, key, rawValue);
    }
  }

  return toOptionDiscovery(optionMap);
};

export const getLocalItemCategoriesForStore = async (
  tenantId: string,
): Promise<string[]> => {
  const [itemEntities, categoryEntities] = await Promise.all([
    listEntities(tenantId, "item"),
    listEntities(tenantId, "item_category"),
  ]);
  const categoriesFromItems = itemEntities
    .filter((item) => !item.deletedAt)
    .map((item) => String(item.data.category ?? "").trim())
    .filter((category) => category.length > 0);
  const categoriesFromEntries = categoryEntities
    .filter((entry) => !entry.deletedAt)
    .map((entry) => String(entry.data.name ?? "").trim())
    .filter((name) => name.length > 0);

  return Array.from(new Set([...categoriesFromItems, ...categoriesFromEntries])).sort((a, b) =>
    a.localeCompare(b),
  );
};

export const getLocalItemCategoryEntriesForStore = async (
  tenantId: string,
): Promise<ItemCategoryEntry[]> => {
  const categoryEntities = await listEntities(tenantId, "item_category");
  return categoryEntities
    .filter((entry) => !entry.deletedAt)
    .map((entry) => ({
      id: entry.entityId,
      name: String(entry.data.name ?? "").trim(),
    }))
    .filter((entry) => entry.id.length > 0 && entry.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const getLocalItemCollectionEntriesForStore = async (
  tenantId: string,
): Promise<ItemCollectionEntry[]> => {
  const collectionEntities = await listEntities(tenantId, "item_collection");
  return collectionEntities
    .filter((entry) => !entry.deletedAt)
    .map((entry) => ({
      id: entry.entityId,
      name: String(entry.data.name ?? "").trim(),
    }))
    .filter((entry) => entry.id.length > 0 && entry.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const getLocalItemCollectionMembershipsForStore = async (
  tenantId: string,
): Promise<ItemCollectionMembership[]> => {
  const [membershipEntities, variantEntities, itemEntities] = await Promise.all([
    listEntities(tenantId, "item_collection_item"),
    listEntities(tenantId, "item_variant"),
    listEntities(tenantId, "item"),
  ]);
  const itemIdByVariantId = new Map<string, string>(
    variantEntities
      .filter((entry) => !entry.deletedAt)
      .map((entry) => [
        entry.entityId,
        String(entry.data.itemId ?? ""),
      ]),
  );
  const variantMetaByVariantId = new Map<
    string,
    {
      name: string;
      sku: string;
      isActive: boolean;
    }
  >(
    variantEntities
      .filter((entry) => !entry.deletedAt)
      .map((entry) => [
        entry.entityId,
        {
          name: String(entry.data.name ?? ""),
          sku: String(entry.data.sku ?? ""),
          isActive: Boolean(entry.data.isActive ?? true),
        },
      ]),
  );
  for (const itemEntity of itemEntities) {
    if (itemEntity.deletedAt) continue;
    const itemId = itemEntity.entityId;
    const variants = extractVariantsFromItemData(itemEntity.data, itemId);
    for (const variant of variants) {
      if (!variant.id) continue;
      if (!itemIdByVariantId.has(variant.id)) {
        itemIdByVariantId.set(variant.id, variant.itemId || itemId);
      }
      if (!variantMetaByVariantId.has(variant.id)) {
        variantMetaByVariantId.set(variant.id, {
          name: variant.name,
          sku: variant.sku,
          isActive: variant.isActive,
        });
      }
    }
  }
  return membershipEntities
    .filter((entry) => !entry.deletedAt)
    .map((entry) => {
      const collectionId = String(entry.data.collectionId ?? "");
      const variantId = String(entry.data.variantId ?? "");
      const itemId =
        itemIdByVariantId.get(variantId) ??
        String(entry.data.itemId ?? "");
      const variantMeta = variantMetaByVariantId.get(variantId);
      return {
        id: entry.entityId,
        collectionId,
        variantId,
        itemId,
        variantName: variantMeta?.name,
        variantSku: variantMeta?.sku,
        variantIsActive: variantMeta?.isActive,
      } satisfies ItemCollectionMembership;
    })
    .filter(
      (entry) =>
        entry.id.length > 0 &&
        entry.collectionId.length > 0 &&
        entry.variantId.length > 0 &&
        entry.itemId.length > 0,
    );
};

export const getLocalItemPricingRowsForDisplay = async (
  tenantId: string,
  query?: string,
  includeInactive = false,
): Promise<ItemPricingRow[]> => {
  const [variantEntities, itemEntities, priceEntities, pendingPriceMutations] = await Promise.all([
    listEntities(tenantId, "item_variant"),
    listEntities(tenantId, "item"),
    listEntities(tenantId, "item_price"),
    syncDb.outbox
      .where("[tenantId+status]")
      .equals([tenantId, "pending"])
      .filter((item) => item.entity === "item_price" && item.op === "update")
      .toArray(),
  ]);

  const itemById = new Map(
    itemEntities
      .filter((item) => !item.deletedAt)
      .map((item) => [item.entityId, item]),
  );

  const variantMetaById = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      itemType: "PRODUCT" | "SERVICE";
      itemCategory: string;
      unit: string;
      variantName: string;
      sku: string;
      isDefaultVariant: boolean;
      isActive: boolean;
    }
  >();

  for (const variant of variantEntities) {
    if (variant.deletedAt) continue;
    const itemId = String(variant.data.itemId ?? "");
    const item = itemById.get(itemId);
    variantMetaById.set(variant.entityId, {
      itemId,
      itemName: String(item?.data.name ?? "Untitled Item"),
      itemType: String(item?.data.itemType ?? "PRODUCT") as "PRODUCT" | "SERVICE",
      itemCategory: String(item?.data.category ?? ""),
      unit: String(item?.data.unit ?? "PCS"),
      variantName: String(variant.data.name ?? ""),
      sku: String(variant.data.sku ?? ""),
      isDefaultVariant: Boolean(variant.data.isDefault ?? false),
      isActive: Boolean(variant.data.isActive ?? true),
    });
  }

  for (const itemEntity of itemEntities) {
    if (itemEntity.deletedAt) continue;
    const itemId = itemEntity.entityId;
    const itemName = String(itemEntity.data.name ?? "Untitled Item");
    const itemCategory = String(itemEntity.data.category ?? "");
    const unit = String(itemEntity.data.unit ?? "PCS");
    const variants = extractVariantsFromItemData(itemEntity.data, itemId);
    for (const variant of variants) {
      if (!variant.id || variantMetaById.has(variant.id)) continue;
      variantMetaById.set(variant.id, {
        itemId,
        itemName,
        itemType: String(itemEntity.data.itemType ?? "PRODUCT") as "PRODUCT" | "SERVICE",
        itemCategory,
        unit,
        variantName: variant.name,
        sku: variant.sku,
        isDefaultVariant: false,
        isActive: variant.isActive,
      });
    }
  }

  const persistedPriceByVariantId = new Map<
    string,
    { amount: number | null; currency: string; updatedAt: string | null; serverVersion: number }
  >();
  for (const price of priceEntities) {
    if (price.deletedAt) continue;
    const variantId = String(price.data.variantId ?? price.entityId ?? "");
    if (!variantId) continue;
    const rawAmount = price.data.amount;
    const amount =
      rawAmount === null
        ? null
        : typeof rawAmount === "number" && Number.isFinite(rawAmount)
          ? rawAmount
          : typeof rawAmount === "string" && rawAmount.trim()
            ? Number(rawAmount)
            : null;
    const currency = String(price.data.currency ?? "INR").trim().toUpperCase() || "INR";
    persistedPriceByVariantId.set(variantId, {
      amount,
      currency,
      updatedAt: price.updatedAt,
      serverVersion: price.serverVersion ?? 0,
    });
  }

  const pendingPriceByVariantId = new Map<
    string,
    { amount: number | null; currency?: string }
  >();
  for (const mutation of pendingPriceMutations) {
    const variantId =
      typeof mutation.payload.variantId === "string"
        ? mutation.payload.variantId
        : mutation.entityId;
    if (!variantId) continue;
    const rawAmount = mutation.payload.amount;
    const amount =
      rawAmount === null
        ? null
        : typeof rawAmount === "number" && Number.isFinite(rawAmount)
          ? rawAmount
          : typeof rawAmount === "string" && rawAmount.trim()
            ? Number(rawAmount)
            : null;
    const currency =
      typeof mutation.payload.currency === "string"
        ? mutation.payload.currency.trim().toUpperCase()
        : undefined;
    pendingPriceByVariantId.set(variantId, { amount, currency });
  }

  const normalizedQuery = query?.trim().toLowerCase() ?? "";

  return Array.from(variantMetaById.entries())
    .map(([variantId, variant]) => {
      const pending = pendingPriceByVariantId.get(variantId);
      const persisted = persistedPriceByVariantId.get(variantId);
      const amount = pending ? pending.amount : (persisted?.amount ?? null);
      const currency = pending?.currency || persisted?.currency || "INR";
      const pendingState = Boolean(pending);
      return {
        variantId,
        itemId: variant.itemId,
        itemName: variant.itemName,
        itemType: variant.itemType,
        itemCategory: variant.itemCategory,
        unit: variant.unit,
        variantName: variant.variantName,
        sku: variant.sku,
        isDefaultVariant: variant.isDefaultVariant,
        isActive: variant.isActive,
        amount,
        currency,
        updatedAt: persisted?.updatedAt ?? null,
        serverVersion: persisted?.serverVersion ?? 0,
        pending: pendingState,
      } satisfies ItemPricingRow;
    })
    .filter((row) => includeInactive || row.isActive)
    .filter((row) => {
      if (!normalizedQuery) return true;
      return (
        row.itemName.toLowerCase().includes(normalizedQuery) ||
        row.variantName.toLowerCase().includes(normalizedQuery) ||
        row.sku.toLowerCase().includes(normalizedQuery) ||
        row.itemCategory.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => {
      const itemOrder = left.itemName.localeCompare(right.itemName);
      if (itemOrder !== 0) return itemOrder;
      if (left.isDefaultVariant && !right.isDefaultVariant) return -1;
      if (!left.isDefaultVariant && right.isDefaultVariant) return 1;
      return left.variantName.localeCompare(right.variantName);
    });
};

export const getRemoteItemCategoriesForStore = async (
  tenantId: string,
  query?: string,
  limit = 50,
): Promise<string[]> => {
  const entries = await getRemoteItemCategoryEntriesForStore(tenantId, query, limit);
  return entries.map((entry) => entry.name);
};

export const getRemoteItemCategoryEntriesForStore = async (
  tenantId: string,
  query?: string,
  limit = 50,
): Promise<ItemCategoryEntry[]> => {
  const params = new URLSearchParams({
    tenantId,
    limit: String(limit),
  });
  if (query?.trim()) {
    params.set("q", query.trim());
  }

  const response = await apiFetch(`/api/sync/item-categories?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Category discovery failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    entries?: unknown;
    categories?: unknown;
  };
  if (Array.isArray(payload.entries)) {
    return payload.entries
      .filter((value) => typeof value === "object" && value !== null)
      .map((value) => {
        const record = value as Record<string, unknown>;
        return {
          id: String(record.id ?? ""),
          name: String(record.name ?? "").trim(),
        } satisfies ItemCategoryEntry;
      })
      .filter((entry) => entry.id.length > 0 && entry.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  if (!Array.isArray(payload.categories)) return [];
  return payload.categories
    .filter((value): value is string => typeof value === "string")
    .map((name) => ({
      id: name.trim().toLowerCase(),
      name: name.trim(),
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
};
