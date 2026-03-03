import { prisma } from "../../lib/prisma.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { successResponse } from "../../shared/http/response-mappers.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/utils/errors.js";
import { getBusinessCapabilitiesFromLicense } from "../license/license.service.js";

type CustomerGroupDbClient = Pick<
  typeof prisma,
  "customerGroup" | "customerGroupMember" | "party"
>;

const customerGroupInclude = {
  memberships: {
    where: {
      deleted_at: null,
    },
    include: {
      party: {
        select: {
          id: true,
          name: true,
          type: true,
          is_active: true,
          deleted_at: true,
        },
      },
    },
  },
} as const;

const byGroupSortOrder = (left: { isActive: boolean; name: string }, right: { isActive: boolean; name: string }) => {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
};

const toCustomerGroupView = (group: {
  id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  memberships: Array<{
    party: {
      id: string;
      name: string;
      type: "CUSTOMER" | "SUPPLIER" | "BOTH";
      is_active: boolean;
      deleted_at: Date | null;
    };
  }>;
}) => {
  const members = group.memberships
    .map((membership) => membership.party)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((party) => ({
      customerId: party.id,
      name: party.name,
      partyType: party.type,
      isActive: party.is_active,
      deletedAt: party.deleted_at ? party.deleted_at.toISOString() : null,
    }));

  return {
    id: group.id,
    name: group.name,
    isActive: group.is_active,
    memberCount: members.length,
    createdAt: group.created_at.toISOString(),
    updatedAt: group.updated_at.toISOString(),
    members,
  };
};

const toCustomerGroupsListView = (groups: Array<ReturnType<typeof toCustomerGroupView>>) =>
  successResponse({
    groups: groups.sort(byGroupSortOrder),
  });

const toCustomerGroupPayload = (group: ReturnType<typeof toCustomerGroupView>) =>
  successResponse({
    group,
  });

const assertCustomerGroupsAccess = async (userId: string, tenantId: string) => {
  const member = await tenantService.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const capabilities = await getBusinessCapabilitiesFromLicense(tenantId);
  if (!capabilities.includes("PARTIES_CUSTOMERS")) {
    throw new ForbiddenError("Customer management is not enabled for this store license");
  }
};

const toUniqueMemberIds = (memberIds: string[]) => [...new Set(memberIds)];

