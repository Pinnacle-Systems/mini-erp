import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  readAccessToken,
} from "@/features/auth/server";
import { getAssignableRoles, tenantService } from "@/features/tenant/server";
import { SystemRole } from "@/generated/prisma/enums";
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

    let memberRole: string | null = null;
    let assignableRoles: string[] = [];

    if (
      payload.systemRole === SystemRole.USER &&
      typeof payload.sub === "string" &&
      typeof payload.tenantId === "string"
    ) {
      const member = await tenantService.validateMembership(payload.sub, payload.tenantId);
      if (member) {
        memberRole = member.role;
        assignableRoles = getAssignableRoles(member.role);
      }
    }

    return NextResponse.json({
      success: true,
      role: payload.systemRole ?? null,
      identityId: payload.sub ?? null,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
      memberRole,
      assignableRoles,
    });
  } catch (error) {
    const response = handleRouteError(error);
    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }
    return response;
  }
}
