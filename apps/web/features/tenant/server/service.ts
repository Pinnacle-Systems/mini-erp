import { prisma } from "@/lib/prisma";
import { StoreRole } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/http";

const getStoresForIdentity = async (identityId: string) => {
  return prisma.store.findMany({
    where: {
      deleted_at: null,
      members: {
        some: {
          identity_id: identityId,
          deleted_at: null,
        },
      },
    },
  });
};

const validateMembership = async (identityId: string, storeId: string) => {
  return prisma.storeMember.findFirst({
    where: {
      identity_id: identityId,
      store_id: storeId,
      deleted_at: null,
    },
  });
};

type CreateStoreInput = {
  storeName: string;
  ownerIdentityId: string;
};

type ListStoresInput = {
  storeName?: string;
  ownerIdentityIds?: string[];
  page?: number;
  limit?: number;
};

type ListStoreOwnerIdsInput = {
  ownerIdentityIds?: string[];
  page: number;
  limit: number;
};

type UpdateStoreInput = {
  storeId: string;
  storeName?: string;
  isActive?: boolean;
};

type AddStoreMemberInput = {
  storeId: string;
  identityId: string;
  role: StoreRole;
};

type ListStoreMembersInput = {
  storeId: string;
};

type UpdateStoreMemberRoleInput = {
  memberId: string;
  storeId: string;
  role: StoreRole;
};

type SoftDeleteStoreMemberInput = {
  memberId: string;
  storeId: string;
};

