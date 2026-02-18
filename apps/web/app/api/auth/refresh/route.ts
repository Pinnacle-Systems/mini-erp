import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  authService,
  handleRouteError,
  parseAndValidateBody,
  REFRESH_TOKEN_EXPIRY_MS,
  signAccessToken,
  signTempToken,
} from "@/features/auth/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/http";
import { refreshBodySchema } from "@/features/auth/schemas";
import { tenantService } from "@/features/tenant/server";
import { SystemRole } from "@/generated/prisma/enums";

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
    const refreshToken = req.cookies.get("refreshToken")?.value;

    if (!refreshToken) {
      throw new UnauthorizedError("Session expired.");
    }

    const { session, refreshToken: newRefreshToken } =
      await authService.verifySession(refreshToken);

    if (session.identity.system_role === SystemRole.PLATFORM_ADMIN) {
      const accessToken = await signAccessToken(session.identity, session);
      const response = NextResponse.json({
        success: true,
        token: accessToken,
        role: SystemRole.PLATFORM_ADMIN,
      });

      setAuthCookies(response, accessToken, newRefreshToken, session.id);

      return response;
    }

    const { currentStoreId } = await parseAndValidateBody(req, refreshBodySchema);

    let accessToken: string;
    let payload: Record<string, unknown>;

    if (currentStoreId) {
      const member = await tenantService.validateMembership(
        session.identity_id,
        currentStoreId,
      );

      if (!member) {
        throw new ForbiddenError("Access denied");
      }

      accessToken = await signAccessToken(session.identity, session, {
        tenantId: currentStoreId,
        memberRole: member.role,
      });

      payload = {
        success: true,
        token: accessToken,
        role: SystemRole.USER,
      };
    } else {
      accessToken = await signTempToken(session.identity, session);
      const stores = await tenantService.getStoresForIdentity(session.identity.id);

      payload = {
        success: true,
        token: accessToken,
        role: SystemRole.USER,
        availableStores: stores,
      };
    }

    const response = NextResponse.json(payload);

    setAuthCookies(response, accessToken, newRefreshToken, session.id);

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
