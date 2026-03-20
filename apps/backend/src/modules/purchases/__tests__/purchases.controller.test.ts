import { describe, expect, it, vi } from "vitest";
import {
  assertPurchaseAccess,
  getPurchaseCapabilityRequired,
} from "../purchases.controller.js";

describe("purchases.controller", () => {
  it("maps purchase returns to the return capability", () => {
    expect(getPurchaseCapabilityRequired("PURCHASE_RETURN")).toBe("TXN_PURCHASE_RETURN");
    expect(getPurchaseCapabilityRequired("PURCHASE_ORDER")).toBe("TXN_PURCHASE_CREATE");
    expect(getPurchaseCapabilityRequired("GOODS_RECEIPT_NOTE")).toBe("TXN_PURCHASE_CREATE");
    expect(getPurchaseCapabilityRequired("PURCHASE_INVOICE")).toBe("TXN_PURCHASE_CREATE");
  });

  it("rejects access when the user is not a business member", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_ORDER", {
        validateMembership: vi.fn().mockResolvedValue(null),
        getCapabilities: vi.fn(),
      } as never),
    ).rejects.toThrow("Access denied");
  });

  it("rejects access when supplier capability is missing", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_ORDER", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi.fn().mockResolvedValue(["TXN_PURCHASE_CREATE"]),
      } as never),
    ).rejects.toThrow("purchase order workflow is not enabled for this store license");
  });

  it("rejects returns when return capability is missing", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_RETURN", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi
          .fn()
          .mockResolvedValue(["PARTIES_SUPPLIERS", "TXN_PURCHASE_CREATE"]),
      } as never),
    ).rejects.toThrow("purchase return workflow is not enabled for this store license");
  });

  it("allows access when supplier and document capabilities are both present", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_INVOICE", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi
          .fn()
          .mockResolvedValue(["PARTIES_SUPPLIERS", "TXN_PURCHASE_CREATE"]),
      } as never),
    ).resolves.toBeUndefined();
  });
});
