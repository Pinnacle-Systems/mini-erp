import { authService } from "@/features/auth/server";
import { tenantService } from "@/features/tenant/server";
import {
  ListStoreOwnersQuery,
  ListStoresQuery,
  OnboardStoreBody,
  UpdateStoreBody,
  UpdateStoreOwnerBody,
} from "@/features/admin/schemas";
import { BadRequestError } from "@/lib/http";

const onboardStore = async ({
  storeName,
  ownerName,
  ownerEmail,
  ownerPhone,
}: OnboardStoreBody) => {
  const ownerResult = await authService.findOrCreateIdentity({
    name: ownerName,
    email: ownerEmail,
    phone: ownerPhone,
  });

  const store = await tenantService.createStore({
    storeName,
    ownerIdentityId: ownerResult.identity.id,
  });

  return {
    store,
    ownerIdentityId: ownerResult.identity.id,
    ownerCreated: ownerResult.wasCreated,
    defaultPassword: ownerResult.defaultPassword,
  };
};

const listStores = async ({
  storeName,
  ownerEmail,
  ownerPhone,
  page,
  limit,
}: ListStoresQuery) => {
  let ownerIdentityIds: string[] | undefined;

  if (ownerEmail || ownerPhone) {
    const matchingOwners = await authService.searchIdentities({
      email: ownerEmail,
      phone: ownerPhone,
    });

    ownerIdentityIds = matchingOwners.map((owner) => owner.id);
    if (ownerIdentityIds.length === 0) {
      return {
        stores: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  const [total, stores] = await Promise.all([
    tenantService.countStores({
      storeName,
      ownerIdentityIds,
    }),
    tenantService.listStores({
      storeName,
      ownerIdentityIds,
      page,
      limit,
    }),
  ]);

  const owners = await authService.getIdentitiesByIds(
    [...new Set(stores.map((store) => store.owner_id))],
  );
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return {
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
      createdAt: store.created_at,
      deletedAt: store.deleted_at,
      owner: ownerById.get(store.owner_id) ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listStoreOwners = async ({
  ownerEmail,
  ownerPhone,
  page,
  limit,
}: ListStoreOwnersQuery) => {
  let ownerIdentityIds: string[] | undefined;

  if (ownerEmail || ownerPhone) {
    const matchingOwners = await authService.searchIdentities({
      email: ownerEmail,
      phone: ownerPhone,
    });

    ownerIdentityIds = matchingOwners.map((owner) => owner.id);
    if (ownerIdentityIds.length === 0) {
      return {
        owners: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  const [total, pagedOwnerIds] = await Promise.all([
    tenantService.countStoreOwners({
      ownerIdentityIds,
    }),
    tenantService.listStoreOwnerIds({
      ownerIdentityIds,
      page,
      limit,
    }),
  ]);

  const owners = await authService.getIdentitiesByIds(pagedOwnerIds);
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return {
    owners: pagedOwnerIds
      .map((ownerId) => ownerById.get(ownerId))
      .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getStoreById = async (storeId: string) => {
  const store = await tenantService.getStoreById(storeId);

  if (!store) {
    throw new BadRequestError("Store not found");
  }

  const [owner] = await authService.getIdentitiesByIds([store.owner_id]);

  return {
    id: store.id,
    name: store.name,
    ownerId: store.owner_id,
    createdAt: store.created_at,
    deletedAt: store.deleted_at,
    owner: owner ?? null,
  };
};

const getStoreOwnerById = async (ownerId: string) => {
  const ownedStoreCount = await tenantService.countStoresByOwnerId(ownerId);
  if (ownedStoreCount === 0) {
    throw new BadRequestError("Store owner not found");
  }

  const owner = await authService.getIdentityById(ownerId);
  if (!owner) {
    throw new BadRequestError("Store owner not found");
  }

  const stores = await tenantService.listStoresByOwnerId(ownerId);

  return {
    owner,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      createdAt: store.created_at,
      deletedAt: store.deleted_at,
    })),
  };
};

const updateStore = async (
  storeId: string,
  { storeName, isActive }: UpdateStoreBody,
) => {
  const updatedStore = await tenantService.updateStore({
    storeId,
    storeName,
    isActive,
  });

  if (!updatedStore) {
    throw new BadRequestError("Store not found");
  }

  return {
    id: updatedStore.id,
    name: updatedStore.name,
    ownerId: updatedStore.owner_id,
    createdAt: updatedStore.created_at,
    deletedAt: updatedStore.deleted_at,
  };
};

const updateStoreOwner = async (
  ownerId: string,
  { ownerName, ownerEmail, ownerPhone }: UpdateStoreOwnerBody,
) => {
  const ownedStoreCount = await tenantService.countStoresByOwnerId(ownerId);
  if (ownedStoreCount === 0) {
    throw new BadRequestError("Store owner not found");
  }

  const updatedOwner = await authService.updateIdentity({
    identityId: ownerId,
    name: ownerName,
    email: ownerEmail,
    phone: ownerPhone,
  });

  return updatedOwner;
};

const adminService = {
  onboardStore,
  listStores,
  listStoreOwners,
  getStoreById,
  getStoreOwnerById,
  updateStore,
  updateStoreOwner,
};

export default adminService;
