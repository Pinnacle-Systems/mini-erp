import { prisma } from "@/lib/prisma";

const getStoresForIdentity = async (identityId: string) => {
  return prisma.store.findMany({
    where: {
      members: {
        some: {
          identity_id: identityId,
        },
      },
    },
  });
};

const validateMembership = async (identityId: string, storeId: string) => {
  return prisma.storeMember.findFirst({
    where: {
      identity_id: identityId,
      store_id: storeId,
    },
  });
};

const tenantService = {
  getStoresForIdentity,
  validateMembership,
};

export default tenantService;
