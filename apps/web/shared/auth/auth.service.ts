import * as argon2 from "argon2";
import { prisma } from "../prisma";
import { ForbiddenError, UnauthorizedError } from "./errors";

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

const authService = {
  createSession,
  searchIdentity,
  verifySession,
};

export default authService;
