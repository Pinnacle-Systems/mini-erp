import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/utils/errors.js";
import { getClientIp } from "../../shared/utils/getIp.js";
import { successResponse } from "../../shared/http/response-mappers.js";
import authService, { REFRESH_TOKEN_EXPIRY_MS } from "./auth.service.js";
import { SystemRole } from "../../../generated/prisma/enums.js";
import {
  signAccessToken,
  signTempToken,
  verifyAccessToken,
} from "../../shared/utils/token.utils.js";
import tenantService from "../tenant/tenant.service.js";
import {
  assertLicensedStoreAccess,
  getBusinessModulesFromLicense,
  hasBusinessLicenseCapability,
  setSessionSelectedBusiness,
  setSessionSelectedLocation,
} from "../license/license.service.js";

const toAuthTokenView = (input: {
  token: string;
  role: "USER" | "PLATFORM_ADMIN";
  availableStores?: unknown[];
}) =>
  successResponse({
    token: input.token,
    role: input.role,
    ...(input.availableStores ? { availableStores: input.availableStores } : {}),
  });

const toSelectedStoreView = (input: {
  token: string;
  tenantId: string;
  memberRole: string;
  modules: Record<string, boolean>;
  activeLocationId: string | null;
  locations: Array<{ id: string; name: string; isDefault: boolean }>;
}) =>
  successResponse({
    role: SystemRole.USER,
    tenantId: input.tenantId,
    memberRole: input.memberRole,
    token: input.token,
    modules: input.modules,
    activeLocationId: input.activeLocationId,
    locations: input.locations,
  });

const toSessionView = (input: {
  role: "USER" | "PLATFORM_ADMIN" | null;
  identityId: string | null;
  tenantId: string | null;
  businesses: unknown[];
  modules: Record<string, boolean> | null;
  memberRole: string | null;
  activeLocationId: string | null;
  locations: Array<{ id: string; name: string; isDefault: boolean }>;
}) =>
  successResponse({
    role: input.role,
    identityId: input.identityId,
    tenantId: input.tenantId,
    businesses: input.businesses,
    modules: input.modules,
    memberRole: input.memberRole,
    activeLocationId: input.activeLocationId,
    locations: input.locations,
  });

const resolveBusinessLocationContext = async (
  sessionId: string,
  businessId: string,
  requestedLocationId?: string | null,
) => {
  const [locations, defaultLocation, locationCapabilityEnabled] = await Promise.all([
    tenantService.getBusinessLocations(businessId),
    tenantService.getDefaultBusinessLocation(businessId),
    hasBusinessLicenseCapability(businessId, "BUSINESS_LOCATIONS"),
  ]);

  if (!defaultLocation) {
    throw new UnauthorizedError("Default business location is not configured");
  }

  const resolvedLocationId =
    locationCapabilityEnabled && requestedLocationId
      ? (await tenantService.validateBusinessLocation(businessId, requestedLocationId))?.id ??
        defaultLocation.id
      : defaultLocation.id;

  await setSessionSelectedLocation(sessionId, resolvedLocationId);

  return {
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      isDefault: location.is_default,
    })),
    activeLocationId: resolvedLocationId,
  };
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

    return res.json(toAuthTokenView({
      token: accessToken,
      role: SystemRole.PLATFORM_ADMIN,
    }));
  }

  const tempToken = await signTempToken(identity, session);

  const businesses = await tenantService.getBusinessesForIdentity(identity.id);

  res.json(toAuthTokenView({
    token: tempToken,
    role: SystemRole.USER,
    availableStores: businesses,
  }));
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
  res.json(successResponse());
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

    return res.json(toAuthTokenView({
      token: accessToken,
      role: SystemRole.PLATFORM_ADMIN,
    }));
  }

  const { currentBusinessId } = (req.body ?? {}) as { currentBusinessId?: string };

  if (currentBusinessId) {
    const member = await tenantService.validateMembership(
      session.identity_id,
      currentBusinessId,
    );
    if (!member) {
      throw new UnauthorizedError("Access denied");
    }
    await assertLicensedStoreAccess(currentBusinessId, session.id);
    await setSessionSelectedBusiness(session.id, currentBusinessId);
    const locationContext = await resolveBusinessLocationContext(
      session.id,
      currentBusinessId,
      session.selected_location_id ?? null,
    );

    const token = await signAccessToken(session.identity, session, {
      tenantId: currentBusinessId,
      memberRole: member.role,
      locationId: locationContext.activeLocationId,
    });

    return res.json(toAuthTokenView({
      token,
      role: SystemRole.USER,
    }));
  }

  const tempToken = await signTempToken(session.identity, session);

  const businesses = await tenantService.getBusinessesForIdentity(session.identity.id);

  res.json(toAuthTokenView({
    token: tempToken,
    role: SystemRole.USER,
    availableStores: businesses,
  }));
});

