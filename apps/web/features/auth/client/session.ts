"use client";

import { writeAuthCache } from "./state";
import {
  clearPendingStoreSelection,
  getAssignedStores,
  getPendingStoreId,
  setActiveStore,
} from "./store-context";

export type RefreshSessionStatus = "ok" | "unauthorized" | "failed" | "skipped";

const TOKEN_REFRESH_MIN_GAP_MS = 4 * 60 * 1000;

let lastTokenRefreshAt = 0;
let refreshInFlight: Promise<RefreshSessionStatus> | null = null;

const applyPendingStoreSelection = async (): Promise<RefreshSessionStatus | "applied"> => {
  if (typeof window === "undefined" || !window.navigator.onLine) {
    return "skipped";
  }

  const pendingStoreId = getPendingStoreId();
  if (!pendingStoreId) {
    return "skipped";
  }

  try {
    const response = await fetch("/api/auth/store-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeId: pendingStoreId }),
    });

    if (response.ok) {
      const selectedStore = getAssignedStores().find((store) => store.id === pendingStoreId);
      setActiveStore(pendingStoreId, selectedStore?.name ?? null);
      clearPendingStoreSelection();
      return "applied";
    }

    if (response.status === 401 || response.status === 403) {
      writeAuthCache(false);
      return "unauthorized";
    }

    return "failed";
  } catch {
    return "failed";
  }
};

export const ensureFreshAccessToken = async (
  options: { force?: boolean } = {},
): Promise<RefreshSessionStatus> => {
  const { force = false } = options;

  if (typeof window === "undefined" || !window.navigator.onLine) {
    return "skipped";
  }

  const pendingStatus = await applyPendingStoreSelection();
  if (pendingStatus === "applied") {
    writeAuthCache(true);
    lastTokenRefreshAt = Date.now();
    return "ok";
  }
  if (pendingStatus === "failed" || pendingStatus === "unauthorized") {
    return pendingStatus;
  }

  const now = Date.now();
  if (!force && now - lastTokenRefreshAt < TOKEN_REFRESH_MIN_GAP_MS) {
    return "skipped";
  }

  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => {
        if (response.ok) {
          writeAuthCache(true);
          lastTokenRefreshAt = Date.now();
          return "ok" as const;
        }

        if (response.status === 401 || response.status === 403) {
          writeAuthCache(false);
          return "unauthorized" as const;
        }

        return "failed" as const;
      })
      .catch(() => "failed" as const)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight ?? "failed";
};
