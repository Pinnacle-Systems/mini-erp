import { prisma } from "../../lib/prisma.js";

const getBusinessesForIdentity = async (identityId) => {
  return prisma.business.findMany({
    where: {
      members: {
        some: {
          identity_id: identityId,
        },
      },
    },
  });
};

const validateMembership = async (identityId, businessId) => {
  return prisma.businessMember.findUnique({
    where: {
      business_id_identity_id: {
        business_id: businessId,
        identity_id: identityId,
      },
    },
  });
};

export default {
  getBusinessesForIdentity,
  validateMembership,
};
