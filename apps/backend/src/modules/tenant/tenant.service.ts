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
      store_id_identity_id: {
        store_id: storeId,
        identity_id: identityId,
      },
    },
  });
};

export default {
  getStoresForIdentity,
  validateMembership,
};
