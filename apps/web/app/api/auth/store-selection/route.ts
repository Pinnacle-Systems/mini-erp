import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
  signAccessToken,
} from "@/features/auth/server";
import { storeSelectionBodySchema } from "@/features/auth/schemas";
import { tenantService } from "@/features/tenant/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/http";
import { SystemRole } from "@/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      throw new UnauthorizedError("Unauthorized");
    }

    const payload = await readAccessToken(token);
    if (
      !payload ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      throw new UnauthorizedError("Unauthorized");
    }

    if (payload.systemRole !== SystemRole.USER) {
      throw new ForbiddenError("Only non-admin users can select a store");
    }

    const { storeId } = await parseAndValidateBody(req, storeSelectionBodySchema);

    const member = await tenantService.validateMembership(payload.sub, storeId);
    if (!member) {
      throw new ForbiddenError("Access denied");
    }

    const accessToken = await signAccessToken(
      {
        id: payload.sub,
        system_role: SystemRole.USER,
      },
      {
        id: payload.sid,
      },
      {
        tenantId: storeId,
        memberRole: member.role,
      },
    );

    const response = NextResponse.json({
      success: true,
      role: SystemRole.USER,
      tenantId: storeId,
      memberRole: member.role,
      token: accessToken,
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
