import { prisma } from "../../lib/prisma.js";
import { LICENSE_SELECT, toLicenseView } from "../license/license.service.js";

const toAssignedStoreView = (business: {
  id: string;
  name: string;
  locations: Array<{
    id: string;
    name: string;
    is_default: boolean;
    is_active: boolean;
    deleted_at: Date | null;
  }>;
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
  locations: business.locations
    .filter((location) => location.is_active && !location.deleted_at)
    .map((location) => ({
      id: location.id,
      name: location.name,
      isDefault: location.is_default,
    })),
  defaultLocationId:
    business.locations.find((location) => location.is_default && location.is_active && !location.deleted_at)?.id ??
    null,
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
      locations: {
        where: {
          deleted_at: null,
          is_active: true,
        },
        orderBy: [{ is_default: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          is_default: true,
          is_active: true,
          deleted_at: true,
        },
      },
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

const getBusinessMembership = async (identityId: string, businessId: string) =>
  prisma.businessMember.findUnique({
    where: {
      business_id_identity_id: {
        business_id: businessId,
        identity_id: identityId,
      },
    },
    select: {
      role: true,
    },
  });

const getBusinessLocations = async (businessId: string) =>
  prisma.businessLocation.findMany({
    where: {
      business_id: businessId,
      deleted_at: null,
      is_active: true,
    },
    orderBy: [{ is_default: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      is_default: true,
    },
  });

const getDefaultBusinessLocation = async (businessId: string) =>
  prisma.businessLocation.findFirst({
    where: {
      business_id: businessId,
      deleted_at: null,
      is_active: true,
      is_default: true,
    },
    select: {
      id: true,
      name: true,
      is_default: true,
    },
  });

const validateBusinessLocation = async (businessId: string, locationId: string) =>
  prisma.businessLocation.findFirst({
    where: {
      id: locationId,
      business_id: businessId,
      deleted_at: null,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      is_default: true,
    },
  });

export default {
  getBusinessesForIdentity,
  validateMembership,
  getBusinessMembership,
  getBusinessLocations,
  getDefaultBusinessLocation,
  validateBusinessLocation,
};
