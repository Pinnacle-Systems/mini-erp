import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../lib/prisma.js";
import * as argon2 from "argon2";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../../shared/utils/errors.js";

export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const createSession = async (identity, userAgent, ipAddress) => {
  const refreshToken = uuidv4();
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

  return {
    session,
    refreshToken,
  };
};

const searchIdentity = async (phone, password) => {
  const identity = await prisma.identity.findFirst({
    where: {
      phone,
    },
  });

  if (!identity || !(await argon2.verify(identity.password_hash, password))) {
    throw new UnauthorizedError("Invalid credentials");
  }

  return identity;
};

const verifySession = async (refreshToken) => {
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
    console.log("Suspicious activity detected. All sessions revoked.");
    await prisma.session.deleteMany({
      where: {
        identity_id: session.identity_id,
      },
    });

    throw new UnauthorizedError("Session expired");
  }

  const newRefreshToken = uuidv4();
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

export const getIdentity = async (id) => {
  return prisma.identity.findUnique({
    where: {
      id,
    },
  });
};

const revokeSession = async (sessionId) => {
  if (!sessionId) return;
  await prisma.session.deleteMany({
    where: {
      id: sessionId,
    },
  });
};

export default {
  createSession,
  searchIdentity,
  getIdentity,
  verifySession,
  revokeSession,
};
