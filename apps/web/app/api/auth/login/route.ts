import { NextRequest, NextResponse } from "next/server";
import authService, { REFRESH_TOKEN_EXPIRY_MS } from "@/shared/auth/auth.service";
import { getClientIp, handleRouteError, parseAndValidateBody } from "@/shared/auth/http";
import { loginBodySchema } from "@/shared/auth/auth.schema";
import { signAccessToken, signTempToken } from "@/shared/auth/token";
import tenantService from "@/shared/tenant/tenant.service";
import { SystemRole } from "@/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const { email = "", phone = "", password } = await parseAndValidateBody(
      req,
      loginBodySchema,
    );

    console.log("password: ", password);

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

      response.cookies.set("refreshToken", `${session.id}.${refreshToken}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
        maxAge: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000),
      });

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

    response.cookies.set("refreshToken", `${session.id}.${refreshToken}`, {
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
