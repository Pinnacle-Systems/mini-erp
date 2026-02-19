import { SystemRole } from "../../../generated/prisma/enums.js";
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

export const listStores = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const {
    storeName: rawStoreName = "",
    ownerEmail: rawOwnerEmail = "",
    ownerPhone: rawOwnerPhone = "",
    page: rawPage = "1",
    limit: rawLimit = "10",
  } = req.query as {
    storeName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    page?: string;
    limit?: string;
  };
  const storeName = String(rawStoreName);
  const ownerEmail = String(rawOwnerEmail);
  const ownerPhone = String(rawOwnerPhone);
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

  const store = await prisma.store.create({
    data: {
      name,
      owner_id: ownerId,
    },
  });

  res.status(201).json({
    success: true,
    store: {
      id: store.id,
      name: store.name,
      ownerId: store.owner_id,
    },
  });
});

export const updateStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { storeId } = req.params;
  const { name, ownerId } = req.body;

  if (ownerId) {
    const owner = await prisma.identity.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundError("Owner identity not found");
    }
  }

  let store;
  try {
    store = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2025") {
        throw new NotFoundError("Store not found");
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
    await prisma.store.delete({
      where: { id: storeId },
    });
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