const createStore = async ({
  storeName,
  ownerIdentityId,
}: CreateStoreInput) => {
  const normalizedStoreName = storeName.trim();

  try {
    return await prisma.$transaction(async (tx) => {
      const existingStore = await tx.store.findFirst({
        where: {
          owner_id: ownerIdentityId,
          deleted_at: null,
          name: {
            equals: normalizedStoreName,
            mode: "insensitive",
          },
        },
      });

      if (existingStore) {
        throw new ConflictError("Store name already exists for this owner");
      }

      return tx.store.create({
        data: {
          name: normalizedStoreName,
          owner_id: ownerIdentityId,
          members: {
            create: {
              identity_id: ownerIdentityId,
              role: StoreRole.OWNER,
            },
          },
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Store name already exists for this owner");
    }

    throw error;
  }
};

const listStores = async ({
  storeName,
  ownerIdentityIds,
  page,
  limit,
}: ListStoresInput) => {
  const where = {
    name: storeName
      ? {
        contains: storeName.trim(),
        mode: "insensitive" as const,
      }
      : undefined,
    owner_id:
      ownerIdentityIds && ownerIdentityIds.length > 0
        ? {
          in: ownerIdentityIds,
        }
        : undefined,
  };

  return prisma.store.findMany({
    where,
    orderBy: {
      created_at: "desc",
    },
    skip:
      page && limit
        ? (page - 1) * limit
        : undefined,
    take: limit,
  });
};

const countStores = async ({ storeName, ownerIdentityIds }: ListStoresInput) => {
  return prisma.store.count({
    where: {
      name: storeName
        ? {
          contains: storeName.trim(),
          mode: "insensitive",
        }
        : undefined,
      owner_id:
        ownerIdentityIds && ownerIdentityIds.length > 0
          ? {
            in: ownerIdentityIds,
          }
          : undefined,
    },
  });
};

const listStoreOwnerIds = async ({
  ownerIdentityIds,
  page,
  limit,
}: ListStoreOwnerIdsInput) => {
  const owners = await prisma.store.groupBy({
    by: ["owner_id"],
    where: {
      deleted_at: null,
      owner_id:
        ownerIdentityIds && ownerIdentityIds.length > 0
          ? {
            in: ownerIdentityIds,
          }
          : undefined,
    },
    _max: {
      created_at: true,
    },
    orderBy: {
      _max: {
        created_at: "desc",
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  return owners.map((owner) => owner.owner_id);
};

const countStoreOwners = async ({ ownerIdentityIds }: { ownerIdentityIds?: string[] }) => {
  const owners = await prisma.store.groupBy({
    by: ["owner_id"],
    where: {
      deleted_at: null,
      owner_id:
        ownerIdentityIds && ownerIdentityIds.length > 0
          ? {
            in: ownerIdentityIds,
          }
          : undefined,
    },
  });

  return owners.length;
};

const countStoresByOwnerId = async (ownerId: string) => {
  return prisma.store.count({
    where: {
      owner_id: ownerId,
    },
  });
};

const listStoresByOwnerId = async (ownerId: string) => {
  return prisma.store.findMany({
    where: {
      owner_id: ownerId,
    },
    orderBy: {
      created_at: "desc",
    },
  });
};

const getStoreById = async (storeId: string) => {
  return prisma.store.findUnique({
    where: {
      id: storeId,
    },
  });
};

const updateStore = async ({
  storeId,
  storeName,
  isActive,
}: UpdateStoreInput) => {
  const normalizedStoreName = storeName?.trim();

  try {
    return await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({
        where: {
          id: storeId,
        },
      });

      if (!store) {
        return null;
      }

      if (normalizedStoreName !== undefined) {
        const existingStore = await tx.store.findFirst({
          where: {
            id: {
              not: store.id,
            },
            owner_id: store.owner_id,
            deleted_at: null,
            name: {
              equals: normalizedStoreName,
              mode: "insensitive",
            },
          },
        });

        if (existingStore) {
          throw new ConflictError("Store name already exists for this owner");
        }
      }

      return tx.store.update({
        where: {
          id: store.id,
        },
        data: {
          name: normalizedStoreName,
          deleted_at:
            isActive === undefined
              ? undefined
              : isActive
                ? null
                : new Date(),
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Store name already exists for this owner");
    }

    throw error;
  }
};

const addStoreMember = async ({
  storeId,
  identityId,
  role,
}: AddStoreMemberInput) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const existingMember = await tx.storeMember.findFirst({
        where: {
          store_id: storeId,
          identity_id: identityId,
        },
      });

      if (existingMember && !existingMember.deleted_at) {
        throw new ConflictError("User is already a member of this store");
      }

      if (existingMember && existingMember.deleted_at) {
        return tx.storeMember.update({
          where: {
            id: existingMember.id,
          },
          data: {
            role,
            deleted_at: null,
          },
        });
      }

      return tx.storeMember.create({
        data: {
          store_id: storeId,
          identity_id: identityId,
          role,
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ConflictError("User is already a member of this store");
    }

    throw error;
  }
};

const listStoreMembers = async ({ storeId }: ListStoreMembersInput) => {
  return prisma.storeMember.findMany({
    where: {
      store_id: storeId,
      deleted_at: null,
    },
    orderBy: {
      created_at: "asc",
    },
  });
};

const getStoreMemberById = async (memberId: string, storeId: string) => {
  return prisma.storeMember.findFirst({
    where: {
      id: memberId,
      store_id: storeId,
      deleted_at: null,
    },
  });
};

const updateStoreMemberRole = async ({
  memberId,
  storeId,
  role,
}: UpdateStoreMemberRoleInput) => {
  const existingMember = await getStoreMemberById(memberId, storeId);
  if (!existingMember) {
    return null;
  }

  return prisma.storeMember.update({
    where: {
      id: existingMember.id,
    },
    data: {
      role,
    },
  });
};

const softDeleteStoreMember = async ({
  memberId,
  storeId,
}: SoftDeleteStoreMemberInput) => {
  const existingMember = await getStoreMemberById(memberId, storeId);
  if (!existingMember) {
    return null;
  }

  return prisma.storeMember.update({
    where: {
      id: existingMember.id,
    },
    data: {
      deleted_at: new Date(),
    },
  });
};

const tenantService = {
  getStoresForIdentity,
  validateMembership,
  createStore,
  listStores,
  countStores,
  listStoreOwnerIds,
  countStoreOwners,
  countStoresByOwnerId,
  listStoresByOwnerId,
  getStoreById,
  updateStore,
  addStoreMember,
  listStoreMembers,
  getStoreMemberById,
  updateStoreMemberRole,
  softDeleteStoreMember,
};

export default tenantService;
