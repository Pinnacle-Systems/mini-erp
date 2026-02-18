import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  readAccessToken,
} from "@/features/auth/server";
import { UnauthorizedError } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      throw new UnauthorizedError("Unauthorized");
    }

    const payload = await readAccessToken(token);
    if (!payload) {
      throw new UnauthorizedError("Unauthorized");
    }

    return NextResponse.json({
      success: true,
      role: payload.systemRole ?? null,
      identityId: payload.sub ?? null,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
    });
  } catch (error) {
    const response = handleRouteError(error);
    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }
    return response;
  }
}
