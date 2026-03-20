import { describe, expect, it } from "vitest";
import { purchaseInventoryResponsibilityService } from "../purchase-inventory-responsibility.service.js";

describe("purchaseInventoryResponsibilityService", () => {
  it("adds stock for GRNs and direct or order-linked purchase invoices", () => {
    expect(
      purchaseInventoryResponsibilityService.resolve("GOODS_RECEIPT_NOTE", "PURCHASE_ORDER"),
    ).toEqual({
      effect: "ADD",
      parentType: "PURCHASE_ORDER",
    });

    expect(
      purchaseInventoryResponsibilityService.resolve("PURCHASE_INVOICE", null),
    ).toEqual({
      effect: "ADD",
      parentType: null,
    });

    expect(
      purchaseInventoryResponsibilityService.resolve("PURCHASE_INVOICE", "PURCHASE_ORDER"),
    ).toEqual({
      effect: "ADD",
      parentType: "PURCHASE_ORDER",
    });
  });

  it("skips stock for GRN-backed purchase invoices and deducts stock for returns", () => {
    expect(
      purchaseInventoryResponsibilityService.resolve("PURCHASE_INVOICE", "GOODS_RECEIPT_NOTE"),
    ).toEqual({
      effect: "NONE",
      parentType: "GOODS_RECEIPT_NOTE",
    });

    expect(
      purchaseInventoryResponsibilityService.resolve("PURCHASE_RETURN", "PURCHASE_INVOICE"),
    ).toEqual({
      effect: "DEDUCT",
      parentType: "PURCHASE_INVOICE",
    });

    expect(
      purchaseInventoryResponsibilityService.resolve("PURCHASE_RETURN", "GOODS_RECEIPT_NOTE"),
    ).toEqual({
      effect: "DEDUCT",
      parentType: "GOODS_RECEIPT_NOTE",
    });
  });
});
