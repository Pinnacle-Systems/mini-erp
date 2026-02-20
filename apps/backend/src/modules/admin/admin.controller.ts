import { StoreRole, SystemRole } from "../../../generated/prisma/enums.js";
import * as argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/utils/errors.js";

const assertPlatformAdmin = (req) => {
  if (req.user?.system_role !== SystemRole.PLATFORM_ADMIN) {
    throw new ForbiddenError("Only platform admins can access this resource");
  }
};

const DEFAULT_OWNER_PASSWORD = process.env.DEFAULT_STORE_OWNER_PASSWORD?.trim() || "ChangeMe123!";
const DUPLICATE_STORE_NAME_ERROR = "Store name already exists for this owner";

export const listStores = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const {
    storeName: rawStoreName = "",
    ownerEmail: rawOwnerEmail = "",
    ownerPhone: rawOwnerPhone = "",
    includeDeleted: rawIncludeDeleted = false,
    page: rawPage = "1",
    limit: rawLimit = "10",
  } = req.query as {
    storeName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    includeDeleted?: string | boolean;
    page?: string;
    limit?: string;
  };
  const storeName = String(rawStoreName);
  const ownerEmail = String(rawOwnerEmail);
  const ownerPhone = String(rawOwnerPhone);
  const includeDeleted =
    rawIncludeDeleted === true ||
    (typeof rawIncludeDeleted === "string" &&
      rawIncludeDeleted.trim().toLowerCase() === "true");
  const page = Number(rawPage);
  const limit = Number(rawLimit);

  let ownerIdentityIds: string[] | undefined;
  if (ownerEmail || ownerPhone) {
    const owners = await prisma.identity.findMany({
      where: {
        deleted_at: null,
        ...(ownerEmail ? { email: { contains: ownerEmail, mode: "insensitive" } } : {}),
        ...(ownerPhone ? { phone: { contains: ownerPhone } } : {}),
      },
      select: { id: true },
    });

    ownerIdentityIds = owners.map((owner) => owner.id);
    if (ownerIdentityIds.length === 0) {
      return res.json({
        success: true,
        stores: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }
  }

  const where = {
    ...(includeDeleted ? {} : { deleted_at: null }),
    ...(storeName ? { name: { contains: storeName, mode: "insensitive" as const } } : {}),
    ...(ownerIdentityIds ? { owner_id: { in: ownerIdentityIds } } : {}),
  };

  const [total, stores] = await Promise.all([
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const ownerIds = [...new Set(stores.map((store) => store.owner_id))];
  const owners = await prisma.identity.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  res.json({
    success: true,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
      deletedAt: store.deleted_at,
      owner: ownerById.get(store.owner_id) ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const createStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { name, ownerEmail, ownerPhone } = req.body as {
    name: string;
    ownerEmail?: string;
    ownerPhone?: string;
  };
  const normalizedEmail = ownerEmail?.trim().toLowerCase();
  const normalizedPhone = ownerPhone?.trim();

  let ownerByPhone: { id: string } | null = null;
  let ownerByEmail: { id: string } | null = null;

  if (normalizedPhone) {
    ownerByPhone = await prisma.identity.findFirst({
      where: {
        phone: normalizedPhone,
        deleted_at: null,
      },
      select: { id: true },
    });
  }

  if (normalizedEmail) {
    ownerByEmail = await prisma.identity.findFirst({
      where: {
        email: normalizedEmail,
        deleted_at: null,
      },
      select: { id: true },
    });
  }

  if (ownerByPhone && ownerByEmail && ownerByPhone.id !== ownerByEmail.id) {
    throw new ConflictError("Provided email and phone match different identities");
  }

  let ownerId = ownerByPhone?.id ?? ownerByEmail?.id;
  const normalizedStoreName = name.trim();

  if (!ownerId) {
    const passwordHash = await argon2.hash(DEFAULT_OWNER_PASSWORD);
    const createdOwner = await prisma.identity.create({
      data: {
        email: normalizedEmail ?? null,
        phone: normalizedPhone ?? null,
        password_hash: passwordHash,
      },
      select: { id: true },
    });
    ownerId = createdOwner.id;
  }

  let store;
  try {
    const existingStore = await prisma.store.findFirst({
      where: {
        owner_id: ownerId,
        deleted_at: null,
        name: {
          equals: normalizedStoreName,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingStore) {
      throw new ConflictError(DUPLICATE_STORE_NAME_ERROR);
    }

    store = await prisma.store.create({
      data: {
        name: normalizedStoreName,
        owner_id: ownerId,
      },
    });

    await prisma.storeMember.upsert({
      where: {
        store_id_identity_id: {
          store_id: store.id,
          identity_id: ownerId,
        },
      },
      update: {
        role: StoreRole.OWNER,
      },
      create: {
        store_id: store.id,
        identity_id: ownerId,
        role: StoreRole.OWNER,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2002") {
        throw new ConflictError(DUPLICATE_STORE_NAME_ERROR);
      }
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    store: {
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
    },
  });
});

export const getStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { storeId } = req.params;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      owner_id: true,
      deleted_at: true,
    },
  });

  if (!store) {
    throw new NotFoundError("Store not found");
  }

  const owner = await prisma.identity.findUnique({
    where: { id: store.owner_id },
    select: { id: true, name: true, email: true, phone: true },
  });

  res.json({
    success: true,
    store: {
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
      deletedAt: store.deleted_at,
      owner: owner ?? null,
    },
  });
});

export const updateStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { storeId } = req.params;
  const { name, ownerId, isActive } = req.body as {
    name?: string;
    ownerId?: string;
    isActive?: boolean;
  };
  const normalizedStoreName = typeof name === "string" ? name.trim() : undefined;

  if (ownerId) {
    const owner = await prisma.identity.findUnique({
      where: { id: ownerId, deleted_at: null },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundError("Owner identity not found");
    }
  }

  let store;
  try {
    store = await prisma.$transaction(async (tx) => {
      const existingStore = await tx.store.findUnique({
        where: { id: storeId },
        select: { id: true, owner_id: true, name: true },
      });

      if (!existingStore) {
        throw new NotFoundError("Store not found");
      }

      const targetOwnerId = ownerId ?? existingStore.owner_id;
      const targetStoreName = normalizedStoreName ?? existingStore.name;

      const duplicateStore = await tx.store.findFirst({
        where: {
          id: { not: existingStore.id },
          owner_id: targetOwnerId,
          deleted_at: null,
          name: {
            equals: targetStoreName,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (duplicateStore) {
        throw new ConflictError(DUPLICATE_STORE_NAME_ERROR);
      }

      const updatedStore = await tx.store.update({
        where: { id: existingStore.id },
        data: {
          ...(normalizedStoreName !== undefined ? { name: normalizedStoreName } : {}),
          ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
          ...(isActive !== undefined ? { deleted_at: isActive ? null : new Date() } : {}),
        },
      });

      await tx.storeMember.upsert({
        where: {
          store_id_identity_id: {
            store_id: updatedStore.id,
            identity_id: targetOwnerId,
          },
        },
        update: {
          role: StoreRole.OWNER,
        },
        create: {
          store_id: updatedStore.id,
          identity_id: targetOwnerId,
          role: StoreRole.OWNER,
        },
      });

      if (existingStore.owner_id !== targetOwnerId) {
        await tx.storeMember.updateMany({
          where: {
            store_id: updatedStore.id,
            identity_id: existingStore.owner_id,
            role: StoreRole.OWNER,
          },
          data: {
            role: StoreRole.MANAGER,
          },
        });
      }

      return updatedStore;
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2025") {
        throw new NotFoundError("Store not found");
      }
      if (code === "P2002") {
        throw new ConflictError(DUPLICATE_STORE_NAME_ERROR);
      }
    }
    throw error;
  }

  res.json({
    success: true,
    store: {
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
    },
  });
});

export const deleteStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { storeId } = req.params;

  try {
    const deletedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        deleted_at: new Date(),
      },
    });

    if (!deletedStore) {
      throw new NotFoundError("Store not found");
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2025") {
        throw new NotFoundError("Store not found");
      }
      if (code === "P2003") {
        throw new ConflictError("Store cannot be deleted because related records exist");
      }
    }
    throw error;
  }

  res.json({
    success: true,
  });
});
