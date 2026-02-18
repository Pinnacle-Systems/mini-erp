import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  readAccessToken,
} from "@/features/auth/server";
import { adminService } from "@/features/admin/server";
import { listStoreOwnersQuerySchema } from "@/features/admin/schemas";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { SystemRole } from "@/generated/prisma/enums";

const authorizeAdmin = async (req: NextRequest) => {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    throw new UnauthorizedError("Unauthorized");
  }

  const payload = await readAccessToken(token);
  if (!payload) {
    throw new UnauthorizedError("Unauthorized");
  }

  if (payload.systemRole !== SystemRole.PLATFORM_ADMIN) {
    throw new ForbiddenError("Only platform admins can access this resource");
  }
};

export async function GET(req: NextRequest) {
  try {
    await authorizeAdmin(req);

    const url = new URL(req.url);
    const queryResult = listStoreOwnersQuerySchema.safeParse({
      ownerEmail: url.searchParams.get("ownerEmail") ?? undefined,
      ownerPhone: url.searchParams.get("ownerPhone") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!queryResult.success) {
      throw new BadRequestError("Invalid query");
    }

    const result = await adminService.listStoreOwners(queryResult.data);

    return NextResponse.json({
      success: true,
      owners: result.owners,
      pagination: result.pagination,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
