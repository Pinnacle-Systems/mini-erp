import { apiFetch, setAccessToken } from "../../lib/api";
import {
  setAssignedStores,
  setPersistedActiveStore,
  type BusinessModules,
  type AssignedStore,
} from "./session-business";

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
  memberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
  activeLocationId?: string | null;
  locations?: Array<{ id: string; name: string; isDefault: boolean }>;
  businesses?: AssignedStore[];
  modules?: BusinessModules | null;
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
  businessId: string,
): Promise<{
  modules?: BusinessModules | null;
  memberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
  activeLocationId?: string | null;
  locations?: Array<{ id: string; name: string; isDefault: boolean }>;
}> => {
  const response = await apiFetch("/api/auth/select-business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Business selection failed");
  }

  const payload = (await response.json()) as {
    token?: string;
    modules?: BusinessModules | null;
    memberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
    activeLocationId?: string | null;
    locations?: Array<{ id: string; name: string; isDefault: boolean }>;
  };
  if (payload.token) {
    setAccessToken(payload.token);
  }

  setPersistedActiveStore(businessId);
  return {
    modules: payload.modules ?? null,
    memberRole: payload.memberRole ?? null,
    activeLocationId: payload.activeLocationId ?? null,
    locations: payload.locations ?? [],
  };
};

export const selectLocation = async (
  businessId: string,
  locationId: string,
): Promise<{
  modules?: BusinessModules | null;
  memberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
  activeLocationId?: string | null;
  locations?: Array<{ id: string; name: string; isDefault: boolean }>;
}> => {
  const response = await apiFetch("/api/auth/select-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, locationId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Location selection failed");
  }

  const payload = (await response.json()) as {
    token?: string;
    modules?: BusinessModules | null;
    memberRole?: "OWNER" | "MANAGER" | "CASHIER" | null;
    activeLocationId?: string | null;
    locations?: Array<{ id: string; name: string; isDefault: boolean }>;
  };
  if (payload.token) {
    setAccessToken(payload.token);
  }

  return {
    modules: payload.modules ?? null,
    memberRole: payload.memberRole ?? null,
    activeLocationId: payload.activeLocationId ?? null,
    locations: payload.locations ?? [],
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
  if (payload.businesses) {
    setAssignedStores(payload.businesses);
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
