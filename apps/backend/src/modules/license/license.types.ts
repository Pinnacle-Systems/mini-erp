export const LICENSE_LIMIT_TYPES = {
  MAX_USERS: "MAX_USERS",
  MAX_CONCURRENT_USERS: "MAX_CONCURRENT_USERS",
} as const;

export type LicenseLimitType =
  (typeof LICENSE_LIMIT_TYPES)[keyof typeof LICENSE_LIMIT_TYPES];

export const BUNDLE_KEYS = [
  "SALES_LITE",
  "SALES_STOCK_OUT",
  "TRADING",
  "SERVICE_BILLING",
  "CUSTOM",
] as const;

export const CAPABILITY_KEYS = [
  "BUSINESS_LOCATIONS",
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
] as const;

export type BusinessBundleKey = (typeof BUNDLE_KEYS)[number];
export type BusinessCapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type BusinessLicenseInput = {
  beginsOn?: string | null;
  endsOn?: string | null;
  bundleKey?: BusinessBundleKey | null;
  addOnCapabilities?: BusinessCapabilityKey[];
  removedCapabilities?: BusinessCapabilityKey[];
  userLimitType?: LicenseLimitType | null;
  userLimitValue?: number | null;
};

export type BusinessLicenseView = {
  beginsOn: string;
  endsOn: string;
  bundleKey: BusinessBundleKey;
  addOnCapabilities: BusinessCapabilityKey[];
  removedCapabilities: BusinessCapabilityKey[];
  userLimitType: LicenseLimitType | null;
  userLimitValue: number | null;
};
