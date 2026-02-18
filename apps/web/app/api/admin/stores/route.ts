import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
} from "@/features/auth/server";
import { adminService } from "@/features/admin/server";
import {
  listStoresQuerySchema,
  onboardStoreBodySchema,
} from "@/features/admin/schemas";
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
    const queryResult = listStoresQuerySchema.safeParse({
      storeName: url.searchParams.get("storeName") ?? undefined,
      ownerEmail: url.searchParams.get("ownerEmail") ?? undefined,
      ownerPhone: url.searchParams.get("ownerPhone") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!queryResult.success) {
      throw new BadRequestError("Invalid query");
    }

    const result = await adminService.listStores(queryResult.data);

    return NextResponse.json({
      success: true,
      stores: result.stores,
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

export async function POST(req: NextRequest) {
  try {
    await authorizeAdmin(req);

    const body = await parseAndValidateBody(req, onboardStoreBodySchema);

    const result = await adminService.onboardStore(body);

    return NextResponse.json({
      success: true,
      store: result.store,
      ownerIdentityId: result.ownerIdentityId,
      ownerCreated: result.ownerCreated,
      defaultPassword: result.defaultPassword,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
