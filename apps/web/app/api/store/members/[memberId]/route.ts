import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
} from "@/features/auth/server";
import { updateStoreMemberRoleBodySchema } from "@/features/tenant/schemas";
import { canAssignRole, getAssignableRoles, tenantService } from "@/features/tenant/server";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { StoreRole, SystemRole } from "@/generated/prisma/enums";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

type AuthorizedStoreMemberManager = {
  actorIdentityId: string;
  actorRole: StoreRole;
  storeId: string;
};

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

const getMemberIdFromContext = async ({ params }: RouteContext) => {
  const { memberId } = await params;
  if (!memberId || !UUID_REGEX.test(memberId)) {
    throw new BadRequestError("Invalid membership ID");
  }

  return memberId;
};

const authorizeStoreMemberManager = async (
  req: NextRequest,
): Promise<AuthorizedStoreMemberManager> => {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    throw new UnauthorizedError("Unauthorized");
  }

  const payload = await readAccessToken(token);
  if (
    !payload ||
    typeof payload.sub !== "string" ||
    payload.systemRole !== SystemRole.USER ||
    typeof payload.tenantId !== "string"
  ) {
    throw new UnauthorizedError("Unauthorized");
  }

  const member = await tenantService.validateMembership(payload.sub, payload.tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  return {
    actorIdentityId: payload.sub,
    actorRole: member.role,
    storeId: payload.tenantId,
  };
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { actorIdentityId, actorRole, storeId } = await authorizeStoreMemberManager(req);
    if (getAssignableRoles(actorRole).length === 0) {
      throw new ForbiddenError("You do not have permission to manage memberships");
    }
    const memberId = await getMemberIdFromContext(context);
    const body = await parseAndValidateBody(req, updateStoreMemberRoleBodySchema);

    const targetMember = await tenantService.getStoreMemberById(memberId, storeId);
    if (!targetMember) {
      throw new BadRequestError("Membership not found");
    }

    if (targetMember.identity_id === actorIdentityId) {
      throw new ForbiddenError("You cannot update your own membership role");
    }

    if (!canAssignRole(actorRole, targetMember.role)) {
      throw new ForbiddenError(`Role ${actorRole} cannot manage role ${targetMember.role}`);
    }

    if (!canAssignRole(actorRole, body.role)) {
      throw new ForbiddenError(`Role ${actorRole} cannot assign role ${body.role}`);
    }

    const updatedMember = await tenantService.updateStoreMemberRole({
      memberId,
      storeId,
      role: body.role,
    });

    if (!updatedMember) {
      throw new BadRequestError("Membership not found");
    }

    return NextResponse.json({
      success: true,
      member: {
        id: updatedMember.id,
        identityId: updatedMember.identity_id,
        role: updatedMember.role,
      },
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { actorIdentityId, actorRole, storeId } = await authorizeStoreMemberManager(req);
    if (getAssignableRoles(actorRole).length === 0) {
      throw new ForbiddenError("You do not have permission to manage memberships");
    }
    const memberId = await getMemberIdFromContext(context);

    const targetMember = await tenantService.getStoreMemberById(memberId, storeId);
    if (!targetMember) {
      throw new BadRequestError("Membership not found");
    }

    if (targetMember.identity_id === actorIdentityId) {
      throw new ForbiddenError("You cannot delete your own membership");
    }

    if (!canAssignRole(actorRole, targetMember.role)) {
      throw new ForbiddenError(`Role ${actorRole} cannot manage role ${targetMember.role}`);
    }

    const deletedMember = await tenantService.softDeleteStoreMember({
      memberId,
      storeId,
    });

    if (!deletedMember) {
      throw new BadRequestError("Membership not found");
    }

    return NextResponse.json({
      success: true,
      memberId: deletedMember.id,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
