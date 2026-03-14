import { describe, expect, it } from "vitest";
import { salesBalanceService } from "../sales-balance.service.js";
import { createSalesTxMock } from "./test-utils.js";

describe("salesBalanceService", () => {
  it("restores shipment balance on orders when challan-linked returns are active", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "order-1",
      type: "SALES_ORDER",
      doc_number: "SO-0001",
      lineItems: [
        {
          id: "order-line-1",
          item_id: "item-1",
          variant_id: "variant-1",
          description_snapshot: "Product A",
          description: "Product A",
          quantity: "10.000",
          target_links: [
            {
              quantity: "6.000",
              type: "FULFILLMENT",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-14T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "DELIVERY_CHALLAN",
                },
                target_links: [
                  {
                    quantity: "2.000",
                    type: "RETURN",
                    target_line: {
                      document: {
                        posted_at: new Date("2026-03-15T00:00:00.000Z"),
                        status: "OPEN",
                        deleted_at: null,
                        type: "SALES_RETURN",
                      },
                    },
                  },
                ],
              },
            },
            {
              quantity: "3.000",
              type: "FULFILLMENT",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-14T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "SALES_INVOICE",
                },
                target_links: [],
              },
            },
            {
              quantity: "1.000",
              type: "FULFILLMENT",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-14T00:00:00.000Z"),
                  status: "VOID",
                  deleted_at: null,
                  type: "SALES_INVOICE",
                },
                target_links: [],
              },
            },
          ],
        },
      ],
    });

    const [balance] = await salesBalanceService.getShipmentLineBalances(
      tx as never,
      "tenant-1",
      "order-1",
    );

    expect(balance.fulfilledQuantity).toBe(9);
    expect(balance.shipmentConsumedQuantity).toBe(9);
    expect(balance.shipmentReturnedQuantity).toBe(2);
    expect(balance.shipmentRemainingQuantity).toBe(3);
    expect(balance.remainingQuantity).toBe(3);
  });

  it("reduces challan invoiceable quantity to zero without rounding drift", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "challan-1",
      type: "DELIVERY_CHALLAN",
      doc_number: "DC-0001",
      lineItems: [
        {
          id: "challan-line-1",
          item_id: "item-1",
          variant_id: "variant-1",
          description_snapshot: "Product A",
          description: "Product A",
          quantity: "10.000",
          target_links: [
            {
              quantity: "3.330",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
            {
              quantity: "3.330",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
            {
              quantity: "3.340",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
          ],
        },
      ],
    });

    const [balance] = await salesBalanceService.getInvoiceableLineBalances(
      tx as never,
      "tenant-1",
      "challan-1",
    );

    expect(balance.returnedQuantity).toBe(10);
    expect(balance.invoiceableQuantity).toBe(0);
    expect(balance.remainingQuantity).toBe(0);
  });

  it("ignores cancelled and void target documents in balance calculations", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-1",
      type: "SALES_INVOICE",
      doc_number: "INV-0001",
      lineItems: [
        {
          id: "invoice-line-1",
          item_id: "item-1",
          variant_id: "variant-1",
          description_snapshot: "Product A",
          description: "Product A",
          quantity: "10.000",
          target_links: [
            {
              quantity: "4.000",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "CANCELLED",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
            {
              quantity: "2.000",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "VOID",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
            {
              quantity: "3.000",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-15T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "SALES_RETURN",
                },
                target_links: [],
              },
            },
          ],
        },
      ],
    });

    const [balance] = await salesBalanceService.getLineBalances(
      tx as never,
      "tenant-1",
      "invoice-1",
      "RETURN",
    );

    expect(balance.returnedQuantity).toBe(3);
    expect(balance.returnableQuantity).toBe(7);
    expect(balance.remainingQuantity).toBe(7);
  });
});
