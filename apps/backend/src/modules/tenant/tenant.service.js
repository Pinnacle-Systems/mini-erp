import { prisma } from "../../lib/prisma.js";

const getStoresForIdentity = async (identityId) => {
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

const validateMembership = async (identityId, storeId) => {
  return prisma.storeMember.findUnique({
    where: {
      AND: [
        {
          identity_id: identityId,
        },
        {
          store_id: storeId,
        },
      ],
    },
  });
};

export default {
  getStoresForIdentity,
  validateMembership,
};
