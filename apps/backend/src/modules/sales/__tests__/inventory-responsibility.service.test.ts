import { describe, expect, it } from "vitest";
import { inventoryResponsibilityService } from "../inventory-responsibility.service.js";

describe("inventoryResponsibilityService", () => {
  it("deducts stock for challans and direct or order-linked invoices", () => {
    expect(
      inventoryResponsibilityService.resolve("DELIVERY_CHALLAN", "SALES_ORDER"),
    ).toEqual({
      effect: "DEDUCT",
      parentType: "SALES_ORDER",
    });

    expect(inventoryResponsibilityService.resolve("SALES_INVOICE", null)).toEqual({
      effect: "DEDUCT",
      parentType: null,
    });

    expect(
      inventoryResponsibilityService.resolve("SALES_INVOICE", "SALES_ORDER"),
    ).toEqual({
      effect: "DEDUCT",
      parentType: "SALES_ORDER",
    });
  });

  it("skips stock for challan-backed invoices and adds stock for returns", () => {
    expect(
      inventoryResponsibilityService.resolve("SALES_INVOICE", "DELIVERY_CHALLAN"),
    ).toEqual({
      effect: "NONE",
      parentType: "DELIVERY_CHALLAN",
    });

    expect(
      inventoryResponsibilityService.resolve("SALES_RETURN", "SALES_INVOICE"),
    ).toEqual({
      effect: "ADD",
      parentType: "SALES_INVOICE",
    });

    expect(
      inventoryResponsibilityService.resolve("SALES_RETURN", "DELIVERY_CHALLAN"),
    ).toEqual({
      effect: "ADD",
      parentType: "DELIVERY_CHALLAN",
    });
  });
});
