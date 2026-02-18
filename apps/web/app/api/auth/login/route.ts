import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  authService,
  getClientIp,
  handleRouteError,
  parseAndValidateBody,
  REFRESH_TOKEN_EXPIRY_MS,
  signAccessToken,
  signTempToken,
} from "@/features/auth/server";
import { loginBodySchema } from "@/features/auth/schemas";
import { tenantService } from "@/features/tenant/server";
import {
  SystemRole,
} from "@/generated/prisma/enums";

const setAuthCookies = (
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  sessionId: string,
) => {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  response.cookies.set("refreshToken", `${sessionId}.${refreshToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000),
  });
};

export async function POST(req: NextRequest) {
  try {
    const { email = "", phone = "", password } = await parseAndValidateBody(
      req,
      loginBodySchema,
    );

    const identity = await authService.searchIdentity(phone, email, password);

    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const ipAddress = getClientIp(req);

    const { session, refreshToken } = await authService.createSession(
      identity,
      userAgent,
      ipAddress,
    );

    if (identity.system_role === SystemRole.PLATFORM_ADMIN) {
      const accessToken = await signAccessToken(identity, session);
      const response = NextResponse.json({
        success: true,
        token: accessToken,
        role: SystemRole.PLATFORM_ADMIN,
      });

      setAuthCookies(response, accessToken, refreshToken, session.id);

      return response;
    }

    const tempToken = await signTempToken(identity, session);
    const stores = await tenantService.getStoresForIdentity(identity.id);

    const response = NextResponse.json({
      success: true,
      token: tempToken,
      role: SystemRole.USER,
      availableStores: stores,
    });

    setAuthCookies(response, tempToken, refreshToken, session.id);

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
