import { applyDeltas, syncDb } from "./db";
import type { PullResponse, PushResponse } from "../types";

const CURSOR_KEY = "cursor";

const getCursor = async () => {
  const cursorRow = await syncDb.syncMeta.get(CURSOR_KEY);
  return cursorRow?.value ?? "0";
};

const setMeta = async (key: "cursor" | "deviceId" | "lastSyncAt", value: string) => {
  await syncDb.syncMeta.put({ key, value });
};

const pushPendingMutations = async () => {
  const pending = await syncDb.outbox.where("status").equals("pending").limit(100).toArray();
  if (!pending.length) {
    return;
  }

  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: pending.map(({ status, error, createdAt, updatedAt, ...mutation }) => mutation),
    }),
  });

  if (!response.ok) {
    throw new Error(`Push failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PushResponse;
  const now = new Date().toISOString();

  await syncDb.transaction("rw", syncDb.outbox, syncDb.syncMeta, async () => {
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

    await setMeta("cursor", payload.cursor);
  });
};

const pullDeltas = async () => {
  const cursor = await getCursor();
  const query = new URLSearchParams({ cursor, limit: "200" });
  const response = await fetch(`/api/sync/pull?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Pull failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PullResponse;

  await syncDb.transaction("rw", syncDb.syncMeta, syncDb.entities, async () => {
    await applyDeltas(payload.deltas);
    await setMeta("cursor", payload.nextCursor);
    await setMeta("lastSyncAt", new Date().toISOString());
  });
};

export const syncOnce = async () => {
  await pushPendingMutations();
  await pullDeltas();
};
