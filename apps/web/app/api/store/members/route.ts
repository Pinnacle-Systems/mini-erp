import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  authService,
  handleRouteError,
  parseAndValidateBody,
  readAccessToken,
} from "@/features/auth/server";
import { createStoreMemberBodySchema } from "@/features/tenant/schemas";
import {
  canAssignRole,
  getAssignableRoles,
  tenantService,
} from "@/features/tenant/server";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/http";
import { StoreRole, SystemRole } from "@/generated/prisma/enums";

type AuthorizedStoreMemberManager = {
  actorIdentityId: string;
  actorRole: StoreRole;
  storeId: string;
};

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

const mapMembersForResponse = async (
  storeId: string,
  actorIdentityId: string,
  actorRole: StoreRole,
) => {
  const members = await tenantService.listStoreMembers({ storeId });
  const identities = await authService.getIdentitiesByIds(
    [...new Set(members.map((member) => member.identity_id))],
  );
  const identityById = new Map(identities.map((identity) => [identity.id, identity]));

  return members.map((member) => {
    const identity = identityById.get(member.identity_id);
    const isSelf = member.identity_id === actorIdentityId;
    const canManageMember = !isSelf && canAssignRole(actorRole, member.role);

    return {
      id: member.id,
      identityId: member.identity_id,
      role: member.role,
      isSelf,
      canManageMember,
      identity: {
        id: member.identity_id,
        name: identity?.name ?? null,
        email: identity?.email ?? null,
        phone: identity?.phone ?? null,
      },
    };
  });
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

export async function GET(req: NextRequest) {
  try {
    const { actorIdentityId, actorRole, storeId } = await authorizeStoreMemberManager(req);
    const assignableRoles = getAssignableRoles(actorRole);
    if (assignableRoles.length === 0) {
      throw new ForbiddenError("You do not have permission to manage memberships");
    }
    const members = await mapMembersForResponse(storeId, actorIdentityId, actorRole);

    return NextResponse.json({
      success: true,
      storeId,
      actorIdentityId,
      actorRole,
      assignableRoles,
      members,
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
    const { actorIdentityId, actorRole, storeId } = await authorizeStoreMemberManager(req);
    if (getAssignableRoles(actorRole).length === 0) {
      throw new ForbiddenError("You do not have permission to manage memberships");
    }
    const body = await parseAndValidateBody(req, createStoreMemberBodySchema);

    if (!canAssignRole(actorRole, body.role)) {
      throw new ForbiddenError(`Role ${actorRole} cannot assign role ${body.role}`);
    }

    const identityResult = await authService.findOrCreateMemberIdentity({
      name: body.name,
      email: body.email,
      phone: body.phone,
    });

    const member = await tenantService.addStoreMember({
      storeId,
      identityId: identityResult.identity.id,
      role: body.role,
    });

    if (!UUID_REGEX.test(member.id)) {
      throw new BadRequestError("Invalid membership ID");
    }

    const members = await mapMembersForResponse(storeId, actorIdentityId, actorRole);
    const createdMember = members.find((item) => item.id === member.id) ?? null;

    return NextResponse.json({
      success: true,
      member: createdMember,
      identity: {
        id: identityResult.identity.id,
        name: identityResult.identity.name,
        email: identityResult.identity.email,
        phone: identityResult.identity.phone,
      },
      identityCreated: identityResult.wasCreated,
      defaultPassword: identityResult.defaultPassword,
    });
  } catch (error) {
    const response = handleRouteError(error);

    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }

    return response;
  }
}
