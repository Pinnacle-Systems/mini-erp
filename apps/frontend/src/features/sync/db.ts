import Dexie, { type Table } from "dexie";
import type { SyncDelta, SyncMutation, SyncRejection, SyncResultRecord } from "./types";

export type OutboxItem = SyncMutation & {
  tenantId: string;
  status: "pending" | "applied" | "rejected";
  error?: string;
  rejection?: SyncRejection;
  createdAt: string;
  updatedAt: string;
};

export type SyncMeta = {
  tenantId: string;
  key: "cursor";
  value: string;
};

export type EntityRecord = {
  tenantId: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  serverVersion: number;
  updatedAt: string;
  deletedAt?: string;
};

export type LocalSyncResultRecord = SyncResultRecord & {
  tenantId: string;
  source: "local" | "server";
};

class SyncDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, [string, SyncMeta["key"]]>;
  entities!: Table<EntityRecord, [string, string, string]>;
  syncResults!: Table<LocalSyncResultRecord, string>;

  constructor() {
    super("mini_erp_sync_vite");
    this.version(1).stores({
      outbox: "&mutationId, [tenantId+status], tenantId, status, entity, createdAt",
      syncMeta: "[tenantId+key], tenantId, key",
      entities: "[tenantId+entity+entityId], tenantId, entity, updatedAt"
    });
    this.version(2).stores({
      outbox: "&mutationId, [tenantId+status], tenantId, status, entity, createdAt",
      syncMeta: "[tenantId+key], tenantId, key",
      entities: "[tenantId+entity+entityId], tenantId, entity, updatedAt",
      syncResults: "&mutationId, [tenantId+processedAt], tenantId, processedAt, resultStatus, entity"
    });
  }
}

export const syncDb = new SyncDatabase();

const normalizeEntityStateData = (
  delta: SyncDelta,
  existingData?: Record<string, unknown>,
) => {
  const base =
    delta.data && typeof delta.data === "object" && !Array.isArray(delta.data)
      ? { ...delta.data }
      : {};
  const merged = delta.op === "delete" ? { ...(existingData ?? {}), ...base } : base;

  return {
    ...merged,
    isActive:
      delta.op === "delete"
        ? false
        : typeof merged.isActive === "boolean"
          ? merged.isActive
          : true,
    deletedAt: delta.op === "delete" ? delta.serverTimestamp : null,
  };
};

export const queueMutation = async (tenantId: string, mutation: SyncMutation) => {
  const now = new Date().toISOString();
  await syncDb.outbox.put({
    ...mutation,
    tenantId,
    status: "pending",
    createdAt: now,
    updatedAt: now
  });
};

export const applyDeltas = async (tenantId: string, deltas: SyncDelta[]) => {
  await syncDb.transaction("rw", syncDb.entities, async () => {
    for (const delta of deltas) {
      const deltaData =
        delta.data && typeof delta.data === "object" && !Array.isArray(delta.data)
          ? (delta.data as Record<string, unknown>)
          : {};
      const itemPriceVariantId =
        typeof deltaData.variantId === "string" && deltaData.variantId.trim().length > 0
          ? deltaData.variantId.trim()
          : delta.entityId;
      const itemPriceType =
        String(deltaData.priceType ?? "SALES").toUpperCase() === "PURCHASE"
          ? "PURCHASE"
          : "SALES";
      const normalizedEntityId =
        delta.entity === "item_price"
          ? typeof deltaData.variantId === "string" && deltaData.variantId.trim().length > 0
            ? `${itemPriceVariantId}:${itemPriceType}`
            : delta.entityId
          : delta.entityId;
      const key: [string, string, string] = [tenantId, delta.entity, normalizedEntityId];

      if (delta.op === "purge") {
        await syncDb.entities.delete(key);
        continue;
      }

      if (delta.op === "delete") {
        const existing = await syncDb.entities.get(key);
        await syncDb.entities.put({
          tenantId,
          entity: delta.entity,
          entityId: normalizedEntityId,
          data: normalizeEntityStateData(delta, existing?.data),
          deletedAt: delta.serverTimestamp,
          serverVersion: delta.serverVersion,
          updatedAt: delta.serverTimestamp,
        });
        continue;
      }

      await syncDb.entities.put({
        tenantId,
        entity: delta.entity,
        entityId: normalizedEntityId,
        data: normalizeEntityStateData(delta),
        serverVersion: delta.serverVersion,
        updatedAt: delta.serverTimestamp
      });
    }
  });
};

export const listEntities = async (tenantId: string, entity: string) => {
  return syncDb.entities
    .where("[tenantId+entity+entityId]")
    .between([tenantId, entity, Dexie.minKey], [tenantId, entity, Dexie.maxKey])
    .toArray();
};

export const upsertSyncResults = async (results: LocalSyncResultRecord[]) => {
  if (results.length === 0) return;
  await syncDb.syncResults.bulkPut(results);
};

export const listSyncResults = async (tenantId: string, limit = 25) => {
  return syncDb.syncResults
    .where("[tenantId+processedAt]")
    .between([tenantId, Dexie.minKey], [tenantId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
};
