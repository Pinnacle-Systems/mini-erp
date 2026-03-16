import { afterEach, describe, expect, it } from "vitest";
import { stockPostingService } from "../stock-posting.service.js";
import { createSalesTxMock } from "./test-utils.js";

describe("stockPostingService", () => {
  const primeStockLevelSyncMocks = (
    tx: ReturnType<typeof createSalesTxMock>,
    options: {
      variantId: string;
      locationId: string;
      locationName: string;
      quantityOnHand: string;
      itemId?: string;
      itemName?: string;
      variantName?: string | null;
      sku?: string | null;
      unit?: string;
    },
  ) => {
    tx.itemVariant.findUnique.mockResolvedValue({
      id: options.variantId,
      business_id: "tenant-1",
      item_id: options.itemId ?? "item-1",
      name: options.variantName ?? "Variant A",
      sku: options.sku ?? "SKU-1",
      deleted_at: null,
      item: {
        id: options.itemId ?? "item-1",
        name: options.itemName ?? "Product A",
        unit: options.unit ?? "PCS",
        deleted_at: null,
      },
    });
    tx.businessLocation.findFirst.mockResolvedValue({
      id: options.locationId,
      name: options.locationName,
    });
    tx.syncChangeLog.findFirst.mockResolvedValue(null);
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        quantity: options.quantityOnHand,
      },
    ]);
  };

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
      location_name_snapshot: "Main Warehouse",
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
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        variant_id: "variant-product",
        quantity: "10.000",
      },
    ]);
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "9.000",
    });

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
    expect(tx.syncChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: "tenant-1",
        entity: "stock_level",
        entity_id: "variant-product:location-1",
        operation: "UPDATE",
        server_version: 1,
        data: expect.objectContaining({
          variantId: "variant-product",
          locationId: "location-1",
          locationName: "Main Warehouse",
          quantityOnHand: 9,
        }),
      }),
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
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        variant_id: "variant-product",
        quantity: "10.000",
      },
    ]);
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "location-1",
      quantityOnHand: "8.000",
    });

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
            target_links: [
              {
                source_line: {
                  document: {
                    type: "DELIVERY_CHALLAN",
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "DELIVERY_CHALLAN",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);
    tx.stockLedger.findMany.mockResolvedValue([]);

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).not.toHaveBeenCalled();
  });

  it("deducts stock only for ad-hoc lines on challan-backed invoices", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "SALES_INVOICE",
        parent_id: "challan-1",
        location_id: "location-1",
        lineItems: [
          {
            id: "invoice-line-linked",
            variant_id: "variant-linked",
            quantity: "10.000",
            description_snapshot: "Linked Product",
            description: "Linked Product",
            target_links: [
              {
                source_line: {
                  document: {
                    type: "DELIVERY_CHALLAN",
                  },
                },
              },
            ],
          },
          {
            id: "invoice-line-ad-hoc",
            variant_id: "variant-ad-hoc",
            quantity: "2.000",
            description_snapshot: "Ad-hoc Product",
            description: "Ad-hoc Product",
            target_links: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "DELIVERY_CHALLAN",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-linked",
        item: {
          item_type: "PRODUCT",
        },
      },
      {
        id: "variant-ad-hoc",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        variant_id: "variant-ad-hoc",
        quantity: "5.000",
      },
    ]);
    tx.itemVariant.findUnique.mockResolvedValue({
      id: "variant-ad-hoc",
      business_id: "tenant-1",
      item_id: "item-1",
      name: "Ad-hoc Product",
      sku: "ADHOC-1",
      deleted_at: null,
      item: {
        id: "item-1",
        name: "Product A",
        unit: "PCS",
        deleted_at: null,
      },
    });
    tx.businessLocation.findFirst.mockResolvedValue({
      id: "location-1",
      name: "location-1",
    });
    tx.syncChangeLog.findFirst.mockResolvedValue(null);
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        quantity: "3.000",
      },
    ]);

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-ad-hoc",
          quantity: -2,
          reason: "SALE_INVOICE_POST",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "return-location-1",
      locationName: "return-location-1",
      quantityOnHand: "3.000",
    });

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.findMany).toHaveBeenCalledTimes(1);
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
        location_name_snapshot: "Main Warehouse",
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
    tx.stockLedger.findMany.mockResolvedValueOnce([
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "-5.000",
    });

    await stockPostingService.applyPostingEffects(tx as never, "tenant-1", "challan-1");

    expect(tx.stockLedger.findMany).toHaveBeenCalledTimes(1);
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
    expect(tx.syncChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "stock_level",
        entity_id: "variant-product:location-1",
        data: expect.objectContaining({
          quantityOnHand: -5,
        }),
      }),
    });
  });

  it("writes positive reversal rows when cancelling a stock-deducting document", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        parent_id: "order-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-product",
            quantity: "4.000",
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "4.000",
    });

    await stockPostingService.applyCancellationEffects(
      tx as never,
      "tenant-1",
      "challan-1",
    );

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: 4,
          reason: "SALE_DELIVERY_CHALLAN_CANCEL",
          reference_id: "challan-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
    expect(tx.syncChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "stock_level",
        entity_id: "variant-product:location-1",
        data: expect.objectContaining({
          quantityOnHand: 4,
        }),
      }),
    });
  });

  it("writes negative reversal rows when cancelling a sales return", async () => {
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
            quantity: "2.000",
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "return-location-1",
      locationName: "return-location-1",
      quantityOnHand: "-2.000",
    });

    await stockPostingService.applyCancellationEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: -2,
          reason: "SALE_RETURN_CANCEL",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("reapplies stock rows when reopening a cancelled stock-deducting document", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "SALES_INVOICE",
        parent_id: "order-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
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
    tx.stockLedger.findMany.mockResolvedValueOnce([
      {
        variant_id: "variant-product",
        quantity: "10.000",
      },
    ]);
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "8.000",
    });

    await stockPostingService.applyReopenEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -2,
          reason: "SALE_INVOICE_REOPEN",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
    expect(tx.syncChangeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: "stock_level",
        entity_id: "variant-product:location-1",
        data: expect.objectContaining({
          quantityOnHand: 8,
        }),
      }),
    });
  });
});