export const selectStore = catchAsync(async (req, res) => {
  const { businessId = "" } = req.body;
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

  const member = await tenantService.validateMembership(payload.sub, businessId);
  if (!member) {
    throw new UnauthorizedError("Access denied");
  }
  await assertLicensedStoreAccess(businessId, payload.sid);
  await setSessionSelectedBusiness(payload.sid, businessId);
  const locationContext = await resolveBusinessLocationContext(payload.sid, businessId);

  const accessToken = await signAccessToken(
    {
      id: payload.sub,
      system_role: SystemRole.USER,
    },
    {
      id: payload.sid,
    },
    {
      tenantId: businessId,
      memberRole: member.role,
      locationId: locationContext.activeLocationId,
    },
  );
  const modules = await getBusinessModulesFromLicense(businessId);

  res.json(
    toSelectedStoreView({
      token: accessToken,
      tenantId: businessId,
      memberRole: member.role,
      modules,
      activeLocationId: locationContext.activeLocationId,
      locations: locationContext.locations,
    }),
  );
});

export const selectLocation = catchAsync(async (req, res) => {
  const { businessId = "", locationId = "" } = req.body;
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

  const member = await tenantService.getBusinessMembership(payload.sub, businessId);
  if (!member) {
    throw new UnauthorizedError("Access denied");
  }
  if (member.role !== "OWNER") {
    throw new ForbiddenError("Only the business owner can switch locations");
  }

  await assertLicensedStoreAccess(businessId, payload.sid);
  const canUseLocations = await hasBusinessLicenseCapability(businessId, "BUSINESS_LOCATIONS");
  if (!canUseLocations) {
    throw new ForbiddenError("Business locations are not enabled for this license");
  }

  const location = await tenantService.validateBusinessLocation(businessId, locationId);
  if (!location) {
    throw new UnauthorizedError("Selected location is not available");
  }

  await setSessionSelectedBusiness(payload.sid, businessId);
  await setSessionSelectedLocation(payload.sid, location.id);
  const modules = await getBusinessModulesFromLicense(businessId);
  const locations = await tenantService.getBusinessLocations(businessId);

  const accessToken = await signAccessToken(
    {
      id: payload.sub,
      system_role: SystemRole.USER,
    },
    {
      id: payload.sid,
    },
    {
      tenantId: businessId,
      memberRole: member.role,
      locationId: location.id,
    },
  );

  res.json(
    toSelectedStoreView({
      token: accessToken,
      tenantId: businessId,
      memberRole: member.role,
      modules,
      activeLocationId: location.id,
      locations: locations.map((entry) => ({
        id: entry.id,
        name: entry.name,
        isDefault: entry.is_default,
      })),
    }),
  );
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

  let businesses = [];
  if (payload.systemRole === SystemRole.USER && typeof payload.sub === "string") {
    businesses = await tenantService.getBusinessesForIdentity(payload.sub);
  }
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;
  const tokenLocationId = typeof payload.locationId === "string" ? payload.locationId : null;
  if (tenantId && typeof payload.sid === "string") {
    await setSessionSelectedBusiness(payload.sid, tenantId).catch(() => undefined);
  }
  const modules = tenantId ? await getBusinessModulesFromLicense(tenantId) : null;
  const memberRole =
    tenantId && typeof payload.sub === "string"
      ? (await tenantService.getBusinessMembership(payload.sub, tenantId))?.role ?? null
      : null;
  const locations = tenantId
    ? (await tenantService.getBusinessLocations(tenantId)).map((location) => ({
        id: location.id,
        name: location.name,
        isDefault: location.is_default,
      }))
    : [];
  const activeLocationId =
    tokenLocationId ??
    locations.find((location) => location.isDefault)?.id ??
    null;
  if (tenantId && typeof payload.sid === "string") {
    await setSessionSelectedLocation(payload.sid, activeLocationId).catch(() => undefined);
  }
  const role =
    payload.systemRole === SystemRole.USER || payload.systemRole === SystemRole.PLATFORM_ADMIN
      ? payload.systemRole
      : null;
  const identityId = typeof payload.sub === "string" ? payload.sub : null;

  res.json(
    toSessionView({
      role,
      identityId,
      tenantId,
      businesses,
      modules,
      memberRole,
      activeLocationId,
      locations,
    }),
  );
});
