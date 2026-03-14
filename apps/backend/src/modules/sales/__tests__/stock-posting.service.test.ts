import { afterEach, describe, expect, it } from "vitest";
import { stockPostingService } from "../stock-posting.service.js";
import { createSalesTxMock } from "./test-utils.js";

describe("stockPostingService", () => {
  afterEach(() => {
    delete process.env.ALLOW_NEGATIVE_STOCK;
  });

  it("writes negative stock rows for standalone invoices", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValueOnce({
      id: "invoice-standalone-1",
      type: "SALES_INVOICE",
      parent_id: null,
      location_id: "location-1",
      lineItems: [
        {
          id: "invoice-line-1",
          variant_id: "variant-product",
          quantity: "1.000",
          description_snapshot: "Product A",
          description: "Product A",
        },
      ],
    });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);
    tx.stockLedger.findMany.mockResolvedValue([
      {
        variant_id: "variant-product",
        quantity: "10.000",
      },
    ]);

    await stockPostingService.applyPostingEffects(
      tx as never,
      "tenant-1",
      "invoice-standalone-1",
    );

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -1,
          reason: "SALE_INVOICE_POST",
          reference_id: "invoice-standalone-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes negative stock rows for stock-affecting invoice lines and skips service lines", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "SALES_INVOICE",
        parent_id: "order-1",
        location_id: "location-1",
        lineItems: [
          {
            id: "invoice-line-1",
            variant_id: "variant-product",
            quantity: "2.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
          {
            id: "invoice-line-2",
            variant_id: "variant-service",
            quantity: "1.000",
            description_snapshot: "Installation",
            description: "Installation",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "SALES_ORDER",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
      {
        id: "variant-service",
        item: {
          item_type: "SERVICE",
        },
      },
    ]);
    tx.stockLedger.findMany.mockResolvedValue([
      {
        variant_id: "variant-product",
        quantity: "10.000",
      },
    ]);

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -2,
          reason: "SALE_INVOICE_POST",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("skips ledger writes for challan-backed invoices", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "SALES_INVOICE",
        parent_id: "challan-1",
        location_id: "location-1",
        lineItems: [
          {
            id: "invoice-line-1",
            variant_id: "variant-product",
            quantity: "2.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "DELIVERY_CHALLAN",
      });

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.itemVariant.findMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.createMany).not.toHaveBeenCalled();
  });

  it("writes positive stock rows for sales returns using the return location", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "SALES_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        lineItems: [
          {
            id: "return-line-1",
            variant_id: "variant-product",
            quantity: "3.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "SALES_INVOICE",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.findMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: 3,
          reason: "SALE_RETURN_POST",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("blocks insufficient stock when negative stock is disabled", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        parent_id: "order-1",
        location_id: "location-1",
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-product",
            quantity: "5.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "SALES_ORDER",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);
    tx.stockLedger.findMany.mockResolvedValue([
      {
        variant_id: "variant-product",
        quantity: "2.000",
      },
    ]);

    await expect(
      stockPostingService.applyPostingEffects(tx as never, "tenant-1", "challan-1"),
    ).rejects.toThrow("Posting would make stock negative for one or more items");

    expect(tx.stockLedger.createMany).not.toHaveBeenCalled();
  });

  it("allows insufficient stock when negative stock is enabled", async () => {
    process.env.ALLOW_NEGATIVE_STOCK = "true";

    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        parent_id: "order-1",
        location_id: "location-1",
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-product",
            quantity: "5.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "SALES_ORDER",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "challan-1");

    expect(tx.stockLedger.findMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -5,
          reason: "SALE_DELIVERY_CHALLAN_POST",
          reference_id: "challan-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });
});
