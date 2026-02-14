import { catchAsync } from "../../shared/utils/catchAsync.js";
import { AppError, UnauthorizedError } from "../../shared/utils/errors.js";
import { getClientIp } from "../../shared/utils/getIp.js";
import authService, { REFRESH_TOKEN_EXPIRY_MS } from "./auth.service.js";
import { SystemRole } from "../../../generated/prisma/enums.js";
import {
  signAccessToken,
  signTempToken,
} from "../../shared/utils/token.utils.js";
import tenantService from "../tenant/tenant.service.js";

export const login = catchAsync(async (req, res) => {
  const { email = "", phone = "", password = "" } = req.body;

  const identity = await authService.searchIdentity(phone, email, password);

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
  console.log("reached logout");
  res.json({});
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

  const { currentStoreId } = req.body;

  if (currentStoreId) {
    const member = await tenantService.validateMembership(
      session.identity_id,
      currentStoreId,
    );

    const token = await signAccessToken(session.identity, session, {
      tenantId: currentStoreId,
      memberRole: member.role,
    });

    return {
      success: true,
      token,
      role: SystemRole.USER,
    };
  }

  const tempToken = await signTempToken(session.identity, session);

  const stores = await tenantService.getStoresForIdentity(identity.id);

  res.json({
    success: true,
    token: tempToken,
    role: SystemRole.USER,
    availableStores: stores,
  });
});

export const selectStore = catchAsync(async (req, res) => {
  throw new AppError("Not implemented", 501);
});

export const getMe = catchAsync(async (req, res) => {
  throw new AppError("Not implemented", 501);
});
