import { describe, expect, it } from "vitest";
import { purchaseBalanceService } from "../purchase-balance.service.js";
import { createPurchaseTxMock } from "./test-utils.js";

describe("purchaseBalanceService", () => {
  it("restores receipt balance on orders when received quantity is returned", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "po-1",
      type: "PURCHASE_ORDER",
      doc_number: "PO-0001",
      lineItems: [
        {
          id: "po-line-1",
          item_id: "item-1",
          variant_id: "variant-1",
          description_snapshot: "Widget",
          description: "Widget",
          quantity: "10.000",
          unit_price: "100.00",
          tax_rate: "18.00",
          tax_mode_snapshot: "EXCLUSIVE",
          unit_snapshot: "PCS",
          source_links: [
            {
              quantity: "6.000",
              type: "FULFILLMENT",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-20T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "GOODS_RECEIPT_NOTE",
                },
                source_links: [
                  {
                    quantity: "2.000",
                    type: "RETURN",
                    target_line: {
                      document: {
                        posted_at: new Date("2026-03-21T00:00:00.000Z"),
                        status: "OPEN",
                        deleted_at: null,
                        type: "PURCHASE_RETURN",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const [balance] = await purchaseBalanceService.getReceiptLineBalances(
      tx as never,
      "tenant-1",
      "po-1",
    );

    expect(balance.fulfilledQuantity).toBe(6);
    expect(balance.receiptConsumedQuantity).toBe(6);
    expect(balance.receiptReturnedQuantity).toBe(2);
    expect(balance.receiptRemainingQuantity).toBe(6);
    expect(balance.remainingQuantity).toBe(6);
  });

  it("reduces GRN invoiceable quantity by active returns", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "grn-1",
      type: "GOODS_RECEIPT_NOTE",
      doc_number: "GRN-0001",
      lineItems: [
        {
          id: "grn-line-1",
          item_id: "item-1",
          variant_id: "variant-1",
          description_snapshot: "Widget",
          description: "Widget",
          quantity: "10.000",
          unit_price: "100.00",
          tax_rate: "18.00",
          tax_mode_snapshot: "EXCLUSIVE",
          unit_snapshot: "PCS",
          source_links: [
            {
              quantity: "3.000",
              type: "RETURN",
              target_line: {
                document: {
                  posted_at: new Date("2026-03-21T00:00:00.000Z"),
                  status: "OPEN",
                  deleted_at: null,
                  type: "PURCHASE_RETURN",
                },
                source_links: [],
              },
            },
          ],
        },
      ],
    });

    const [balance] = await purchaseBalanceService.getInvoiceableLineBalances(
      tx as never,
      "tenant-1",
      "grn-1",
    );

    expect(balance.returnedQuantity).toBe(3);
    expect(balance.invoiceableQuantity).toBe(7);
    expect(balance.remainingQuantity).toBe(7);
  });
});
