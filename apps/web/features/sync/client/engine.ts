import {
  applyDeltas,
  getPendingTenantIds,
  syncDb,
  type OutboxItem,
} from "./db";
import type { PullResponse, PushResponse, SyncMutation } from "../types";
import { ensureFreshAccessToken } from "@/features/auth/client/session";
import {
  getActiveStoreId,
} from "@/features/auth/client/store-context";

const CURSOR_KEY = "cursor";
const MAX_TENANT_SYNC_CONCURRENCY = 2;

export class SyncAuthExpiredError extends Error {
  constructor() {
    super("Sync session expired.");
    this.name = "SyncAuthExpiredError";
  }
}

const getCursor = async (tenantId: string) => {
  const cursorRow = await syncDb.syncMeta.get([tenantId, CURSOR_KEY]);
  return cursorRow?.value ?? "0";
};

const setMeta = async (
  tenantId: string,
  key: "cursor" | "deviceId" | "lastSyncAt",
  value: string,
) => {
  await syncDb.syncMeta.put({ tenantId, key, value });
};

const toSyncMutation = (item: OutboxItem): SyncMutation => ({
  mutationId: item.mutationId,
  deviceId: item.deviceId,
  userId: item.userId,
  entity: item.entity,
  entityId: item.entityId,
  op: item.op,
  payload: item.payload,
  baseVersion: item.baseVersion,
  clientTimestamp: item.clientTimestamp,
});

const fetchWithAuthRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const response = await fetch(input, init);
  if (response.status !== 401) {
    return response;
  }

  const refreshStatus = await ensureFreshAccessToken({ force: true });
  if (refreshStatus === "unauthorized") {
    throw new SyncAuthExpiredError();
  }

  if (refreshStatus !== "ok") {
    return response;
  }

  const retriedResponse = await fetch(input, init);
  if (retriedResponse.status === 401) {
    throw new SyncAuthExpiredError();
  }

  return retriedResponse;
};

const pushPendingMutations = async (tenantId: string) => {
  const pending = await syncDb.outbox
    .where("[tenantId+status]")
    .equals([tenantId, "pending"])
    .limit(100)
    .toArray();
  if (!pending.length) {
    return;
  }

  const response = await fetchWithAuthRetry("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      tenantId,
      mutations: pending.map(toSyncMutation),
    }),
  });

  if (!response.ok) {
    throw new Error(`Push failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PushResponse;
  const now = new Date().toISOString();

  await syncDb.transaction("rw", syncDb.outbox, async () => {
    for (const ack of payload.acknowledgements) {
      const current = await syncDb.outbox.get(ack.mutationId);
      if (!current) {
        continue;
      }

      await syncDb.outbox.put({
        ...current,
        status: ack.status,
        error: ack.reason,
        updatedAt: now,
      });
    }
  });
};

const pullDeltas = async (tenantId: string) => {
  const cursor = await getCursor(tenantId);
  const query = new URLSearchParams({ tenantId, cursor, limit: "200" });
  const response = await fetchWithAuthRetry(`/api/sync/pull?${query.toString()}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Pull failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PullResponse;

  await syncDb.transaction("rw", syncDb.syncMeta, syncDb.entities, async () => {
    await applyDeltas(payload.deltas);
    await setMeta(tenantId, "cursor", payload.nextCursor);
    await setMeta(tenantId, "lastSyncAt", new Date().toISOString());
  });
};

const syncTenant = async (tenantId: string) => {
  await pushPendingMutations(tenantId);
  await pullDeltas(tenantId);
};

export const syncOnce = async () => {
  const refreshStatus = await ensureFreshAccessToken();
  if (refreshStatus === "unauthorized") {
    throw new SyncAuthExpiredError();
  }
  if (refreshStatus === "failed") {
    return;
  }

  const activeTenantId = getActiveStoreId();
  const pendingTenantIds = await getPendingTenantIds();
  const queue = activeTenantId
    ? [activeTenantId, ...pendingTenantIds.filter((tenantId) => tenantId !== activeTenantId)]
    : pendingTenantIds;

  if (queue.length === 0) {
    return;
  }

  const workerCount = Math.min(MAX_TENANT_SYNC_CONCURRENCY, queue.length);
  let cursor = 0;

  const getNextTenant = () => {
    if (cursor >= queue.length) {
      return null;
    }
    const next = queue[cursor];
    cursor += 1;
    return next;
  };

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const tenantId = getNextTenant();
      if (!tenantId) {
        return;
      }

      try {
        await syncTenant(tenantId);
      } catch (error) {
        if (error instanceof SyncAuthExpiredError) {
          throw error;
        }
        console.error(`Sync failed for tenant ${tenantId}`, error);
      }
    }
  });

  await Promise.all(workers);
};
