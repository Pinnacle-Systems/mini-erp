import { apiFetch, setAccessToken } from "../../lib/api";
import {
  setAssignedStores,
  setPersistedActiveStore,
  type StoreModules,
  type AssignedStore,
} from "./session-store";

export type LoginResult = {
  token: string;
  role: "USER" | "PLATFORM_ADMIN";
  availableStores?: AssignedStore[];
};

export type MePayload = {
  success: boolean;
  role: "USER" | "PLATFORM_ADMIN" | null;
  identityId: string | null;
  tenantId: string | null;
  stores?: AssignedStore[];
  modules?: StoreModules | null;
};

export const login = async (username: string, password: string): Promise<LoginResult> => {
  const trimmed = username.trim();
  if (!/^\d{10}$/.test(trimmed)) {
    throw new Error("Phone number must be 10 digits");
  }
  const body = { phone: trimmed, password };

  const response = await apiFetch(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    { auth: false, retryOnUnauthorized: false }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Login failed");
  }

  const payload = (await response.json()) as {
    token: string;
    role: "USER" | "PLATFORM_ADMIN";
    availableStores?: AssignedStore[];
  };

  setAccessToken(payload.token);
  if (payload.availableStores) {
    setAssignedStores(payload.availableStores);
  }

  return payload;
};

export const selectStore = async (
  storeId: string,
): Promise<{ modules?: StoreModules | null }> => {
  const response = await apiFetch("/api/auth/select-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Store selection failed");
  }

  const payload = (await response.json()) as {
    token?: string;
    modules?: StoreModules | null;
  };
  if (payload.token) {
    setAccessToken(payload.token);
  }

  setPersistedActiveStore(storeId);
  return {
    modules: payload.modules ?? null,
  };
};

export const getMe = async (): Promise<MePayload> => {
  const response = await apiFetch("/api/auth/me", { method: "GET" });
  if (!response.ok) {
    const error = new Error("Failed to fetch current session");
    Object.assign(error, { status: response.status });
    throw error;
  }

  const payload = (await response.json()) as MePayload;
  if (payload.stores) {
    setAssignedStores(payload.stores);
  }

  return payload;
};

export const logout = async (): Promise<void> => {
  await apiFetch(
    "/api/auth/logout",
    { method: "POST" },
    { retryOnUnauthorized: false }
  ).catch(() => null);
  setAccessToken(null);
};
