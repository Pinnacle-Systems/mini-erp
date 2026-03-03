import { apiFetch } from "../../lib/api";

export type CustomerGroupMember = {
  customerId: string;
  name: string;
  partyType: "CUSTOMER" | "SUPPLIER" | "BOTH";
  isActive: boolean;
  deletedAt: string | null;
};

export type CustomerGroup = {
  id: string;
  name: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  members: CustomerGroupMember[];
};

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
};

export const listCustomerGroups = async (tenantId: string): Promise<CustomerGroup[]> => {
  const query = new URLSearchParams({ tenantId });
  const response = await apiFetch(`/api/customer-groups?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load customer groups"));
  }

  const payload = (await response.json()) as { groups?: CustomerGroup[] };
  return payload.groups ?? [];
};

export const createCustomerGroup = async (
  input: {
    tenantId: string;
    name: string;
    isActive: boolean;
    memberIds: string[];
  },
): Promise<CustomerGroup> => {
  const response = await apiFetch("/api/customer-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create customer group"));
  }

  const payload = (await response.json()) as { group: CustomerGroup };
  return payload.group;
};

export const updateCustomerGroup = async (
  groupId: string,
  input: {
    tenantId: string;
    name: string;
    isActive: boolean;
    memberIds: string[];
  },
): Promise<CustomerGroup> => {
  const response = await apiFetch(`/api/customer-groups/${encodeURIComponent(groupId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to update customer group"));
  }

  const payload = (await response.json()) as { group: CustomerGroup };
  return payload.group;
};

export const deleteCustomerGroup = async (
  groupId: string,
  tenantId: string,
): Promise<void> => {
  const response = await apiFetch(`/api/customer-groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to delete customer group"));
  }
};
