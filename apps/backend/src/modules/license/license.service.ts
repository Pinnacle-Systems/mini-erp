import { prisma } from "../../lib/prisma.js";
import { ForbiddenError } from "../../shared/utils/errors.js";
import {
  BUNDLE_KEYS,
  CAPABILITY_KEYS,
  LICENSE_LIMIT_TYPES,
  type BusinessBundleKey,
  type BusinessCapabilityKey,
  type BusinessLicenseInput,
  type BusinessLicenseView,
} from "./license.types.js";

export type { BusinessLicenseInput, BusinessLicenseView } from "./license.types.js";

export const LICENSE_SELECT = {
  id: true,
  version: true,
  status: true,
  begins_at: true,
  ends_at: true,
  bundle_key: true,
  add_on_capability_keys: true,
  removed_capability_keys: true,
  user_limit_type: true,
  user_limit_value: true,
} as const;

type LicenseRecord = {
  id: string;
  version: number;
  status: "ACTIVE" | "SUPERSEDED";
  begins_at: Date;
  ends_at: Date;
  bundle_key: BusinessBundleKey;
  add_on_capability_keys: BusinessCapabilityKey[];
  removed_capability_keys: BusinessCapabilityKey[];
  user_limit_type: keyof typeof LICENSE_LIMIT_TYPES | null;
  user_limit_value: number | null;
};

type LicenseDbClient = Pick<typeof prisma, "businessLicense" | "businessMember" | "session">;
type LicenseWriteDbClient = Pick<typeof prisma, "businessLicense">;
type SessionWriteDbClient = Pick<typeof prisma, "session">;

type LegacyBusinessModuleKey =
  | "ACCOUNTS"
  | "CATALOG"
  | "INVENTORY"
  | "PRICING"
  | "PURCHASES"
  | "SALES";

const MODULE_TO_CAPABILITIES: Record<LegacyBusinessModuleKey, BusinessCapabilityKey[]> = {
  ACCOUNTS: ["FINANCE_RECEIVABLES", "FINANCE_PAYABLES"],
  CATALOG: ["ITEM_PRODUCTS", "ITEM_SERVICES"],
  INVENTORY: ["INV_STOCK_OUT", "INV_STOCK_IN", "INV_ADJUSTMENT", "INV_TRANSFER"],
  PRICING: ["FINANCE_RECEIVABLES", "FINANCE_PAYABLES"],
  PURCHASES: ["TXN_PURCHASE_CREATE", "TXN_PURCHASE_RETURN"],
  SALES: ["TXN_SALE_CREATE", "TXN_SALE_RETURN"],
};

const BUNDLE_CAPABILITIES: Record<BusinessBundleKey, BusinessCapabilityKey[]> = {
  SALES_LITE: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  SALES_STOCK_OUT: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "INV_STOCK_OUT",
    "FINANCE_RECEIVABLES",
  ],
  TRADING: [
    "ITEM_PRODUCTS",
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "PARTIES_SUPPLIERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "TXN_PURCHASE_CREATE",
    "TXN_PURCHASE_RETURN",
    "INV_STOCK_OUT",
    "INV_STOCK_IN",
    "INV_ADJUSTMENT",
    "INV_TRANSFER",
    "FINANCE_RECEIVABLES",
    "FINANCE_PAYABLES",
  ],
  SERVICE_BILLING: [
    "ITEM_SERVICES",
    "PARTIES_CUSTOMERS",
    "TXN_SALE_CREATE",
    "TXN_SALE_RETURN",
    "FINANCE_RECEIVABLES",
  ],
  CUSTOM: [],
};

const toUtcDayRange = (date: string) => ({
  start: new Date(`${date}T00:00:00.000Z`),
  end: new Date(`${date}T23:59:59.999Z`),
});

const filterCapabilities = (keys: readonly string[] | null | undefined): BusinessCapabilityKey[] => {
  if (!keys?.length) return [];
  const allowed = new Set(CAPABILITY_KEYS);
  return [...new Set(keys.filter((key): key is BusinessCapabilityKey => allowed.has(key as BusinessCapabilityKey)))];
};

const resolveBundleCapabilities = (license: {
  bundle_key: BusinessBundleKey;
  add_on_capability_keys: BusinessCapabilityKey[];
  removed_capability_keys: BusinessCapabilityKey[];
}) => {
  const effective = new Set<BusinessCapabilityKey>(BUNDLE_CAPABILITIES[license.bundle_key] ?? []);
  for (const key of license.add_on_capability_keys) effective.add(key);
  for (const key of license.removed_capability_keys) effective.delete(key);
  return [...effective];
};

const normalizeBundleInput = (license: BusinessLicenseInput) => {
  const bundleKey = BUNDLE_KEYS.includes((license.bundleKey ?? "") as BusinessBundleKey)
    ? (license.bundleKey as BusinessBundleKey)
    : "SALES_LITE";

  return {
    bundleKey,
    addOnCapabilities: filterCapabilities(license.addOnCapabilities),
    removedCapabilities: filterCapabilities(license.removedCapabilities),
  };
};

export const hasLicenseInput = (license: BusinessLicenseInput | undefined) =>
  Boolean(
    license &&
      (license.beginsOn !== undefined ||
        license.endsOn !== undefined ||
        license.bundleKey !== undefined ||
        license.addOnCapabilities !== undefined ||
        license.removedCapabilities !== undefined ||
        license.userLimitType !== undefined ||
        license.userLimitValue !== undefined),
  );

