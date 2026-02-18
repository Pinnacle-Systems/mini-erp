import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  readAccessToken,
} from "@/features/auth/server";
import { tenantService } from "@/features/tenant/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/http";
import { SystemRole } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      throw new UnauthorizedError("Unauthorized");
    }

    const payload = await readAccessToken(token);
    if (!payload || typeof payload.sub !== "string") {
      throw new UnauthorizedError("Unauthorized");
    }

    if (payload.systemRole !== SystemRole.USER) {
      throw new ForbiddenError("Only non-admin users can access assigned stores");
    }

    const stores = await tenantService.getStoresForIdentity(payload.sub);

    return NextResponse.json({
      success: true,
      stores,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
