import { apiFetch } from "../../lib/api";

export type AdminStore = {
  id: string;
  name: string;
  ownerId: string;
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export type AdminStoresPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListAdminStoresParams = {
  storeName?: string;
  ownerPhone?: string;
  page?: number;
  limit?: number;
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

const toListStoresUrl = (params: ListAdminStoresParams) => {
  const query = new URLSearchParams();
  if (params.storeName?.trim()) {
    query.set("storeName", params.storeName.trim());
  }
  if (params.ownerPhone?.trim()) {
    query.set("ownerPhone", params.ownerPhone.trim());
  }
  if (typeof params.page === "number") {
    query.set("page", String(params.page));
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  const encoded = query.toString();
  return encoded ? `/api/admin/stores?${encoded}` : "/api/admin/stores";
};

export const listAdminStores = async (
  params: ListAdminStoresParams = {},
): Promise<{ stores: AdminStore[]; pagination: AdminStoresPagination }> => {
  const response = await apiFetch(toListStoresUrl(params), { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load stores"));
  }

  const payload = (await response.json()) as {
    stores?: AdminStore[];
    pagination?: AdminStoresPagination;
  };
  return {
    stores: payload.stores ?? [],
    pagination: payload.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      total: 0,
      totalPages: 0,
    },
  };
};

export const createAdminStore = async (
  name: string,
  ownerContact: { ownerPhone?: string },
): Promise<AdminStore> => {
  const response = await apiFetch("/api/admin/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      ...(ownerContact.ownerPhone ? { ownerPhone: ownerContact.ownerPhone.trim() } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create store"));
  }

  const payload = (await response.json()) as { store: AdminStore };
  return payload.store;
};

export const updateAdminStore = async (
  storeId: string,
  update: { name?: string; ownerId?: string },
): Promise<AdminStore> => {
  const response = await apiFetch(`/api/admin/stores/${encodeURIComponent(storeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to update store"));
  }

  const payload = (await response.json()) as { store: AdminStore };
  return payload.store;
};

export const deleteAdminStore = async (storeId: string): Promise<void> => {
  const response = await apiFetch(`/api/admin/stores/${encodeURIComponent(storeId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to delete store"));
  }
};
