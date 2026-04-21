import { describe, expect, it, vi } from "vitest";
import { getBusinessModulesFromLicense } from "../license.service.js";

const createLicenseDbMock = (capabilities: string[]) => ({
  businessLicense: {
    findFirst: vi.fn().mockResolvedValue({
      id: "license-1",
      version: 1,
      status: "ACTIVE",
      begins_at: new Date("2026-01-01T00:00:00.000Z"),
      ends_at: new Date("2026-12-31T23:59:59.999Z"),
      bundle_key: "CUSTOM",
      add_on_capability_keys: capabilities,
      removed_capability_keys: [],
      user_limit_type: null,
      user_limit_value: null,
    }),
  },
});

describe("getBusinessModulesFromLicense", () => {
  it("enables purchases independently when supplier and purchase capabilities are present", async () => {
    const db = createLicenseDbMock([
      "PARTIES_SUPPLIERS",
      "TXN_PURCHASE_CREATE",
    ]);

    await expect(getBusinessModulesFromLicense("business-1", db as never)).resolves.toEqual({
      accounts: false,
      catalog: false,
      inventory: false,
      purchases: true,
      sales: false,
      pricing: false,
    });
  });

  it("does not infer purchases from sales capabilities alone", async () => {
    const db = createLicenseDbMock([
      "PARTIES_CUSTOMERS",
      "TXN_SALE_CREATE",
    ]);

    await expect(getBusinessModulesFromLicense("business-1", db as never)).resolves.toEqual({
      accounts: false,
      catalog: false,
      inventory: false,
      purchases: false,
      sales: true,
      pricing: true,
    });
  });
});