export const toLicenseView = (license: LicenseRecord | null | undefined): BusinessLicenseView | null => {
  if (!license) return null;
  const addOns = filterCapabilities(license.add_on_capability_keys);
  const removed = filterCapabilities(license.removed_capability_keys);
  return {
    beginsOn: license.begins_at.toISOString().slice(0, 10),
    endsOn: license.ends_at.toISOString().slice(0, 10),
    bundleKey: license.bundle_key,
    addOnCapabilities: addOns,
    removedCapabilities: removed,
    userLimitType: license.user_limit_type,
    userLimitValue: license.user_limit_value,
  };
};

export const getBusinessModulesFromLicense = async (
  businessId: string,
  db: LicenseWriteDbClient = prisma,
) => {
  const effectiveCapabilities = await getBusinessCapabilitiesFromLicense(businessId, db);
  const capabilitySet = new Set(effectiveCapabilities);

  return {
    accounts: MODULE_TO_CAPABILITIES.ACCOUNTS.some((key) => capabilitySet.has(key)),
    catalog: MODULE_TO_CAPABILITIES.CATALOG.some((key) => capabilitySet.has(key)),
    inventory: MODULE_TO_CAPABILITIES.INVENTORY.some((key) => capabilitySet.has(key)),
    purchases:
      capabilitySet.has("PARTIES_SUPPLIERS") &&
      MODULE_TO_CAPABILITIES.PURCHASES.some((key) => capabilitySet.has(key)),
    sales: MODULE_TO_CAPABILITIES.SALES.some((key) => capabilitySet.has(key)),
    pricing:
      MODULE_TO_CAPABILITIES.PRICING.some((key) => capabilitySet.has(key)) ||
      capabilitySet.has("TXN_SALE_CREATE"),
  };
};

export const getBusinessCapabilitiesFromLicense = async (
  businessId: string,
  db: LicenseWriteDbClient = prisma,
) => {
  const license = await findBusinessLicense(businessId, db);

  if (!license) {
    return [];
  }

  return resolveBundleCapabilities({
    bundle_key: license.bundle_key,
    add_on_capability_keys: filterCapabilities(license.add_on_capability_keys),
    removed_capability_keys: filterCapabilities(license.removed_capability_keys),
  });
};

export const hasBusinessLicenseCapability = async (
  businessId: string,
  capability: BusinessCapabilityKey,
  db: LicenseWriteDbClient = prisma,
) => {
  const capabilities = await getBusinessCapabilitiesFromLicense(businessId, db);
  return capabilities.includes(capability);
};

export const upsertBusinessLicense = async (
  businessId: string,
  license: BusinessLicenseInput,
  db: LicenseWriteDbClient = prisma,
) => {
  if (!license.beginsOn || !license.endsOn) return null;
  const beginRange = toUtcDayRange(license.beginsOn);
  const endRange = toUtcDayRange(license.endsOn);
  const normalized = normalizeBundleInput(license);

  const activeLicense = await db.businessLicense.findFirst({
    where: {
      business_id: businessId,
      status: "ACTIVE",
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });

  if (activeLicense) {
    await db.businessLicense.updateMany({
      where: {
        business_id: businessId,
        status: "ACTIVE",
      },
      data: {
        status: "SUPERSEDED",
      },
    });
  }

  return db.businessLicense.create({
    data: {
      business_id: businessId,
      version: (activeLicense?.version ?? 0) + 1,
      status: "ACTIVE",
      begins_at: beginRange.start,
      ends_at: endRange.end,
      bundle_key: normalized.bundleKey,
      add_on_capability_keys: normalized.addOnCapabilities,
      removed_capability_keys: normalized.removedCapabilities,
      user_limit_type: license.userLimitType ?? null,
      user_limit_value: license.userLimitValue ?? null,
    },
    select: LICENSE_SELECT,
  });
};

export const findBusinessLicense = async (businessId: string, db: LicenseWriteDbClient = prisma) =>
  db.businessLicense.findFirst({
    where: {
      business_id: businessId,
      status: "ACTIVE",
    },
    orderBy: { version: "desc" },
    select: LICENSE_SELECT,
  });

export const assertLicensedStoreAccess = async (
  businessId: string,
  sessionId: string,
  db: LicenseDbClient = prisma,
) => {
  const now = new Date();
  const license = await findBusinessLicense(businessId, db);

  if (!license) {
    throw new ForbiddenError("Store license is not configured");
  }

  if (license.begins_at > now || license.ends_at < now) {
    throw new ForbiddenError("Store license is not active");
  }

  if (!license.user_limit_type || !license.user_limit_value) {
    return;
  }

  if (license.user_limit_type === LICENSE_LIMIT_TYPES.MAX_USERS) {
    const assignedUsers = await db.businessMember.count({
      where: { business_id: businessId },
    });
    if (assignedUsers > license.user_limit_value) {
      throw new ForbiddenError("Store user limit reached");
    }
    return;
  }

  const activeConcurrentUsers = await db.session.findMany({
    where: {
      id: { not: sessionId },
      selected_business_id: businessId,
      expires_at: { gt: now },
    },
    select: { identity_id: true },
    distinct: ["identity_id"],
  });

  if (activeConcurrentUsers.length >= license.user_limit_value) {
    throw new ForbiddenError("Store concurrent user limit reached");
  }
};

export const setSessionSelectedBusiness = async (
  sessionId: string,
  businessId: string | null,
  db: SessionWriteDbClient = prisma,
) =>
  db.session.update({
    where: { id: sessionId },
    data: { selected_business_id: businessId },
  });

export const setSessionSelectedLocation = async (
  sessionId: string,
  locationId: string | null,
  db: SessionWriteDbClient = prisma,
) =>
  db.session.update({
    where: { id: sessionId },
    data: { selected_location_id: locationId },
  });
