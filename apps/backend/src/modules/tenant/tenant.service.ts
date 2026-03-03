import { prisma } from "../../lib/prisma.js";
import { LICENSE_SELECT, toLicenseView } from "../license/license.service.js";

const toAssignedStoreView = (business: {
  id: string;
  name: string;
  licenses: Array<{
    id: string;
    version: number;
    status: "ACTIVE" | "SUPERSEDED";
    begins_at: Date;
    ends_at: Date;
    bundle_key: any;
    add_on_capability_keys: any[];
    removed_capability_keys: any[];
    user_limit_type: any;
    user_limit_value: number | null;
    updated_at: Date;
  }>;
}) => ({
  id: business.id,
  name: business.name,
  license: business.licenses[0]
    ? {
        ...toLicenseView(business.licenses[0]),
        fetchedAt: business.licenses[0].updated_at.toISOString(),
      }
    : null,
});

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
      licenses: {
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          ...LICENSE_SELECT,
          updated_at: true,
        },
      },
    },
  });

  return businesses.map(toAssignedStoreView);
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
