import { describe, expect, it, vi } from "vitest";
import tenantService from "../../tenant/tenant.service.js";
import * as salesOverviewService from "../sales-overview.service.js";
import { getSalesOverview } from "../sales.controller.js";

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("sales.controller getSalesOverview", () => {
  it("uses the selected business from auth context", async () => {
    const overview = {
      generatedAt: "2026-04-28T00:00:00.000Z",
      kpis: {
        todaySalesAmount: 1000,
        todaySalesDocumentCount: 2,
        openEstimateCount: 1,
        pendingOrderCount: 1,
        todayDeliveryCount: 1,
      },
      needsAttention: [],
      recentActivity: [],
    };
    const serviceSpy = vi
      .spyOn(salesOverviewService, "getSalesOverview")
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

    getSalesOverview(req, res, next);
    await flushAsync();

    expect(serviceSpy).toHaveBeenCalledWith("tenant-1", undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("rejects a location that is not part of the selected business", async () => {
    vi.spyOn(tenantService, "validateBusinessLocation").mockResolvedValue(null);
    const serviceSpy = vi.spyOn(salesOverviewService, "getSalesOverview");
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

    getSalesOverview(req, res, next);
    await flushAsync();

    expect(serviceSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
