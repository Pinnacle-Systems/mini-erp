import { catchAsync } from "../../shared/utils/catchAsync.js";
import { UnauthorizedError } from "../../shared/utils/errors.js";
import { getClientIp } from "../../shared/utils/getIp.js";
import authService, { REFRESH_TOKEN_EXPIRY_MS } from "./auth.service.js";
import { SystemRole } from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  signAccessToken,
  signTempToken,
  verifyAccessToken,
} from "../../shared/utils/token.utils.js";
import tenantService from "../tenant/tenant.service.js";

const toModuleState = (
  rows: Array<{ module_key: "CATALOG" | "INVENTORY" | "PRICING"; enabled: boolean }>,
) => {
  const byKey = new Map(rows.map((row) => [row.module_key, row.enabled]));
  return {
    catalog: byKey.get("CATALOG") ?? true,
    inventory: byKey.get("INVENTORY") ?? true,
    pricing: byKey.get("PRICING") ?? true,
  };
};

const getStoreModules = async (storeId: string) => {
  const rows = await prisma.storeModule.findMany({
    where: { store_id: storeId },
    select: { module_key: true, enabled: true },
  });

  return toModuleState(
    rows as Array<{ module_key: "CATALOG" | "INVENTORY" | "PRICING"; enabled: boolean }>,
  );
};

export const login = catchAsync(async (req, res) => {
  const { phone = "", password = "" } = req.body;

  const identity = await authService.searchIdentity(phone, password);

  const userAgent = req.headers["user-agent"] ?? "unknown";
  const ipAddress = getClientIp(req);

  const { session, refreshToken } = await authService.createSession(
    identity,
    userAgent,
    ipAddress,
  );

  res.cookie("refreshToken", `${session.id}.${refreshToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
  });

  if (identity.system_role === SystemRole.PLATFORM_ADMIN) {
    const accessToken = await signAccessToken(identity, session);

    return res.json({
      success: true,
      token: accessToken,
      role: SystemRole.PLATFORM_ADMIN,
    });
  }

  const tempToken = await signTempToken(identity, session);

  const stores = await tenantService.getStoresForIdentity(identity.id);

  res.json({
    success: true,
    token: tempToken,
    role: SystemRole.USER,
    availableStores: stores,
  });
});

export const logout = catchAsync(async (req, res) => {
  const refreshToken = typeof req.cookies?.refreshToken === "string"
    ? req.cookies.refreshToken
    : "";
  const [sessionId] = refreshToken.split(".");
  await authService.revokeSession(sessionId);
  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
  });
  res.json({ success: true });
});

export const refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new UnauthorizedError("Session expired.");
  }

  const { session, refreshToken: newRefreshToken } =
    await authService.verifySession(refreshToken);

  res.cookie("refreshToken", `${session.id}.${newRefreshToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
  });

  if (session.identity.system_role === SystemRole.PLATFORM_ADMIN) {
    const accessToken = await signAccessToken(session.identity, session);

    return res.json({
      success: true,
      token: accessToken,
      role: SystemRole.PLATFORM_ADMIN,
    });
  }

  const { currentStoreId } = (req.body ?? {}) as { currentStoreId?: string };

  if (currentStoreId) {
    const member = await tenantService.validateMembership(
      session.identity_id,
      currentStoreId,
    );

    const token = await signAccessToken(session.identity, session, {
      tenantId: currentStoreId,
      memberRole: member.role,
    });

    return res.json({
      success: true,
      token,
      role: SystemRole.USER,
    });
  }

  const tempToken = await signTempToken(session.identity, session);

  const stores = await tenantService.getStoresForIdentity(session.identity.id);

  res.json({
    success: true,
    token: tempToken,
    role: SystemRole.USER,
    availableStores: stores,
  });
});

export const selectStore = catchAsync(async (req, res) => {
  const { storeId = "" } = req.body;
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";

  if (!token) {
    throw new UnauthorizedError("Unauthorized");
  }

  const payload = await verifyAccessToken(token);
  if (
    !payload ||
    payload.systemRole !== SystemRole.USER ||
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string"
  ) {
    throw new UnauthorizedError("Unauthorized");
  }

  const member = await tenantService.validateMembership(payload.sub, storeId);
  if (!member) {
    throw new UnauthorizedError("Access denied");
  }

  const accessToken = await signAccessToken(
    {
      id: payload.sub,
      system_role: SystemRole.USER,
    },
    {
      id: payload.sid,
    },
    {
      tenantId: storeId,
      memberRole: member.role,
    },
  );
  const modules = await getStoreModules(storeId);

  res.json({
    success: true,
    role: SystemRole.USER,
    tenantId: storeId,
    memberRole: member.role,
    token: accessToken,
    modules,
  });
});

export const getMe = catchAsync(async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";

  if (!token) {
    throw new UnauthorizedError("Unauthorized");
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    throw new UnauthorizedError("Unauthorized");
  }

  let stores = [];
  if (payload.systemRole === SystemRole.USER && typeof payload.sub === "string") {
    stores = await tenantService.getStoresForIdentity(payload.sub);
  }
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;
  const modules = tenantId ? await getStoreModules(tenantId) : null;

  res.json({
    success: true,
    role: payload.systemRole ?? null,
    identityId: payload.sub ?? null,
    tenantId,
    stores,
    modules,
  });
});
