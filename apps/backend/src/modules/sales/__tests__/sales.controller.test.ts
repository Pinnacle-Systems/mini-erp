import { describe, expect, it, vi } from "vitest";
import { documentLinkService } from "../document-link.service.js";
import { postDraftDocument, transitionDocumentState } from "../sales.controller.js";
import { stockPostingService } from "../stock-posting.service.js";
import { createSalesTxMock } from "./test-utils.js";

describe("sales.controller transitionDocumentState", () => {
  it("blocks VOID for posted documents", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-1",
      business_id: "tenant-1",
      type: "SALES_INVOICE",
      status: "OPEN",
      posted_at: new Date("2026-03-14T00:00:00.000Z"),
      deleted_at: null,
      cancel_reason: null,
      doc_number: "INV-0001",
      parent_id: null,
      children: [],
      lineItems: [],
    });

    await expect(
      transitionDocumentState(
        tx as never,
        "tenant-1",
        "SALES_INVOICE",
        "invoice-1",
        "VOID",
        {
          userId: "user-1",
          name: "Test User",
        },
      ),
    ).rejects.toThrow("Posted invoices cannot be voided");

    expect(tx.document.update).not.toHaveBeenCalled();
  });

  it("still allows VOID checks for unposted open documents to proceed past the policy guard", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "estimate-1",
        business_id: "tenant-1",
        type: "SALES_ESTIMATE",
        status: "OPEN",
        posted_at: null,
        deleted_at: null,
        cancel_reason: null,
        doc_number: "EST-0001",
        parent_id: null,
        children: [],
        lineItems: [],
      })
      .mockResolvedValueOnce({
        id: "estimate-1",
        business_id: "tenant-1",
        type: "SALES_ESTIMATE",
        status: "VOID",
        posted_at: null,
        deleted_at: null,
        cancel_reason: null,
        doc_number: "EST-0001",
        parent_id: null,
        children: [],
        lineItems: [],
      });
    tx.document.update = vi.fn().mockResolvedValue(undefined);

    await transitionDocumentState(
      tx as never,
      "tenant-1",
      "SALES_ESTIMATE",
      "estimate-1",
      "VOID",
      {
        userId: "user-1",
        name: "Test User",
      },
    );

    expect(tx.document.update).toHaveBeenCalledWith({
      where: { id: "estimate-1" },
      data: {
        status: "VOID",
        cancel_reason: null,
      },
    });
  });

  it("posts mixed-origin drafts using explicit sourceLineId state instead of inferred matching", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "challan-1") {
        return {
          id: "challan-1",
          business_id: "tenant-1",
          type: "DELIVERY_CHALLAN",
          status: where.type === "DELIVERY_CHALLAN" ? "DRAFT" : "OPEN",
          posted_at: where.type === "DELIVERY_CHALLAN" ? null : new Date("2026-03-14T00:00:01.000Z"),
          deleted_at: null,
          cancel_reason: null,
          doc_number: "DC-0001",
          parent_id: "order-1",
          party_snapshot: {
            role: "customer",
            name: "Customer",
            phone: null,
            address: null,
            taxId: null,
          },
          settlement_mode: "CASH",
          grand_total: "100.00",
          children: [],
          lineItems: [
            {
              id: "line-ad-hoc",
              target_links: [],
            },
          ],
        };
      }

      if (where.id === "order-1") {
        return {
          id: "order-1",
          business_id: "tenant-1",
          type: "SALES_ORDER",
          status: "PARTIAL",
          posted_at: new Date("2026-03-14T00:00:00.000Z"),
          deleted_at: null,
          cancel_reason: null,
          doc_number: "SO-0001",
          parent_id: null,
          party_snapshot: null,
          settlement_mode: null,
          grand_total: "100.00",
          children: [],
          lineItems: [],
        };
      }

      return null;
    });
    tx.document.update = vi.fn().mockResolvedValue(undefined);
    tx.documentHistory.create = vi.fn().mockResolvedValue(undefined);

    const upsertSpy = vi
      .spyOn(documentLinkService, "upsertLinksForDocument")
      .mockResolvedValue(undefined);
    const stockSpy = vi
      .spyOn(stockPostingService, "applyPostingEffects")
      .mockResolvedValue(undefined);

    await postDraftDocument(
      tx as never,
      "tenant-1",
      "DELIVERY_CHALLAN",
      "challan-1",
      {
        userId: "user-1",
        name: "Test User",
      },
    );

    expect(upsertSpy).toHaveBeenCalledWith(
      tx,
      "tenant-1",
      "challan-1",
      { "line-ad-hoc": null },
    );
    expect(stockSpy).toHaveBeenCalledWith(tx, "tenant-1", "challan-1");

    upsertSpy.mockRestore();
    stockSpy.mockRestore();
  });

  it("requires customer details from party_snapshot for non-invoice drafts before posting", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "challan-1",
      business_id: "tenant-1",
      type: "DELIVERY_CHALLAN",
      status: "DRAFT",
      posted_at: null,
      deleted_at: null,
      cancel_reason: null,
      doc_number: "DC-0002",
      parent_id: null,
      party_snapshot: null,
      settlement_mode: null,
      children: [],
      lineItems: [
        {
          id: "line-1",
          target_links: [],
        },
      ],
    });

    await expect(
      postDraftDocument(
        tx as never,
        "tenant-1",
        "DELIVERY_CHALLAN",
        "challan-1",
        {
          userId: "user-1",
          name: "Test User",
        },
      ),
    ).rejects.toThrow("delivery challan requires customer details");
  });

  it("requires an existing customer for credit invoices using settlement_mode", async () => {
    const tx = createSalesTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-2",
      business_id: "tenant-1",
      type: "SALES_INVOICE",
      status: "DRAFT",
      posted_at: null,
      deleted_at: null,
      cancel_reason: null,
      doc_number: "INV-0002",
      parent_id: null,
      party_id: null,
      party_snapshot: {
        role: "customer",
        name: "Walk-in",
        phone: null,
        address: null,
        taxId: null,
      },
      settlement_mode: "CREDIT",
      children: [],
      lineItems: [
        {
          id: "line-1",
          target_links: [],
        },
      ],
    });

    await expect(
      postDraftDocument(
        tx as never,
        "tenant-1",
        "SALES_INVOICE",
        "invoice-2",
        {
          userId: "user-1",
          name: "Test User",
        },
      ),
    ).rejects.toThrow("invoice requires an existing customer for credit transactions");
  });
});
