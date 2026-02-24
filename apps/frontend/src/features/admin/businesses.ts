import { apiFetch } from "../../lib/api";

export type AdminStore = {
  id: string;
  name: string;
  ownerId: string;
  phoneNumber?: string | null;
  gstin?: string | null;
  email?: string | null;
  businessType?: string | null;
  businessCategory?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
  logo?: string | null;
  deletedAt?: string | null;
  modules?: {
    catalog: boolean;
    inventory: boolean;
    pricing: boolean;
  };
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export type AdminBusinessesPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListAdminBusinessesParams = {
  businessName?: string;
  ownerPhone?: string;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

const toListBusinessesUrl = (params: ListAdminBusinessesParams) => {
  const query = new URLSearchParams();
  if (params.businessName?.trim()) {
    query.set("businessName", params.businessName.trim());
  }
  if (params.ownerPhone?.trim()) {
    query.set("ownerPhone", params.ownerPhone.trim());
  }
  if (params.includeDeleted) {
    query.set("includeDeleted", "true");
  }
  if (typeof params.page === "number") {
    query.set("page", String(params.page));
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  const encoded = query.toString();
  return encoded ? `/api/admin/businesses?${encoded}` : "/api/admin/businesses";
};

export const listAdminStores = async (
  params: ListAdminBusinessesParams = {},
): Promise<{ businesses: AdminStore[]; pagination: AdminBusinessesPagination }> => {
  const response = await apiFetch(toListBusinessesUrl(params), { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load businesses"));
  }

  const payload = (await response.json()) as {
    businesses?: AdminStore[];
    pagination?: AdminBusinessesPagination;
  };
  return {
    businesses: payload.businesses ?? [],
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
  payload: {
    ownerPhone?: string;
    phoneNumber?: string;
    gstin?: string;
    email?: string;
    businessType?: string;
    businessCategory?: string;
    state?: string;
    pincode?: string;
    address?: string;
    logo?: string;
  },
): Promise<AdminStore> => {
  const response = await apiFetch("/api/admin/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      ...(payload.ownerPhone ? { ownerPhone: payload.ownerPhone.trim() } : {}),
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber.trim() } : {}),
      ...(payload.gstin ? { gstin: payload.gstin.trim() } : {}),
      ...(payload.email ? { email: payload.email.trim() } : {}),
      ...(payload.businessType ? { businessType: payload.businessType.trim() } : {}),
      ...(payload.businessCategory ? { businessCategory: payload.businessCategory.trim() } : {}),
      ...(payload.state ? { state: payload.state.trim() } : {}),
      ...(payload.pincode ? { pincode: payload.pincode.trim() } : {}),
      ...(payload.address ? { address: payload.address.trim() } : {}),
      ...(payload.logo ? { logo: payload.logo.trim() } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create business"));
  }

  const responseBody = (await response.json()) as { business: AdminStore };
  return responseBody.business;
};

export const updateAdminStore = async (
  businessId: string,
  update: {
    name?: string;
    ownerId?: string;
    isActive?: boolean;
    phoneNumber?: string | null;
    gstin?: string | null;
    email?: string | null;
    businessType?: string | null;
    businessCategory?: string | null;
    state?: string | null;
    pincode?: string | null;
    address?: string | null;
    logo?: string | null;
    modules?: {
      catalog?: boolean;
      inventory?: boolean;
      pricing?: boolean;
    };
  },
): Promise<AdminStore> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to update business"));
  }

  const payload = (await response.json()) as { business: AdminStore };
  return payload.business;
};

export const getAdminStore = async (businessId: string): Promise<AdminStore> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load business"));
  }

  const payload = (await response.json()) as { business: AdminStore };
  return payload.business;
};

export const deleteAdminStore = async (businessId: string): Promise<void> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to delete business"));
  }
};

export const uploadBusinessLogo = async (
  businessId: string,
  payload: { fileName?: string; mimeType: string; dataBase64: string },
): Promise<{ logo: string }> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/logo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallbackMessage =
      response.status === 413
        ? "Logo file is too large. Please use an image up to 2MB."
        : "Unable to upload business logo";
    throw new Error(await parseError(response, fallbackMessage));
  }

  const data = (await response.json()) as { logo: string };
  return { logo: data.logo };
};

export const removeBusinessLogo = async (businessId: string): Promise<void> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/logo`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to remove business logo"));
  }
};
