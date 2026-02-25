import { apiFetch } from "../../lib/api";

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  systemRole: "USER" | "PLATFORM_ADMIN";
  deletedAt: string | null;
  updatedAt: string;
  businessCount: number;
};

export type AdminUsersPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListAdminUsersParams = {
  name?: string;
  email?: string;
  phone?: string;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
};

export type AdminUserMembership = {
  businessId: string;
  businessName: string;
  businessDeletedAt: string | null;
  role: "OWNER" | "MANAGER" | "CASHIER";
};

export type AdminUserDetails = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  systemRole: "USER" | "PLATFORM_ADMIN";
  deletedAt: string | null;
  updatedAt: string;
  createdAt: string;
  memberships: AdminUserMembership[];
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

const toListUsersUrl = (params: ListAdminUsersParams) => {
  const query = new URLSearchParams();
  if (params.name?.trim()) query.set("name", params.name.trim());
  if (params.email?.trim()) query.set("email", params.email.trim());
  if (params.phone?.trim()) query.set("phone", params.phone.trim());
  if (params.includeDeleted) query.set("includeDeleted", "true");
  if (typeof params.page === "number") query.set("page", String(params.page));
  if (typeof params.limit === "number") query.set("limit", String(params.limit));
  const encoded = query.toString();
  return encoded ? `/api/admin/users?${encoded}` : "/api/admin/users";
};

export const listAdminUsers = async (
  params: ListAdminUsersParams = {},
): Promise<{ users: AdminUser[]; pagination: AdminUsersPagination }> => {
  const response = await apiFetch(toListUsersUrl(params), { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load users"));
  }
  const payload = (await response.json()) as {
    users?: AdminUser[];
    pagination?: AdminUsersPagination;
  };
  return {
    users: payload.users ?? [],
    pagination: payload.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      total: 0,
      totalPages: 0,
    },
  };
};

export const getAdminUser = async (userId: string): Promise<AdminUserDetails> => {
  const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load user"));
  }
  const payload = (await response.json()) as { user: AdminUserDetails };
  return payload.user;
};

export const updateAdminUser = async (
  userId: string,
  update: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<AdminUserDetails> => {
  const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to update user"));
  }
  const payload = (await response.json()) as { user: AdminUserDetails };
  return payload.user;
};
