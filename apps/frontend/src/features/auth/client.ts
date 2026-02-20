import { apiFetch, setAccessToken } from "../../lib/api";
import {
  setActiveStore,
  setAssignedStores,
  type AssignedStore
} from "./store-context";

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

export const selectStore = async (storeId: string) => {
  const response = await apiFetch("/api/auth/select-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Store selection failed");
  }

  const payload = (await response.json()) as { token?: string };
  if (payload.token) {
    setAccessToken(payload.token);
  }

  setActiveStore(storeId);
};

export const getMe = async (): Promise<MePayload> => {
  const response = await apiFetch("/api/auth/me", { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to fetch current session");
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
