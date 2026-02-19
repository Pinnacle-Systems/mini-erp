import { apiFetch } from "../../lib/api";
import { applyDeltas, listEntities, queueMutation, syncDb, type OutboxItem } from "./db";
import type { PullResponse, PushResponse, SyncMutation } from "./types";

const CURSOR_KEY = "cursor";
const DEVICE_ID_KEY = "mini_erp_device_id_v1";

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

export const queueProductCreate = async (
  tenantId: string,
  userId: string,
  payload: { sku: string; name: string; description: string; unit: "PCS" | "KG" | "M" | "BOX" }
) => {
  const entityId = crypto.randomUUID();
  await queueMutation(tenantId, {
    mutationId: crypto.randomUUID(),
    deviceId: getOrCreateDeviceId(),
    userId,
    entity: "product",
    entityId,
    op: "create",
    payload,
    clientTimestamp: new Date().toISOString()
  });
};

const push = async (tenantId: string) => {
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

  await syncDb.transaction("rw", syncDb.outbox, syncDb.syncMeta, async () => {
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

    await setCursor(tenantId, payload.cursor);
  });
};

const pull = async (tenantId: string) => {
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
  await push(tenantId);
  await pull(tenantId);
};

export const getLocalProducts = async (tenantId: string) => {
  return listEntities(tenantId, "product");
};
