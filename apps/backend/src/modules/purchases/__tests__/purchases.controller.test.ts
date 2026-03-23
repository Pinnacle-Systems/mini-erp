import { afterEach, describe, expect, it, vi } from "vitest";
import tenantService from "../../tenant/tenant.service.js";
import accountsService from "../../accounts/accounts.service.js";
import { purchaseDocumentLinkService } from "../purchase-document-link.service.js";
import { purchaseStockPostingService } from "../purchase-stock-posting.service.js";
import {
  assertPurchaseAccess,
  getPurchaseCapabilityRequired,
  getSuggestedPurchaseDocumentNumber,
  postDraftPurchaseDocument,
  saveDraftPurchaseDocument,
  transitionPurchaseDocumentState,
} from "../purchases.controller.js";
import { createPurchaseTxMock } from "./test-utils.js";

describe("purchases.controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps purchase returns to the return capability", () => {
    expect(getPurchaseCapabilityRequired("PURCHASE_RETURN")).toBe("TXN_PURCHASE_RETURN");
    expect(getPurchaseCapabilityRequired("PURCHASE_ORDER")).toBe("TXN_PURCHASE_CREATE");
    expect(getPurchaseCapabilityRequired("GOODS_RECEIPT_NOTE")).toBe("TXN_PURCHASE_CREATE");
    expect(getPurchaseCapabilityRequired("PURCHASE_INVOICE")).toBe("TXN_PURCHASE_CREATE");
  });

  it("rejects access when the user is not a business member", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_ORDER", {
        validateMembership: vi.fn().mockResolvedValue(null),
        getCapabilities: vi.fn(),
      } as never),
    ).rejects.toThrow("Access denied");
  });

  it("rejects access when supplier capability is missing", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_ORDER", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi.fn().mockResolvedValue(["TXN_PURCHASE_CREATE"]),
      } as never),
    ).rejects.toThrow("purchase order workflow is not enabled for this store license");
  });

  it("rejects returns when return capability is missing", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_RETURN", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi
          .fn()
          .mockResolvedValue(["PARTIES_SUPPLIERS", "TXN_PURCHASE_CREATE"]),
      } as never),
    ).rejects.toThrow("purchase return workflow is not enabled for this store license");
  });

  it("allows access when supplier and document capabilities are both present", async () => {
    await expect(
      assertPurchaseAccess("user-1", "tenant-1", "PURCHASE_INVOICE", {
        validateMembership: vi.fn().mockResolvedValue({ id: "member-1" }),
        getCapabilities: vi
          .fn()
          .mockResolvedValue(["PARTIES_SUPPLIERS", "TXN_PURCHASE_CREATE"]),
      } as never),
    ).resolves.toBeUndefined();
  });

  it("suggests the next purchase document number from existing rows", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findMany.mockResolvedValue([{ doc_number: "PO-0002" }, { doc_number: "PO-0008" }]);

    await expect(
      getSuggestedPurchaseDocumentNumber(tx as never, "tenant-1", "PURCHASE_ORDER"),
    ).resolves.toBe("PO-0009");
  });

  it("creates a purchase draft with shared party snapshot and settlement mode", async () => {
    const tx = createPurchaseTxMock();
    vi.spyOn(tenantService, "validateBusinessLocation").mockResolvedValue({
      id: "loc-1",
      name: "Main Store",
    } as never);
    vi.spyOn(tenantService, "getDefaultBusinessLocation").mockResolvedValue({
      id: "loc-1",
      name: "Main Store",
      is_default: true,
    } as never);

    tx.document.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "po-1",
        type: "PURCHASE_INVOICE",
        parent_id: null,
        posted_at: null,
        lineItems: [
          {
            id: "line-1",
            variant_id: "variant-1",
            description_snapshot: "Primary line",
            description: "Primary line",
            quantity: "2.000",
            unit_price: "50.00",
            tax_rate: "18.00",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "po-1",
        business_id: "tenant-1",
        type: "PURCHASE_INVOICE",
        status: "DRAFT",
        cancel_reason: null,
        settlement_mode: "CREDIT",
        doc_number: "PINV-0001",
        created_at: new Date("2026-03-20T00:00:00.000Z"),
        updated_at: new Date("2026-03-20T00:00:00.000Z"),
        posted_at: null,
        deleted_at: null,
        valid_until: null,
        dispatch_date: null,
        dispatch_carrier: null,
        dispatch_reference: null,
        location_id: "loc-1",
        location_name_snapshot: "Main Store",
        party_id: "supplier-1",
        party_snapshot: {
          role: "supplier",
          name: "Supply Co",
          phone: "999",
          address: "Warehouse Road",
          taxId: "GSTIN-1",
        },
        parent_id: null,
        currency: "INR",
        sub_total: 100,
        tax_total: 18,
        grand_total: 118,
        notes: null,
        shipping_addr: null,
        children: [],
        lineItems: [
          {
            id: "line-1",
            target_links: [],
            variant_id: "variant-1",
            description: "Primary line",
            description_snapshot: "Primary line",
            quantity: 2,
            unit_price: 50,
            tax_rate: 18,
            tax_mode_snapshot: "EXCLUSIVE",
            unit_snapshot: "PCS",
          },
        ],
      });
    tx.party.findFirst.mockResolvedValue({
      id: "supplier-1",
      name: "Supply Co",
      phone: "999",
      address: "Warehouse Road",
      tax_id: "GSTIN-1",
    });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-1",
        item_id: "item-1",
        sku: "SKU-1",
        barcode: "BAR-1",
        name: "Blue",
        option_values: [],
        item: {
          name: "Widget",
          hsn_sac: "1001",
          unit: "PCS",
        },
      },
    ]);
    tx.document.create.mockResolvedValue({ id: "po-1" });
    tx.lineItem.createMany.mockResolvedValue({ count: 1 });
    tx.documentHistory.create.mockResolvedValue(undefined);

    const document = await saveDraftPurchaseDocument(
      tx as never,
      null,
      {
        tenantId: "tenant-1",
        documentType: "PURCHASE_INVOICE",
        billNumber: "PINV-0001",
        settlementMode: "CREDIT",
        supplierId: "supplier-1",
        supplierName: "",
        supplierPhone: "",
        supplierAddress: "",
        supplierTaxId: "",
        notes: "",
        lines: [
          {
            id: "line-1",
            variantId: "variant-1",
            description: "Primary line",
            quantity: "2",
            unitPrice: "50",
            taxRate: "18%",
            taxMode: "EXCLUSIVE",
            unit: "PCS",
          },
        ],
      },
      {
        userId: "user-1",
        name: "Buyer",
      },
    );

    expect(tx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlement_mode: "CREDIT",
          party_id: "supplier-1",
          party_snapshot: {
            role: "supplier",
            name: "Supply Co",
            phone: "999",
            address: "Warehouse Road",
            taxId: "GSTIN-1",
          },
        }),
      }),
    );
    expect(tx.documentLineLink.deleteMany).not.toHaveBeenCalled();
    expect(document.id).toBe("po-1");
  });

  it("rejects purchase returns without a posted source document", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "invoice-1",
        type: "PURCHASE_INVOICE",
        location_id: "loc-1",
        posted_at: null,
      });

    await expect(
      saveDraftPurchaseDocument(
        tx as never,
        null,
        {
          tenantId: "tenant-1",
          documentType: "PURCHASE_RETURN",
          parentId: "invoice-1",
          billNumber: "PRTN-0001",
          supplierId: "supplier-1",
          supplierName: "",
          supplierPhone: "",
          supplierAddress: "",
          supplierTaxId: "",
          notes: "",
          lines: [
            {
              id: "line-1",
              sourceLineId: "invoice-line-1",
              variantId: "variant-1",
              description: "Returned item",
              quantity: "1",
              unitPrice: "50",
              taxRate: "18%",
              taxMode: "EXCLUSIVE",
              unit: "PCS",
            },
          ],
        },
        {
          userId: "user-1",
          name: "Buyer",
        },
      ),
    ).rejects.toThrow("Purchase return must reference a posted purchase invoice or goods receipt note");
  });

  it("defaults purchase return location from the posted parent document", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockImplementation(async (args: any) => {
      const { where, include } = args;
      if (where.doc_number === "PRTN-0001") {
        return null;
      }

      if (where.id === "invoice-1") {
        return {
          id: "invoice-1",
          type: "PURCHASE_INVOICE",
          location_id: "loc-1",
          posted_at: new Date("2026-03-20T00:00:00.000Z"),
          lineItems: [
            {
              id: "invoice-line-1",
              variant_id: "variant-1",
              description_snapshot: "Returned item",
              description: "Returned item",
              quantity: "2.000",
              unit_price: "50.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      if (where.id === "return-1" && include) {
        return {
          id: "return-1",
          business_id: "tenant-1",
          type: "PURCHASE_RETURN",
          status: "DRAFT",
          cancel_reason: null,
          settlement_mode: null,
          doc_number: "PRTN-0001",
          created_at: new Date("2026-03-20T00:00:00.000Z"),
          updated_at: new Date("2026-03-20T00:00:00.000Z"),
          posted_at: null,
          deleted_at: null,
          valid_until: null,
          dispatch_date: null,
          dispatch_carrier: null,
          dispatch_reference: null,
          location_id: "loc-1",
          location_name_snapshot: "Main Store",
          party_id: "supplier-1",
          party_snapshot: {
            role: "supplier",
            name: "Supply Co",
            phone: "999",
            address: "Warehouse Road",
            taxId: "GSTIN-1",
          },
          parent_id: "invoice-1",
          currency: "INR",
          sub_total: 50,
          tax_total: 9,
          grand_total: 59,
          notes: null,
          shipping_addr: null,
          children: [],
          lineItems: [
            {
              id: "line-1",
              target_links: [],
              variant_id: "variant-1",
              description: "Returned item",
              description_snapshot: "Returned item",
              quantity: 1,
              unit_price: 50,
              tax_rate: 18,
              tax_mode_snapshot: "EXCLUSIVE",
              unit_snapshot: "PCS",
            },
          ],
        };
      }

      if (where.id === "return-1") {
        return {
          id: "return-1",
          type: "PURCHASE_RETURN",
          parent_id: "invoice-1",
          posted_at: null,
          lineItems: [
            {
              id: "line-1",
              variant_id: "variant-1",
              description_snapshot: "Returned item",
              description: "Returned item",
              quantity: "1.000",
              unit_price: "50.00",
              tax_rate: "18.00",
            },
          ],
        };
      }

      return null;
    });
    vi.spyOn(tenantService, "validateBusinessLocation").mockResolvedValue({
      id: "loc-1",
      name: "Main Store",
    } as never);
    vi.spyOn(tenantService, "getDefaultBusinessLocation").mockResolvedValue({
      id: "fallback-loc",
      name: "Fallback",
      is_default: true,
    } as never);
    vi.spyOn(purchaseDocumentLinkService, "upsertLinksForDocument").mockResolvedValue(undefined);
    tx.party.findFirst.mockResolvedValue({
      id: "supplier-1",
      name: "Supply Co",
      phone: "999",
      address: "Warehouse Road",
      tax_id: "GSTIN-1",
    });
    tx.itemVariant.findMany.mockResolvedValue([
      {
        id: "variant-1",
        item_id: "item-1",
        sku: "SKU-1",
        barcode: "BAR-1",
        name: "Blue",
        option_values: [],
        item: {
          name: "Widget",
          hsn_sac: "1001",
          unit: "PCS",
        },
      },
    ]);
    tx.document.create.mockResolvedValue({ id: "return-1" });
    tx.lineItem.createMany.mockResolvedValue({ count: 1 });
    tx.documentHistory.create.mockResolvedValue(undefined);

    await saveDraftPurchaseDocument(
      tx as never,
      null,
      {
        tenantId: "tenant-1",
        documentType: "PURCHASE_RETURN",
        parentId: "invoice-1",
        billNumber: "PRTN-0001",
        supplierId: "supplier-1",
        supplierName: "",
        supplierPhone: "",
        supplierAddress: "",
        supplierTaxId: "",
        notes: "",
        lines: [
          {
            id: "line-1",
            sourceLineId: "invoice-line-1",
            variantId: "variant-1",
            description: "Returned item",
            quantity: "1",
            unitPrice: "50",
            taxRate: "18%",
            taxMode: "EXCLUSIVE",
            unit: "PCS",
          },
        ],
      },
      {
        userId: "user-1",
        name: "Buyer",
      },
    );

    expect(tx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          location_id: "loc-1",
        }),
      }),
    );
  });

  it("requires supplier details before posting", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "grn-1",
      business_id: "tenant-1",
      type: "GOODS_RECEIPT_NOTE",
      status: "DRAFT",
      cancel_reason: null,
      settlement_mode: null,
      doc_number: "GRN-0001",
      created_at: new Date("2026-03-20T00:00:00.000Z"),
      updated_at: new Date("2026-03-20T00:00:00.000Z"),
      posted_at: null,
      deleted_at: null,
      valid_until: null,
      dispatch_date: null,
      dispatch_carrier: null,
      dispatch_reference: null,
      location_id: "loc-1",
      location_name_snapshot: "Main Store",
      party_id: null,
      party_snapshot: null,
      parent_id: null,
      currency: "INR",
      sub_total: 100,
      tax_total: 18,
      grand_total: 118,
      notes: null,
      shipping_addr: null,
      children: [],
      lineItems: [
        {
          id: "line-1",
          target_links: [],
        },
      ],
    });

    await expect(
      postDraftPurchaseDocument(
        tx as never,
        "tenant-1",
        "GOODS_RECEIPT_NOTE",
        "grn-1",
        {
          userId: "user-1",
          name: "Buyer",
        },
      ),
    ).rejects.toThrow("goods receipt note requires supplier details");
  });

  it("blocks VOID for posted purchase documents", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-1",
      business_id: "tenant-1",
      type: "PURCHASE_INVOICE",
      status: "OPEN",
      posted_at: new Date("2026-03-20T00:00:00.000Z"),
      deleted_at: null,
      cancel_reason: null,
      settlement_mode: "CASH",
      doc_number: "PINV-0001",
      parent_id: null,
      party_snapshot: {
        role: "supplier",
        name: "Supply Co",
        phone: null,
        address: null,
        taxId: null,
      },
      children: [],
      lineItems: [],
    });

    await expect(
      transitionPurchaseDocumentState(
        tx as never,
        "tenant-1",
        "PURCHASE_INVOICE",
        "invoice-1",
        "VOID",
        {
          userId: "user-1",
          name: "Buyer",
        },
      ),
    ).rejects.toThrow("Posted purchase invoices cannot be voided");
  });

  it("records a linked payment when posting a cash purchase invoice", async () => {
    const tx = createPurchaseTxMock();
    const postedAt = new Date("2026-03-23T10:45:00.000Z");

    tx.document.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        business_id: "tenant-1",
        type: "PURCHASE_INVOICE",
        status: "DRAFT",
        posted_at: null,
        deleted_at: null,
        cancel_reason: null,
        settlement_mode: "CASH",
        doc_number: "PINV-0001",
        parent_id: null,
        grand_total: 118,
        party_id: "supplier-1",
        party_snapshot: {
          role: "supplier",
          name: "Supply Co",
          phone: "999",
          address: "Warehouse Road",
          taxId: "GSTIN-1",
        },
        children: [],
        lineItems: [
          {
            id: "line-1",
            target_links: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "invoice-1",
        business_id: "tenant-1",
        type: "PURCHASE_INVOICE",
        status: "OPEN",
        posted_at: postedAt,
        deleted_at: null,
        cancel_reason: null,
        settlement_mode: "CASH",
        doc_number: "PINV-0001",
        parent_id: null,
        grand_total: 118,
        party_id: "supplier-1",
        party_snapshot: {
          role: "supplier",
          name: "Supply Co",
          phone: "999",
          address: "Warehouse Road",
          taxId: "GSTIN-1",
        },
        children: [],
        lineItems: [
          {
            id: "line-1",
            target_links: [],
          },
        ],
      });

    vi.spyOn(purchaseDocumentLinkService, "upsertLinksForDocument").mockResolvedValue();
    vi.spyOn(purchaseStockPostingService, "applyPostingEffects").mockResolvedValue();
    const createMadePaymentSpy = vi
      .spyOn(accountsService, "createMadePayment")
      .mockResolvedValue({
        id: "movement-1",
        reference_no: null,
        occurred_at: postedAt,
      } as never);

    await expect(
      postDraftPurchaseDocument(
        tx as never,
        "tenant-1",
        "PURCHASE_INVOICE",
        "invoice-1",
        {
          userId: "user-1",
          name: "Buyer",
        },
        {
          financialAccountId: "account-1",
        },
      ),
    ).resolves.toMatchObject({
      id: "invoice-1",
      status: "OPEN",
    });

    expect(createMadePaymentSpy).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        amount: 118,
        financialAccountId: "account-1",
        allocations: [
          {
            documentType: "PURCHASE_INVOICE",
            documentId: "invoice-1",
            allocatedAmount: 118,
          },
        ],
      }),
      tx,
    );
  });

  it("blocks reopening a cancelled purchase invoice while linked payments remain posted", async () => {
    const tx = createPurchaseTxMock();
    tx.document.findFirst.mockResolvedValue({
      id: "invoice-1",
      business_id: "tenant-1",
      type: "PURCHASE_INVOICE",
      status: "CANCELLED",
      posted_at: new Date("2026-03-20T00:00:00.000Z"),
      deleted_at: null,
      cancel_reason: "OTHER",
      settlement_mode: "CASH",
      doc_number: "PINV-0001",
      parent_id: null,
      party_snapshot: {
        role: "supplier",
        name: "Supply Co",
        phone: null,
        address: null,
        taxId: null,
      },
      children: [],
      lineItems: [],
    });

    vi.spyOn(accountsService, "listPostedMoneyMovementsForSourceDocument").mockResolvedValue([
      {
        id: "movement-1",
        referenceNo: "",
        notes: "",
        occurredAt: "2026-03-20T00:00:00.000Z",
      },
    ]);

    await expect(
      transitionPurchaseDocumentState(
        tx as never,
        "tenant-1",
        "PURCHASE_INVOICE",
        "invoice-1",
        "REOPEN",
        {
          userId: "user-1",
          name: "Buyer",
        },
      ),
    ).rejects.toThrow(
      "This purchase invoice cannot be reopened while linked payments remain posted",
    );
  });
});
