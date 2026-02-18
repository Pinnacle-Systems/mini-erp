import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
} from "@/features/auth/server";
import { adminService } from "@/features/admin/server";
import { updateStoreBodySchema } from "@/features/admin/schemas";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { SystemRole } from "@/generated/prisma/enums";

type RouteContext = {
  params: Promise<{ storeId: string }>;
};

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

const getStoreIdFromContext = async ({ params }: RouteContext) => {
  const { storeId } = await params;

  if (!storeId || !/^[0-9a-fA-F-]{36}$/.test(storeId)) {
    throw new BadRequestError("Invalid store ID");
  }

  return storeId;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await authorizeAdmin(req);

    const storeId = await getStoreIdFromContext(context);
    const store = await adminService.getStoreById(storeId);

    return NextResponse.json({
      success: true,
      store,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await authorizeAdmin(req);

    const storeId = await getStoreIdFromContext(context);
    const body = await parseAndValidateBody(req, updateStoreBodySchema);

    const store = await adminService.updateStore(storeId, body);

    return NextResponse.json({
      success: true,
      store,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
