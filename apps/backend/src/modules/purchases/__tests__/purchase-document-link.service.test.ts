import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseBalanceService } from "../purchase-balance.service.js";
import { purchaseDocumentLinkService } from "../purchase-document-link.service.js";
import type { PurchaseLineBalance } from "../purchase-balance.service.js";
import { createPurchaseTxMock } from "./test-utils.js";

const makeLineBalance = (
  overrides: Partial<PurchaseLineBalance> & Pick<PurchaseLineBalance, "sourceLineId">,
): PurchaseLineBalance => {
  const { sourceLineId, ...restOverrides } = overrides;

  return {
    sourceDocumentId: "po-1",
    sourceDocumentType: "PURCHASE_ORDER",
    sourceDocumentNumber: "PO-0001",
    sourceLineId,
    itemId: "item-1",
    variantId: "variant-1",
    description: "Widget",
    unitPrice: 100,
    taxRate: 18,
    taxMode: "EXCLUSIVE",
    unit: "PCS",
    originalQuantity: 5,
    fulfilledQuantity: 0,
    returnedQuantity: 0,
    remainingQuantity: 5,
    returnableQuantity: 5,
    receiptConsumedQuantity: 0,
    receiptReturnedQuantity: 0,
    receiptRemainingQuantity: 5,
    invoiceableQuantity: 5,
    ...restOverrides,
  };
};

describe("purchaseDocumentLinkService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when the document has no parent", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "grn-1",
      type: "GOODS_RECEIPT_NOTE",
      parent_id: null,
      posted_at: new Date("2026-03-20T00:00:00.000Z"),
      lineItems: [],
    });

    await expect(
      purchaseDocumentLinkService.upsertLinksForDocument(tx as never, "tenant-1", "grn-1"),
    ).resolves.toBeUndefined();

    expect(tx.documentLineLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.documentLineLink.createMany).not.toHaveBeenCalled();
  });

  it("creates PO-linked GRN fulfillment links", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "grn-1") {
        return {
          id: "grn-1",
          type: "GOODS_RECEIPT_NOTE",
          parent_id: "po-1",
          posted_at: new Date("2026-03-20T00:00:00.000Z"),
          lineItems: [
            {
              id: "grn-line-1",
              variant_id: "variant-1",
              description_snapshot: "Widget",
              description: "Widget",
              quantity: "2.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "po-1",
        type: "PURCHASE_ORDER",
        posted_at: new Date("2026-03-19T00:00:00.000Z"),
        lineItems: [
          {
            id: "po-line-1",
            variant_id: "variant-1",
            description_snapshot: "Widget",
            description: "Widget",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(purchaseBalanceService, "getReceiptLineBalances").mockResolvedValue([
      makeLineBalance({
        sourceLineId: "po-line-1",
      }),
    ]);

    await purchaseDocumentLinkService.upsertLinksForDocument(
      tx as never,
      "tenant-1",
      "grn-1",
    );

    expect(tx.documentLineLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          source_line_id: "po-line-1",
          target_line_id: "grn-line-1",
          quantity: 2,
          type: "FULFILLMENT",
        },
      ],
    });
  });

  it("rejects invalid explicit source line ids", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "PURCHASE_INVOICE",
          parent_id: "grn-1",
          posted_at: new Date("2026-03-20T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Widget",
              description: "Widget",
              quantity: "2.000",
              unit_price: "100.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return {
        id: "grn-1",
        type: "GOODS_RECEIPT_NOTE",
        posted_at: new Date("2026-03-19T00:00:00.000Z"),
        lineItems: [
          {
            id: "grn-line-1",
            variant_id: "variant-1",
            description_snapshot: "Widget",
            description: "Widget",
            quantity: "5.000",
            unit_price: "100.00",
            tax_rate: "18.00",
          },
        ],
      };
    });
    vi.spyOn(purchaseBalanceService, "getInvoiceableLineBalances").mockResolvedValue([
      makeLineBalance({
        sourceDocumentId: "grn-1",
        sourceDocumentType: "GOODS_RECEIPT_NOTE",
        sourceDocumentNumber: "GRN-0001",
        sourceLineId: "grn-line-1",
      }),
    ]);

    await expect(
      purchaseDocumentLinkService.upsertLinksForDocument(tx as never, "tenant-1", "invoice-1", {
        "invoice-line-1": "missing-line",
      }),
    ).rejects.toThrow("Unable to link line Widget to the selected parent line");
  });
});
