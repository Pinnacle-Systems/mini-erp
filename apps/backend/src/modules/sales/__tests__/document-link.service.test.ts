import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentLinkService } from "../document-link.service.js";
import { salesBalanceService } from "../sales-balance.service.js";
import { createSalesTxMock } from "./test-utils.js";

describe("documentLinkService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when the document has no parent", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-1",
      type: "SALES_INVOICE",
      parent_id: null,
      posted_at: new Date("2026-03-16T00:00:00.000Z"),
      lineItems: [],
    });

    await expect(
      documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1"),
    ).resolves.toBeUndefined();

    expect(tx.document.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.documentLineLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.documentLineLink.createMany).not.toHaveBeenCalled();
  });

  it("rejects when the parent document no longer exists", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "SALES_INVOICE",
        parent_id: "order-1",
        posted_at: new Date("2026-03-16T00:00:00.000Z"),
        lineItems: [],
      })
      .mockResolvedValueOnce(null);

    await expect(
      documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1"),
    ).rejects.toThrow("Selected source document is no longer available");
  });

  it("rejects unsupported parent-child pairs", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "parent-invoice-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "1.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "parent-invoice-1",
        type: "SALES_INVOICE",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "parent-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "1.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });

    await expect(
      documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1"),
    ).rejects.toThrow("This document conversion does not support line-level linking");
  });

  it("rejects unposted parents", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "return-1") {
        return {
          id: "return-1",
          type: "SALES_RETURN",
          parent_id: "challan-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "return-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "1.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        posted_at: null,
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "1.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });

    await expect(
      documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "return-1"),
    ).rejects.toThrow("Source document must be posted before conversion can be posted");
  });

  it("creates challan-linked return links", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "return-1") {
        return {
          id: "return-1",
          type: "SALES_RETURN",
          parent_id: "challan-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "return-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "2.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "challan-1",
        sourceDocumentType: "DELIVERY_CHALLAN",
        sourceDocumentNumber: "DC-0001",
        sourceLineId: "challan-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(
      tx as never,
      "tenant-1",
      "return-1",
    );

    expect(tx.documentLineLink.deleteMany).toHaveBeenCalledWith({
      where: {
        target_line_id: {
          in: ["return-line-1"],
        },
      },
    });
    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "challan-line-1",
          target_line_id: "return-line-1",
          quantity: 2,
          type: "RETURN",
        },
      ],
    });
  });

  it("skips ad-hoc lines without sourceLineId in explicit mixed-origin mode", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-linked",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "2.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
            {
              id: "invoice-line-ad-hoc",
              variant_id: "variant-2",
              description_snapshot: "Product B",
              description: "Product B",
              quantity: "1.000",
              unit_price: "50.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await documentLinkService.upsertLinksForDocument(
      tx as never,
      "tenant-1",
      "invoice-1",
      {
        "invoice-line-linked": "order-line-1",
        "invoice-line-ad-hoc": null,
      },
    );

    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "order-line-1",
          target_line_id: "invoice-line-linked",
          quantity: 2,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("rejects sourceLineId values that do not belong to the selected parent", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "1.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([]);

    await expect(
      documentLinkService.upsertLinksForDocument(tx as never, "tenant-1", "invoice-1", {
        "invoice-line-1": "other-parent-line",
      }),
    ).rejects.toThrow("Unable to link line Product A to the selected parent line");
  });

  it("persists links for draft targets using the same strict balance validation", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "draft-invoice-1") {
        return {
          id: "draft-invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: null,
          lineItems: [
            {
              id: "draft-invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "5.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await documentLinkService.upsertLinksForDocument(tx as never, "tenant-1", "draft-invoice-1");

    expect(tx.documentLineLink.deleteMany).toHaveBeenCalledWith({
      where: {
        target_line_id: {
          in: ["draft-invoice-line-1"],
        },
      },
    });
    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "order-line-1",
          target_line_id: "draft-invoice-line-1",
          quantity: 5,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("rejects converted quantities that exceed the available balance", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "6.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await expect(
      documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1"),
    ).rejects.toThrow("Converted quantity exceeds available remaining quantity");
  });

  it("skips zero-quantity child lines without creating links", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "0.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");

    expect(tx.documentLineLink.deleteMany).toHaveBeenCalledWith({
      where: {
        target_line_id: {
          in: ["invoice-line-1"],
        },
      },
    });
    expect(tx.documentLineLink.createMany).not.toHaveBeenCalled();
  });

  it("splits a child line allocation across multiple matching source lines", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "5.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "2.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
          {
            id: "order-line-2",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "3.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 2,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 2,
        returnableQuantity: 2,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 2,
        invoiceableQuantity: 2,
      },
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-2",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 3,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 3,
        returnableQuantity: 3,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 3,
        invoiceableQuantity: 3,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");

    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "order-line-1",
          target_line_id: "invoice-line-1",
          quantity: 2,
          type: "FULFILLMENT",
        },
        {
          source_line_id: "order-line-2",
          target_line_id: "invoice-line-1",
          quantity: 3,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("prefers exact signature matches before other same-variant source lines", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Preferred Match",
              description: "Preferred Match",
              quantity: "2.000",
              unit_price: "120.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "a-line",
            variant_id: "variant-1",
            description_snapshot: "Other Match",
            description: "Other Match",
            quantity: "2.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
          {
            id: "b-line",
            variant_id: "variant-1",
            description_snapshot: "Preferred Match",
            description: "Preferred Match",
            quantity: "2.000",
            unit_price: "120.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "a-line",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Other Match",
        originalQuantity: 2,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 2,
        returnableQuantity: 2,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 2,
        invoiceableQuantity: 2,
      },
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "b-line",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Preferred Match",
        originalQuantity: 2,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 2,
        returnableQuantity: 2,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 2,
        invoiceableQuantity: 2,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");

    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "b-line",
          target_line_id: "invoice-line-1",
          quantity: 2,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("uses challan invoiceable quantity when linking challan-backed invoices", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "challan-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Delivered Product",
              description: "Delivered Product",
              quantity: "3.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "challan-1",
        type: "DELIVERY_CHALLAN",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "challan-line-1",
            variant_id: "variant-1",
            description_snapshot: "Delivered Product",
            description: "Delivered Product",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "challan-1",
        sourceDocumentType: "DELIVERY_CHALLAN",
        sourceDocumentNumber: "DC-0001",
        sourceLineId: "challan-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Delivered Product",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 2,
        remainingQuantity: 3,
        returnableQuantity: 3,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 3,
        invoiceableQuantity: 3,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");

    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "challan-line-1",
          target_line_id: "invoice-line-1",
          quantity: 3,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("is safe to re-run for the same posted target document", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "SALES_INVOICE",
          parent_id: "order-1",
          posted_at: new Date("2026-03-16T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Product A",
              description: "Product A",
              quantity: "5.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "order-1",
        type: "SALES_ORDER",
        posted_at: new Date("2026-03-15T00:00:00.000Z"),
        lineItems: [
          {
            id: "order-line-1",
            variant_id: "variant-1",
            description_snapshot: "Product A",
            description: "Product A",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(salesBalanceService, "getLineBalances").mockResolvedValue([
      {
        sourceDocumentId: "order-1",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentNumber: "SO-0001",
        sourceLineId: "order-line-1",
        itemId: "item-1",
        variantId: "variant-1",
        description: "Product A",
        originalQuantity: 5,
        fulfilledQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 5,
        returnableQuantity: 5,
        shipmentConsumedQuantity: 0,
        shipmentReturnedQuantity: 0,
        shipmentRemainingQuantity: 5,
        invoiceableQuantity: 5,
      },
    ]);

    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");
    await documentLinkService.createLinksForPostedDocument(tx as never, "tenant-1", "invoice-1");

    expect(tx.documentLineLink.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.documentLineLink.createMany).toHaveBeenCalledTimes(2);
  });
});
