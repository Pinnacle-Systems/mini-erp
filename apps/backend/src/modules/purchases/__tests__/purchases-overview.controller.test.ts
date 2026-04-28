import { describe, expect, it, vi } from "vitest";
import tenantService from "../../tenant/tenant.service.js";
import * as purchaseOverviewService from "../purchases-overview.service.js";
import { getPurchaseOverview } from "../purchases.controller.js";

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("purchases.controller getPurchaseOverview", () => {
  it("uses the selected business from auth context", async () => {
    const overview = {
      generatedAt: "2026-04-28T00:00:00.000Z",
      kpis: {
        todayPurchaseAmount: 1000,
        todayPurchaseDocumentCount: 2,
        openOrderCount: 1,
        pendingGoodsReceiptCount: 1,
        todayGoodsReceiptCount: 1,
      },
      needsAttention: [],
      recentActivity: [],
    };
    const serviceSpy = vi
      .spyOn(purchaseOverviewService, "getPurchaseOverview")
      .mockResolvedValue(overview);
    const req = {
      user: {
        id: "user-1",
        tenantId: "tenant-1",
      },
      query: {},
    } as never;
    const res = {
      json: vi.fn(),
    } as never;
    const next = vi.fn();

    getPurchaseOverview(req, res, next);
    await flushAsync();

    expect(serviceSpy).toHaveBeenCalledWith("tenant-1", undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("rejects a location that is not part of the selected business", async () => {
    vi.spyOn(tenantService, "validateBusinessLocation").mockResolvedValue(null);
    const serviceSpy = vi.spyOn(purchaseOverviewService, "getPurchaseOverview");
    const req = {
      user: {
        id: "user-1",
        tenantId: "tenant-1",
      },
      query: {
        locationId: "location-x",
      },
    } as never;
    const res = {
      json: vi.fn(),
    } as never;
    const next = vi.fn();

    getPurchaseOverview(req, res, next);
    await flushAsync();

    expect(serviceSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