const assertUniqueName = async (
  tx: CustomerGroupDbClient,
  tenantId: string,
  name: string,
  excludedGroupId?: string,
) => {
  const groups = await tx.customerGroup.findMany({
    where: {
      business_id: tenantId,
      deleted_at: null,
      ...(excludedGroupId
        ? {
            id: {
              not: excludedGroupId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
    },
  });

  const duplicate = groups.find(
    (group) => group.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  if (duplicate) {
    throw new ConflictError("Customer group name already exists");
  }
};

const assertValidMembers = async (
  tx: CustomerGroupDbClient,
  tenantId: string,
  memberIds: string[],
) => {
  if (memberIds.length === 0) {
    return;
  }

  const matchingParties = await tx.party.findMany({
    where: {
      id: { in: memberIds },
      business_id: tenantId,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (matchingParties.length !== memberIds.length) {
    throw new BadRequestError("One or more selected customers are not available");
  }
};

const getCustomerGroupOrThrow = async (
  tx: CustomerGroupDbClient,
  tenantId: string,
  groupId: string,
) => {
  const group = await tx.customerGroup.findUnique({
    where: { id: groupId },
    include: customerGroupInclude,
  });

  if (!group || group.business_id !== tenantId) {
    throw new NotFoundError("Customer group not found");
  }

  return group;
};

export const listCustomerGroups = catchAsync(async (req, res) => {
  const { tenantId } = req.query as { tenantId: string };

  await assertCustomerGroupsAccess(req.user.id, tenantId);

  const groups = await prisma.customerGroup.findMany({
    where: {
      business_id: tenantId,
      deleted_at: null,
    },
    include: customerGroupInclude,
  });

  res.json(toCustomerGroupsListView(groups.map(toCustomerGroupView)));
});

export const createCustomerGroup = catchAsync(async (req, res) => {
  const {
    tenantId,
    name,
    isActive = true,
    memberIds = [],
  } = req.body as {
    tenantId: string;
    name: string;
    isActive?: boolean;
    memberIds?: string[];
  };

  await assertCustomerGroupsAccess(req.user.id, tenantId);

  const group = await prisma.$transaction(async (tx) => {
    const trimmedName = name.trim();
    const uniqueMemberIds = toUniqueMemberIds(memberIds);

    await assertUniqueName(tx, tenantId, trimmedName);
    await assertValidMembers(tx, tenantId, uniqueMemberIds);

    const created = await tx.customerGroup.create({
      data: {
        business_id: tenantId,
        name: trimmedName,
        is_active: isActive,
        deleted_at: null,
      },
    });

    if (uniqueMemberIds.length > 0) {
      await tx.customerGroupMember.createMany({
        data: uniqueMemberIds.map((partyId) => ({
          customer_group_id: created.id,
          party_id: partyId,
          is_active: true,
          deleted_at: null,
        })),
      });
    }

    return getCustomerGroupOrThrow(tx, tenantId, created.id);
  });

  res.json(toCustomerGroupPayload(toCustomerGroupView(group)));
});

export const updateCustomerGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params as { groupId: string };
  const {
    tenantId,
    name,
    isActive,
    memberIds = [],
  } = req.body as {
    tenantId: string;
    name: string;
    isActive: boolean;
    memberIds?: string[];
  };

  await assertCustomerGroupsAccess(req.user.id, tenantId);

  const group = await prisma.$transaction(async (tx) => {
    const currentGroup = await getCustomerGroupOrThrow(tx, tenantId, groupId);

    const trimmedName = name.trim();
    const uniqueMemberIds = toUniqueMemberIds(memberIds);
    const now = new Date();

    await assertUniqueName(tx, tenantId, trimmedName, groupId);
    await assertValidMembers(tx, tenantId, uniqueMemberIds);

    await tx.customerGroup.update({
      where: { id: groupId },
      data: {
        name: trimmedName,
        is_active: isActive,
        deleted_at: null,
      },
    });

    const existingMemberships = await tx.customerGroupMember.findMany({
      where: {
        customer_group_id: groupId,
      },
      select: {
        id: true,
        party_id: true,
        deleted_at: true,
      },
    });

    const existingMembershipsByPartyId = new Map(
      existingMemberships.map((membership) => [membership.party_id, membership]),
    );
    const membershipsToRevive = uniqueMemberIds
      .map((partyId) => existingMembershipsByPartyId.get(partyId))
      .filter((membership) => membership?.deleted_at) as Array<{
      id: string;
      party_id: string;
      deleted_at: Date | null;
    }>;
    const membershipsToCreate = uniqueMemberIds.filter(
      (partyId) => !existingMembershipsByPartyId.has(partyId),
    );
    const membershipsToSoftDelete = existingMemberships
      .filter(
        (membership) =>
          membership.deleted_at === null && !uniqueMemberIds.includes(membership.party_id),
      )
      .map((membership) => membership.id);

    if (membershipsToSoftDelete.length > 0) {
      await tx.customerGroupMember.updateMany({
        where: {
          id: { in: membershipsToSoftDelete },
        },
        data: {
          is_active: false,
          deleted_at: now,
        },
      });
    }

    if (membershipsToRevive.length > 0) {
      await Promise.all(
        membershipsToRevive.map((membership) =>
          tx.customerGroupMember.update({
            where: { id: membership.id },
            data: {
              is_active: true,
              deleted_at: null,
            },
          }),
        ),
      );
    }

    if (membershipsToCreate.length > 0) {
      await tx.customerGroupMember.createMany({
        data: membershipsToCreate.map((partyId) => ({
          customer_group_id: groupId,
          party_id: partyId,
          is_active: true,
          deleted_at: null,
        })),
      });
    }

    if (currentGroup.deleted_at) {
      await tx.customerGroup.update({
        where: { id: groupId },
        data: {
          deleted_at: null,
        },
      });
    }

    return getCustomerGroupOrThrow(tx, tenantId, groupId);
  });

  res.json(toCustomerGroupPayload(toCustomerGroupView(group)));
});

export const deleteCustomerGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params as { groupId: string };
  const { tenantId } = req.body as { tenantId: string };

  await assertCustomerGroupsAccess(req.user.id, tenantId);

  await prisma.$transaction(async (tx) => {
    const group = await getCustomerGroupOrThrow(tx, tenantId, groupId);
    if (group.deleted_at) {
      return;
    }

    const now = new Date();

    await tx.customerGroupMember.updateMany({
      where: {
        customer_group_id: groupId,
        deleted_at: null,
      },
      data: {
        is_active: false,
        deleted_at: now,
      },
    });

    await tx.customerGroup.update({
      where: { id: groupId },
      data: {
        is_active: false,
        deleted_at: now,
      },
    });
  });

  res.json(successResponse());
});
