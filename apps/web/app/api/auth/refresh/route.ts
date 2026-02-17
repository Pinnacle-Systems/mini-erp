import { NextRequest, NextResponse } from "next/server";
import authService, { REFRESH_TOKEN_EXPIRY_MS } from "@/shared/auth/auth.service";
import { ForbiddenError, UnauthorizedError } from "@/shared/auth/errors";
import { handleRouteError, parseAndValidateBody } from "@/shared/auth/http";
import { refreshBodySchema } from "@/shared/auth/auth.schema";
import { signAccessToken, signTempToken } from "@/shared/auth/token";
import tenantService from "@/shared/tenant/tenant.service";
import { SystemRole } from "@/generated/prisma/enums";

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

      response.cookies.set("refreshToken", `${session.id}.${newRefreshToken}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
        maxAge: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000),
      });

      return response;
    }

    const { currentStoreId } = await parseAndValidateBody(req, refreshBodySchema);

    let payload: Record<string, unknown>;

    if (currentStoreId) {
      const member = await tenantService.validateMembership(
        session.identity_id,
        currentStoreId,
      );

      if (!member) {
        throw new ForbiddenError("Access denied");
      }

      const token = await signAccessToken(session.identity, session, {
        tenantId: currentStoreId,
        memberRole: member.role,
      });

      payload = {
        success: true,
        token,
        role: SystemRole.USER,
      };
    } else {
      const tempToken = await signTempToken(session.identity, session);
      const stores = await tenantService.getStoresForIdentity(session.identity.id);

      payload = {
        success: true,
        token: tempToken,
        role: SystemRole.USER,
        availableStores: stores,
      };
    }

    const response = NextResponse.json(payload);

    response.cookies.set("refreshToken", `${session.id}.${newRefreshToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000),
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
