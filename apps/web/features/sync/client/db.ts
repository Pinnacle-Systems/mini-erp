import Dexie, { type Table } from "dexie";
import type { SyncDelta, SyncMutation } from "../types";

export type OutboxItem = SyncMutation & {
  status: "pending" | "applied" | "rejected";
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncMeta = {
  key: "cursor" | "deviceId" | "lastSyncAt";
  value: string;
};

export type EntityRecord = {
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  serverVersion: number;
  updatedAt: string;
  deletedAt?: string;
};

class SyncDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, SyncMeta["key"]>;
  entities!: Table<EntityRecord, [string, string]>;

  constructor() {
    super("mini_erp_sync");
    this.version(1).stores({
      outbox: "&mutationId, status, entity, createdAt",
      syncMeta: "&key",
      entities: "[entity+entityId], entity, updatedAt",
    });
  }
}

export const syncDb = new SyncDatabase();

export const queueMutation = async (mutation: SyncMutation) => {
  const now = new Date().toISOString();
  await syncDb.outbox.put({
    ...mutation,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
};

export const applyDeltas = async (deltas: SyncDelta[]) => {
  await syncDb.transaction("rw", syncDb.entities, async () => {
    for (const delta of deltas) {
      const key: [string, string] = [delta.entity, delta.entityId];

      if (delta.op === "delete") {
        const existing = await syncDb.entities.get(key);
        if (!existing) {
          continue;
        }

        await syncDb.entities.put({
          ...existing,
          deletedAt: delta.serverTimestamp,
          serverVersion: delta.serverVersion,
          updatedAt: delta.serverTimestamp,
        });
        continue;
      }

      await syncDb.entities.put({
        entity: delta.entity,
        entityId: delta.entityId,
        data: delta.data,
        serverVersion: delta.serverVersion,
        updatedAt: delta.serverTimestamp,
      });
    }
  });
};
