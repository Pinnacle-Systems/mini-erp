import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
} from "@/features/auth/server";
import { adminService } from "@/features/admin/server";
import { updateStoreOwnerBodySchema } from "@/features/admin/schemas";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { SystemRole } from "@/generated/prisma/enums";

type RouteContext = {
  params: Promise<{ ownerId: string }>;
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

const getOwnerIdFromContext = async ({ params }: RouteContext) => {
  const { ownerId } = await params;

  if (!ownerId || !/^[0-9a-fA-F-]{36}$/.test(ownerId)) {
    throw new BadRequestError("Invalid owner ID");
  }

  return ownerId;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await authorizeAdmin(req);

    const ownerId = await getOwnerIdFromContext(context);
    const result = await adminService.getStoreOwnerById(ownerId);

    return NextResponse.json({
      success: true,
      owner: result.owner,
      stores: result.stores,
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

    const ownerId = await getOwnerIdFromContext(context);
    const body = await parseAndValidateBody(req, updateStoreOwnerBodySchema);

    const owner = await adminService.updateStoreOwner(ownerId, body);

    return NextResponse.json({
      success: true,
      owner,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
