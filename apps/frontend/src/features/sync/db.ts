import Dexie, { type Table } from "dexie";
import type { SyncDelta, SyncMutation } from "./types";

export type OutboxItem = SyncMutation & {
  tenantId: string;
  status: "pending" | "applied" | "rejected";
  error?: string;
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

class SyncDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, [string, SyncMeta["key"]]>;
  entities!: Table<EntityRecord, [string, string, string]>;

  constructor() {
    super("mini_erp_sync_vite");
    this.version(1).stores({
      outbox: "&mutationId, [tenantId+status], tenantId, status, entity, createdAt",
      syncMeta: "[tenantId+key], tenantId, key",
      entities: "[tenantId+entity+entityId], tenantId, entity, updatedAt"
    });
  }
}

export const syncDb = new SyncDatabase();

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
      const key: [string, string, string] = [tenantId, delta.entity, delta.entityId];

      if (delta.op === "delete") {
        const existing = await syncDb.entities.get(key);
        if (!existing) continue;

        await syncDb.entities.put({
          ...existing,
          deletedAt: delta.serverTimestamp,
          serverVersion: delta.serverVersion,
          updatedAt: delta.serverTimestamp
        });
        continue;
      }

      await syncDb.entities.put({
        tenantId,
        entity: delta.entity,
        entityId: delta.entityId,
        data: delta.data,
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
