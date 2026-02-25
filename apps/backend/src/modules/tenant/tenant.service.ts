import { prisma } from "../../lib/prisma.js";
import { LICENSE_SELECT, toLicenseView } from "../license/license.service.js";

const getBusinessesForIdentity = async (identityId) => {
  const businesses = await prisma.business.findMany({
    where: {
      members: {
        some: {
          identity_id: identityId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      license: {
        select: {
          ...LICENSE_SELECT,
          updated_at: true,
        },
      },
    },
  });

  return businesses.map((business) => ({
    id: business.id,
    name: business.name,
    license: business.license
      ? {
          ...toLicenseView(business.license),
          fetchedAt: business.license.updated_at.toISOString(),
        }
      : null,
  }));
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
