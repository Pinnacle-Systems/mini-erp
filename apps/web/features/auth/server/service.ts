import * as argon2 from "argon2";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const createSession = async (
  identity: { id: string },
  userAgent: string,
  ipAddress: string,
) => {
  const refreshToken = crypto.randomUUID();
  const tokenHash = await argon2.hash(refreshToken);

  const session = await prisma.session.create({
    data: {
      identity_id: identity.id,
      token_hash: tokenHash,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });

  return { session, refreshToken };
};

const searchIdentity = async (phone: string, email: string, password: string) => {
  const identity = await prisma.identity.findFirst({
    where: {
      OR: [{ phone }, { email }],
    },
  });

  if (!identity || !(await argon2.verify(identity.password_hash, password))) {
    throw new UnauthorizedError("Invalid credentials");
  }

  return identity;
};

const verifySession = async (refreshToken: string) => {
  const [sessionId, token] = refreshToken.split(".");

  if (!sessionId || !token) {
    throw new ForbiddenError("Session expired");
  }

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      identity: true,
    },
  });

  if (!session || !(await argon2.verify(session.token_hash, token))) {
    throw new ForbiddenError("Session expired");
  }

  if (session.expires_at < new Date()) {
    await prisma.session.deleteMany({
      where: {
        identity_id: session.identity_id,
      },
    });

    throw new UnauthorizedError("Session expired");
  }

  const newRefreshToken = crypto.randomUUID();
  const tokenHash = await argon2.hash(newRefreshToken);

  const refreshedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
    include: {
      identity: true,
    },
  });

  return { session: refreshedSession, refreshToken: newRefreshToken };
};

const DEFAULT_OWNER_PASSWORD = process.env.DEFAULT_OWNER_PASSWORD ?? "ChangeMe123!";

type FindOrCreateIdentityInput = {
  name?: string;
  email?: string;
  phone?: string;
};

type SearchIdentitiesInput = {
  email?: string;
  phone?: string;
};

type UpdateIdentityInput = {
  identityId: string;
  name?: string;
  email?: string;
  phone?: string;
};

const findOrCreateIdentity = async ({
  name,
  email,
  phone,
}: FindOrCreateIdentityInput) => {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.trim();

  const lookup = [
    normalizedEmail ? { email: normalizedEmail } : null,
    normalizedPhone ? { phone: normalizedPhone } : null,
  ].filter((condition): condition is { email: string } | { phone: string } => Boolean(condition));

  if (lookup.length === 0) {
    throw new BadRequestError("Owner email or phone is required");
  }

  return prisma.$transaction(async (tx) => {
    const existingIdentity = await tx.identity.findFirst({
      where: {
        OR: lookup,
      },
    });

    if (existingIdentity) {
      return {
        identity: existingIdentity,
        wasCreated: false,
        defaultPassword: null as string | null,
      };
    }

    const passwordHash = await argon2.hash(DEFAULT_OWNER_PASSWORD);

    const createdIdentity = await tx.identity.create({
      data: {
        name: name?.trim() || null,
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: passwordHash,
      },
    });

    return {
      identity: createdIdentity,
      wasCreated: true,
      defaultPassword: DEFAULT_OWNER_PASSWORD,
    };
  });
};

const searchIdentities = async ({
  email,
  phone,
}: SearchIdentitiesInput) => {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.trim();

  const andConditions = [
    normalizedEmail
      ? {
        email: {
          contains: normalizedEmail,
          mode: "insensitive" as const,
        },
      }
      : null,
    normalizedPhone
      ? {
        phone: {
          contains: normalizedPhone,
        },
      }
      : null,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

  return prisma.identity.findMany({
    where: andConditions.length > 0 ? { AND: andConditions } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
    orderBy: {
      created_at: "desc",
    },
  });
};

const getIdentitiesByIds = async (identityIds: string[]) => {
  if (identityIds.length === 0) {
    return [];
  }

  return prisma.identity.findMany({
    where: {
      id: {
        in: identityIds,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });
};

const getIdentityById = async (identityId: string) => {
  return prisma.identity.findUnique({
    where: {
      id: identityId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });
};

const updateIdentity = async ({
  identityId,
  name,
  email,
  phone,
}: UpdateIdentityInput) => {
  const normalizedName = name?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.trim();

  if (!normalizedEmail && !normalizedPhone) {
    throw new BadRequestError("Owner email or phone is required");
  }

  try {
    return await prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        name: normalizedName || null,
        email: normalizedEmail || null,
        phone: normalizedPhone || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Email or phone already exists");
    }

    throw error;
  }
};

const authService = {
  createSession,
  searchIdentity,
  verifySession,
  findOrCreateIdentity,
  searchIdentities,
  getIdentitiesByIds,
  getIdentityById,
  updateIdentity,
};

export default authService;
