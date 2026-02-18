import { StoreRole } from "@/generated/prisma/enums";

const MANAGER_BLOCKED_ROLES = new Set<StoreRole>([
  StoreRole.OWNER,
  StoreRole.MANAGER,
]);

export const getAssignableRoles = (actorRole: StoreRole): StoreRole[] => {
  const allRoles = Object.values(StoreRole);

  if (actorRole === StoreRole.OWNER) {
    return allRoles.filter((role) => role !== StoreRole.OWNER);
  }

  if (actorRole === StoreRole.MANAGER) {
    return allRoles.filter((role) => !MANAGER_BLOCKED_ROLES.has(role));
  }

  return [];
};

export const canAssignRole = (
  actorRole: StoreRole,
  targetRole: StoreRole,
): boolean => {
  return getAssignableRoles(actorRole).includes(targetRole);
};
