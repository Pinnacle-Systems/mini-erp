import { BusinessRole, SystemRole } from "../../../generated/prisma/enums.js";
import * as argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/utils/errors.js";

const assertPlatformAdmin = (req) => {
  if (req.user?.system_role !== SystemRole.PLATFORM_ADMIN) {
    throw new ForbiddenError("Only platform admins can access this resource");
  }
};

const DEFAULT_OWNER_PASSWORD = process.env.DEFAULT_BUSINESS_OWNER_PASSWORD?.trim() || "ChangeMe123!";
const DUPLICATE_BUSINESS_NAME_ERROR = "Business name already exists for this owner";
const MODULE_KEYS = ["CATALOG", "INVENTORY", "PRICING"] as const;

const toModuleState = (
  rows: Array<{
    module_key: (typeof MODULE_KEYS)[number];
    enabled: boolean;
  }>,
) => {
  const byKey = new Map(rows.map((row) => [row.module_key, row.enabled]));
  return {
    catalog: byKey.get("CATALOG") ?? true,
    inventory: byKey.get("INVENTORY") ?? true,
    pricing: byKey.get("PRICING") ?? true,
  };
};

export const listStores = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const {
    businessName: rawBusinessName = "",
    ownerEmail: rawOwnerEmail = "",
    ownerPhone: rawOwnerPhone = "",
    includeDeleted: rawIncludeDeleted = false,
    page: rawPage = "1",
    limit: rawLimit = "10",
  } = req.query as {
    businessName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    includeDeleted?: string | boolean;
    page?: string;
    limit?: string;
  };
  const businessName = String(rawBusinessName);
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
        businesses: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }
  }

  const where = {
    ...(includeDeleted ? {} : { deleted_at: null }),
    ...(businessName ? { name: { contains: businessName, mode: "insensitive" as const } } : {}),
    ...(ownerIdentityIds ? { owner_id: { in: ownerIdentityIds } } : {}),
  };

  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const ownerIds = [...new Set(businesses.map((business) => business.owner_id))];
  const owners = await prisma.identity.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  res.json({
    success: true,
    businesses: businesses.map((business) => ({
      id: business.id,
      name: business.name,
      ownerId: business.owner_id,
      deletedAt: business.deleted_at,
      owner: ownerById.get(business.owner_id) ?? null,
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
  const normalizedBusinessName = name.trim();

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

  let business;
  try {
    const existingStore = await prisma.business.findFirst({
      where: {
        owner_id: ownerId,
        deleted_at: null,
        name: {
          equals: normalizedBusinessName,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingStore) {
      throw new ConflictError(DUPLICATE_BUSINESS_NAME_ERROR);
    }

    business = await prisma.business.create({
      data: {
        name: normalizedBusinessName,
        owner_id: ownerId,
      },
    });

    await prisma.businessMember.upsert({
      where: {
        business_id_identity_id: {
          business_id: business.id,
          identity_id: ownerId,
        },
      },
      update: {
        role: BusinessRole.OWNER,
      },
      create: {
        business_id: business.id,
        identity_id: ownerId,
        role: BusinessRole.OWNER,
      },
    });

    await prisma.businessModule.createMany({
      data: MODULE_KEYS.map((moduleKey) => ({
        business_id: business.id,
        module_key: moduleKey,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2002") {
        throw new ConflictError(DUPLICATE_BUSINESS_NAME_ERROR);
      }
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    business: {
      id: business.id,
      name: business.name,
      ownerId: business.owner_id,
    },
  });
});

export const getStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { businessId } = req.params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      owner_id: true,
      deleted_at: true,
      modules: {
        select: {
          module_key: true,
          enabled: true,
        },
      },
    },
  });

  if (!business) {
    throw new NotFoundError("Business not found");
  }

  const owner = await prisma.identity.findUnique({
    where: { id: business.owner_id },
    select: { id: true, name: true, email: true, phone: true },
  });

  res.json({
    success: true,
    business: {
      id: business.id,
      name: business.name,
      ownerId: business.owner_id,
      deletedAt: business.deleted_at,
      owner: owner ?? null,
      modules: toModuleState(business.modules as Array<{ module_key: (typeof MODULE_KEYS)[number]; enabled: boolean }>),
    },
  });
});

export const updateStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { businessId } = req.params;
  const { name, ownerId, isActive, modules } = req.body as {
    name?: string;
    ownerId?: string;
    isActive?: boolean;
    modules?: {
      catalog?: boolean;
      inventory?: boolean;
      pricing?: boolean;
    };
  };
  const normalizedBusinessName = typeof name === "string" ? name.trim() : undefined;

  if (ownerId) {
    const owner = await prisma.identity.findUnique({
      where: { id: ownerId, deleted_at: null },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundError("Owner identity not found");
    }
  }

  let business;
  try {
    business = await prisma.$transaction(async (tx) => {
      const existingStore = await tx.business.findUnique({
        where: { id: businessId },
        select: { id: true, owner_id: true, name: true },
      });

      if (!existingStore) {
        throw new NotFoundError("Business not found");
      }

      const targetOwnerId = ownerId ?? existingStore.owner_id;
      const targetBusinessName = normalizedBusinessName ?? existingStore.name;

      const duplicateStore = await tx.business.findFirst({
        where: {
          id: { not: existingStore.id },
          owner_id: targetOwnerId,
          deleted_at: null,
          name: {
            equals: targetBusinessName,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (duplicateStore) {
        throw new ConflictError(DUPLICATE_BUSINESS_NAME_ERROR);
      }

      const updatedStore = await tx.business.update({
        where: { id: existingStore.id },
        data: {
          ...(normalizedBusinessName !== undefined ? { name: normalizedBusinessName } : {}),
          ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
          ...(isActive !== undefined ? { deleted_at: isActive ? null : new Date() } : {}),
        },
      });

      if (modules) {
        const moduleUpdates: Array<{ module_key: (typeof MODULE_KEYS)[number]; enabled: boolean }> = [];
        if (typeof modules.catalog === "boolean") {
          moduleUpdates.push({ module_key: "CATALOG", enabled: modules.catalog });
        }
        if (typeof modules.inventory === "boolean") {
          moduleUpdates.push({ module_key: "INVENTORY", enabled: modules.inventory });
        }
        if (typeof modules.pricing === "boolean") {
          moduleUpdates.push({ module_key: "PRICING", enabled: modules.pricing });
        }

        for (const moduleUpdate of moduleUpdates) {
          await tx.businessModule.upsert({
            where: {
              business_id_module_key: {
                business_id: updatedStore.id,
                module_key: moduleUpdate.module_key,
              },
            },
            update: {
              enabled: moduleUpdate.enabled,
            },
            create: {
              business_id: updatedStore.id,
              module_key: moduleUpdate.module_key,
              enabled: moduleUpdate.enabled,
            },
          });
        }
      }

      await tx.businessMember.upsert({
        where: {
          business_id_identity_id: {
            business_id: updatedStore.id,
            identity_id: targetOwnerId,
          },
        },
        update: {
          role: BusinessRole.OWNER,
        },
        create: {
          business_id: updatedStore.id,
          identity_id: targetOwnerId,
          role: BusinessRole.OWNER,
        },
      });

      if (existingStore.owner_id !== targetOwnerId) {
        await tx.businessMember.updateMany({
          where: {
            business_id: updatedStore.id,
            identity_id: existingStore.owner_id,
            role: BusinessRole.OWNER,
          },
          data: {
            role: BusinessRole.MANAGER,
          },
        });
      }

      const businessModules = await tx.businessModule.findMany({
        where: { business_id: updatedStore.id },
        select: {
          module_key: true,
          enabled: true,
        },
      });

      return {
        ...updatedStore,
        modules: businessModules as Array<{ module_key: (typeof MODULE_KEYS)[number]; enabled: boolean }>,
      };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2025") {
        throw new NotFoundError("Business not found");
      }
      if (code === "P2002") {
        throw new ConflictError(DUPLICATE_BUSINESS_NAME_ERROR);
      }
    }
    throw error;
  }

  res.json({
    success: true,
    business: {
      id: business.id,
      name: business.name,
      ownerId: business.owner_id,
      deletedAt: business.deleted_at,
      modules: toModuleState(business.modules),
    },
  });
});

export const deleteStore = catchAsync(async (req, res) => {
  assertPlatformAdmin(req);

  const { businessId } = req.params;

  try {
    const deletedStore = await prisma.business.update({
      where: { id: businessId },
      data: {
        deleted_at: new Date(),
      },
    });

    if (!deletedStore) {
      throw new NotFoundError("Business not found");
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "P2025") {
        throw new NotFoundError("Business not found");
      }
      if (code === "P2003") {
        throw new ConflictError("Business cannot be deleted because related records exist");
      }
    }
    throw error;
  }

  res.json({
    success: true,
  });
});
