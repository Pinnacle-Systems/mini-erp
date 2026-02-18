import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  authService,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
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

const clearAuthCookies = (response: NextResponse) => {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
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

    const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const accessPayload = accessToken ? await readAccessToken(accessToken) : null;

    const { currentStoreId } = await parseAndValidateBody(req, refreshBodySchema);
    const effectiveStoreId =
      currentStoreId ??
      (typeof accessPayload?.tenantId === "string" ? accessPayload.tenantId : undefined);

    if (effectiveStoreId) {
      const member = await tenantService.validateMembership(
        session.identity_id,
        effectiveStoreId,
      );

      if (member) {
        const refreshedAccessToken = await signAccessToken(session.identity, session, {
          tenantId: effectiveStoreId,
          memberRole: member.role,
        });

        const payload = {
          success: true,
          token: refreshedAccessToken,
          role: SystemRole.USER,
        };

        const response = NextResponse.json(payload);
        setAuthCookies(response, refreshedAccessToken, newRefreshToken, session.id);
        return response;
      }
    }

    const refreshedAccessToken = await signTempToken(session.identity, session);

    const payload = {
      success: true,
      token: refreshedAccessToken,
      role: SystemRole.USER,
    };

    const response = NextResponse.json(payload);

    setAuthCookies(response, refreshedAccessToken, newRefreshToken, session.id);

    return response;
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      clearAuthCookies(response);
    }

    return response;
  }
}
