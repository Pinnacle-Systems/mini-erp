import { afterEach, describe, expect, it } from "vitest";
import { purchaseStockPostingService } from "../purchase-stock-posting.service.js";
import { createPurchaseTxMock } from "./test-utils.js";

describe("purchaseStockPostingService", () => {
  const primeStockLevelSyncMocks = (
    tx: ReturnType<typeof createPurchaseTxMock>,
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

  it("writes positive stock rows for standalone GRNs", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValueOnce({
      id: "grn-1",
      type: "GOODS_RECEIPT_NOTE",
      parent_id: null,
      location_id: "location-1",
      location_name_snapshot: "Main Warehouse",
      lineItems: [
        {
          id: "grn-line-1",
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "1.000",
    });

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "grn-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: 1,
          reason: "PURCHASE_GRN_POST",
          reference_id: "grn-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes positive stock rows for order-linked purchase invoices and skips service lines", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        parent_id: "po-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "invoice-line-1",
            variant_id: "variant-product",
            quantity: "2.000",
            description_snapshot: "Product A",
            description: "Product A",
            target_links: [],
          },
          {
            id: "invoice-line-2",
            variant_id: "variant-service",
            quantity: "1.000",
            description_snapshot: "Installation",
            description: "Installation",
            target_links: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_ORDER",
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "2.000",
    });

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: 2,
          reason: "PURCHASE_INVOICE_POST",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("skips ledger writes for GRN-backed purchase invoices", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        parent_id: "grn-1",
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
                    type: "GOODS_RECEIPT_NOTE",
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "GOODS_RECEIPT_NOTE",
      });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-product",
        item: {
          item_type: "PRODUCT",
        },
      },
    ]);

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).not.toHaveBeenCalled();
  });

  it("adds stock only for ad-hoc lines on GRN-backed purchase invoices", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        parent_id: "grn-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
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
                    type: "GOODS_RECEIPT_NOTE",
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
        type: "GOODS_RECEIPT_NOTE",
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
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-ad-hoc",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "2.000",
    });

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "invoice-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-ad-hoc",
          quantity: 2,
          reason: "PURCHASE_INVOICE_POST",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes negative stock rows for purchase returns using the return location", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "PURCHASE_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        location_name_snapshot: "Return Bay",
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
        type: "PURCHASE_INVOICE",
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
      locationId: "return-location-1",
      locationName: "Return Bay",
      quantityOnHand: "7.000",
    });

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: -3,
          reason: "PURCHASE_RETURN_POST",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("blocks insufficient stock for purchase returns when negative stock is disabled", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "PURCHASE_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        lineItems: [
          {
            id: "return-line-1",
            variant_id: "variant-product",
            quantity: "5.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_INVOICE",
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
      purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "return-1"),
    ).rejects.toThrow("Posting would make stock negative for one or more items");

    expect(tx.stockLedger.createMany).not.toHaveBeenCalled();
  });

  it("allows insufficient stock for purchase returns when negative stock is enabled", async () => {
    process.env.ALLOW_NEGATIVE_STOCK = "true";

    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "PURCHASE_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        location_name_snapshot: "Return Bay",
        lineItems: [
          {
            id: "return-line-1",
            variant_id: "variant-product",
            quantity: "5.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_INVOICE",
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
      locationName: "Return Bay",
      quantityOnHand: "-5.000",
    });

    await purchaseStockPostingService.applyPostingEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: -5,
          reason: "PURCHASE_RETURN_POST",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes negative reversal rows when cancelling a posted GRN", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "grn-1",
        type: "GOODS_RECEIPT_NOTE",
        parent_id: "po-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "grn-line-1",
            variant_id: "variant-product",
            quantity: "4.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_ORDER",
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
      quantityOnHand: "6.000",
    });

    await purchaseStockPostingService.applyCancellationEffects(tx as never, "tenant-1", "grn-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -4,
          reason: "PURCHASE_GRN_CANCEL",
          reference_id: "grn-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes negative reversal rows when cancelling a stock-responsible purchase invoice", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        parent_id: "po-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "invoice-line-1",
            variant_id: "variant-product",
            quantity: "2.000",
            description_snapshot: "Product A",
            description: "Product A",
            target_links: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_ORDER",
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
        quantity: "5.000",
      },
    ]);
    primeStockLevelSyncMocks(tx, {
      variantId: "variant-product",
      locationId: "location-1",
      locationName: "Main Warehouse",
      quantityOnHand: "3.000",
    });

    await purchaseStockPostingService.applyCancellationEffects(
      tx as never,
      "tenant-1",
      "invoice-1",
    );

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: -2,
          reason: "PURCHASE_INVOICE_CANCEL",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("writes positive reversal rows when cancelling a posted purchase return", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "PURCHASE_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        location_name_snapshot: "Return Bay",
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
        type: "PURCHASE_INVOICE",
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
      locationName: "Return Bay",
      quantityOnHand: "2.000",
    });

    await purchaseStockPostingService.applyCancellationEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: 2,
          reason: "PURCHASE_RETURN_CANCEL",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("reapplies stock rows when reopening a cancelled GRN", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "grn-1",
        type: "GOODS_RECEIPT_NOTE",
        parent_id: "po-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "grn-line-1",
            variant_id: "variant-product",
            quantity: "3.000",
            description_snapshot: "Product A",
            description: "Product A",
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_ORDER",
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
      quantityOnHand: "3.000",
    });

    await purchaseStockPostingService.applyReopenEffects(tx as never, "tenant-1", "grn-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: 3,
          reason: "PURCHASE_GRN_REOPEN",
          reference_id: "grn-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("reapplies stock rows when reopening a cancelled stock-responsible purchase invoice", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        parent_id: "po-1",
        location_id: "location-1",
        location_name_snapshot: "Main Warehouse",
        lineItems: [
          {
            id: "invoice-line-1",
            variant_id: "variant-product",
            quantity: "2.000",
            description_snapshot: "Product A",
            description: "Product A",
            target_links: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        type: "PURCHASE_ORDER",
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
      quantityOnHand: "2.000",
    });

    await purchaseStockPostingService.applyReopenEffects(
      tx as never,
      "tenant-1",
      "invoice-1",
    );

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "location-1",
          variant_id: "variant-product",
          quantity: 2,
          reason: "PURCHASE_INVOICE_REOPEN",
          reference_id: "invoice-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });

  it("reapplies negative stock rows when reopening a cancelled purchase return", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "return-1",
        type: "PURCHASE_RETURN",
        parent_id: "invoice-1",
        location_id: "return-location-1",
        location_name_snapshot: "Return Bay",
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
        type: "PURCHASE_INVOICE",
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
      locationId: "return-location-1",
      locationName: "Return Bay",
      quantityOnHand: "8.000",
    });

    await purchaseStockPostingService.applyReopenEffects(tx as never, "tenant-1", "return-1");

    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: [
        {
          business_id: "tenant-1",
          location_id: "return-location-1",
          variant_id: "variant-product",
          quantity: -2,
          reason: "PURCHASE_RETURN_REOPEN",
          reference_id: "return-1",
          is_active: true,
          deleted_at: null,
        },
      ],
    });
  });
});
