import { apiAssetUrl, apiFetch } from "../../lib/api";

export const BUNDLE_KEYS = [
  "SALES_LITE",
  "SALES_STOCK_OUT",
  "TRADING",
  "SERVICE_BILLING",
  "CUSTOM",
] as const;
export const CAPABILITY_KEYS = [
  "ITEM_PRODUCTS",
  "ITEM_SERVICES",
  "PARTIES_CUSTOMERS",
  "PARTIES_SUPPLIERS",
  "TXN_SALE_CREATE",
  "TXN_SALE_RETURN",
  "TXN_PURCHASE_CREATE",
  "TXN_PURCHASE_RETURN",
  "INV_STOCK_OUT",
  "INV_STOCK_IN",
  "INV_ADJUSTMENT",
  "INV_TRANSFER",
  "FINANCE_RECEIVABLES",
  "FINANCE_PAYABLES",
] as const;
export const BUNDLE_CAPABILITY_MAP: Record<BundleKey, CapabilityKey[]> = {
  SALES_LITE: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  SALES_STOCK_OUT: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "INV_STOCK_OUT",
    "FINANCE_RECEIVABLES",
  ],
  TRADING: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "PARTIES_SUPPLIERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "TXN_PURCHASE_CREATE",
    "TXN_PURCHASE_RETURN",
    "INV_STOCK_OUT",
    "INV_STOCK_IN",
    "INV_ADJUSTMENT",
    "INV_TRANSFER",
    "FINANCE_RECEIVABLES",
    "FINANCE_PAYABLES",
  ],
  SERVICE_BILLING: [
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  CUSTOM: [],
};

export type BundleKey = (typeof BUNDLE_KEYS)[number];
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

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
    sales: boolean;
    pricing: boolean;
  };
  license?: {
    beginsOn: string;
    endsOn: string;
    bundleKey: BundleKey;
    addOnCapabilities: CapabilityKey[];
    removedCapabilities: CapabilityKey[];
    userLimitType: "MAX_USERS" | "MAX_CONCURRENT_USERS" | null;
    userLimitValue: number | null;
  } | null;
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

export type AdminOwnerLookupResult = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
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

const normalizeStore = (store: AdminStore): AdminStore => ({
  ...store,
  logo: store.logo ? apiAssetUrl(store.logo) : store.logo,
});

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
    businesses: (payload.businesses ?? []).map(normalizeStore),
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
    ownerId?: string;
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
    license?: {
      beginsOn?: string | null;
      endsOn?: string | null;
      bundleKey?: BundleKey | null;
      addOnCapabilities?: CapabilityKey[];
      removedCapabilities?: CapabilityKey[];
      userLimitType?: "MAX_USERS" | "MAX_CONCURRENT_USERS" | null;
      userLimitValue?: number | null;
    };
  },
): Promise<AdminStore> => {
  const response = await apiFetch("/api/admin/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      ...(payload.ownerId ? { ownerId: payload.ownerId } : {}),
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
      ...(payload.license ? { license: payload.license } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create business"));
  }

  const responseBody = (await response.json()) as { business: AdminStore };
  return normalizeStore(responseBody.business);
};

export const lookupAdminOwners = async (
  query: string,
  limit = 8,
): Promise<AdminOwnerLookupResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const encoded = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  }).toString();
  const response = await apiFetch(`/api/admin/owners/lookup?${encoded}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load owners"));
  }

  const payload = (await response.json()) as { owners?: AdminOwnerLookupResult[] };
  return payload.owners ?? [];
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
    license?: {
      beginsOn?: string | null;
      endsOn?: string | null;
      bundleKey?: BundleKey | null;
      addOnCapabilities?: CapabilityKey[];
      removedCapabilities?: CapabilityKey[];
      userLimitType?: "MAX_USERS" | "MAX_CONCURRENT_USERS" | null;
      userLimitValue?: number | null;
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
  return normalizeStore(payload.business);
};

export const getAdminStore = async (businessId: string): Promise<AdminStore> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load business"));
  }

  const payload = (await response.json()) as { business: AdminStore };
  return normalizeStore(payload.business);
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
  return { logo: apiAssetUrl(data.logo) };
};

export const removeBusinessLogo = async (businessId: string): Promise<void> => {
  const response = await apiFetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/logo`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to remove business logo"));
  }
};
