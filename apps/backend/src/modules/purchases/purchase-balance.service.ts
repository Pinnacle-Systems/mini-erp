import { NotFoundError } from "../../shared/utils/errors.js";
import type { PurchaseDocumentType, PurchaseTransactionClient } from "./purchases.types.js";

type BalanceMode = "FULFILLMENT" | "RETURN";

const ACTIVE_TARGET_STATUSES = new Set(["CANCELLED", "VOID"]);

const isActiveTargetDocument = (document: {
  posted_at: Date | null;
  status: string;
  deleted_at: Date | null;
}) => Boolean(document.posted_at) && !document.deleted_at && !ACTIVE_TARGET_STATUSES.has(document.status);

export type PurchaseLineBalance = {
  sourceDocumentId: string;
  sourceDocumentType: PurchaseDocumentType;
  sourceDocumentNumber: string;
  sourceLineId: string;
  itemId: string;
  variantId: string | null;
  description: string;
  unitPrice: number;
  taxRate: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
  originalQuantity: number;
  fulfilledQuantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
  returnableQuantity: number;
  receiptConsumedQuantity: number;
  receiptReturnedQuantity: number;
  receiptRemainingQuantity: number;
  invoiceableQuantity: number;
};

type ActiveDocumentRef = {
  posted_at: Date | null;
  status: string;
  deleted_at: Date | null;
  type: string;
};

type LoadedSourceLink = {
  quantity: unknown;
  type: "FULFILLMENT" | "RETURN";
  target_line: {
    document: ActiveDocumentRef;
    source_links: Array<{
      quantity: unknown;
      type: "FULFILLMENT" | "RETURN";
      target_line: {
        document: ActiveDocumentRef;
      };
    }>;
  };
};

const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const sumActiveReturnLinks = (links: LoadedSourceLink["target_line"]["source_links"]) =>
  links.reduce((sum, nestedLink) => {
    if (nestedLink.type !== "RETURN" || !isActiveTargetDocument(nestedLink.target_line.document)) {
      return sum;
    }

    return sum + Number(nestedLink.quantity);
  }, 0);

class PurchaseBalanceService {
  async getLineBalances(
    tx: PurchaseTransactionClient,
    tenantId: string,
    sourceDocumentId: string,
    mode: BalanceMode = "FULFILLMENT",
  ): Promise<PurchaseLineBalance[]> {
    const sourceDocument = await tx.document.findFirst({
      where: {
        id: sourceDocumentId,
        business_id: tenantId,
        deleted_at: null,
      },
      select: {
        id: true,
        type: true,
        doc_number: true,
        lineItems: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            item_id: true,
            variant_id: true,
            description_snapshot: true,
            description: true,
            unit_price: true,
            tax_rate: true,
            tax_mode_snapshot: true,
            unit_snapshot: true,
            quantity: true,
            source_links: {
              select: {
                quantity: true,
                type: true,
                target_line: {
                  select: {
                    document: {
                      select: {
                        posted_at: true,
                        status: true,
                        deleted_at: true,
                        type: true,
                      },
                    },
                    source_links: {
                      select: {
                        quantity: true,
                        type: true,
                        target_line: {
                          select: {
                            document: {
                              select: {
                                posted_at: true,
                                status: true,
                                deleted_at: true,
                                type: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sourceDocument) {
      throw new NotFoundError("Source document not found");
    }

    return sourceDocument.lineItems.map((line) => {
      let fulfilledQuantity = 0;
      let returnedQuantity = 0;
      let receiptConsumedQuantity = 0;
      let receiptReturnedQuantity = 0;

      for (const link of line.source_links) {
        if (!isActiveTargetDocument(link.target_line.document)) {
          continue;
        }

        const quantity = Number(link.quantity);
        if (link.type === "FULFILLMENT") {
          fulfilledQuantity += quantity;

          if (
            sourceDocument.type === "PURCHASE_ORDER" &&
            (link.target_line.document.type === "GOODS_RECEIPT_NOTE" ||
              link.target_line.document.type === "PURCHASE_INVOICE")
          ) {
            receiptConsumedQuantity += quantity;
            receiptReturnedQuantity += sumActiveReturnLinks(link.target_line.source_links);
          }
        } else if (link.type === "RETURN") {
          returnedQuantity += quantity;
        }
      }

      const originalQuantity = Number(line.quantity);
      const remainingQuantity =
        mode === "RETURN"
          ? originalQuantity - returnedQuantity
          : originalQuantity - fulfilledQuantity + returnedQuantity;
      const receiptRemainingQuantity =
        sourceDocument.type === "PURCHASE_ORDER"
          ? originalQuantity - receiptConsumedQuantity + receiptReturnedQuantity
          : remainingQuantity;
      const invoiceableQuantity =
        sourceDocument.type === "GOODS_RECEIPT_NOTE"
          ? originalQuantity - returnedQuantity
          : remainingQuantity;

      return {
        sourceDocumentId: sourceDocument.id,
        sourceDocumentType: sourceDocument.type as PurchaseDocumentType,
        sourceDocumentNumber: sourceDocument.doc_number,
        sourceLineId: line.id,
        itemId: line.item_id,
        variantId: line.variant_id ?? null,
        description: line.description_snapshot ?? line.description,
        unitPrice: Number(line.unit_price),
        taxRate: Number(line.tax_rate),
        taxMode: line.tax_mode_snapshot === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
        unit: line.unit_snapshot ?? "PCS",
        originalQuantity,
        fulfilledQuantity,
        returnedQuantity,
        remainingQuantity: roundQuantity(remainingQuantity),
        returnableQuantity: roundQuantity(originalQuantity - returnedQuantity),
        receiptConsumedQuantity: roundQuantity(receiptConsumedQuantity),
        receiptReturnedQuantity: roundQuantity(receiptReturnedQuantity),
        receiptRemainingQuantity: roundQuantity(receiptRemainingQuantity),
        invoiceableQuantity: roundQuantity(invoiceableQuantity),
      };
    });
  }

  async getReceiptLineBalances(
    tx: PurchaseTransactionClient,
    tenantId: string,
    sourceDocumentId: string,
  ): Promise<PurchaseLineBalance[]> {
    const balances = await this.getLineBalances(tx, tenantId, sourceDocumentId, "FULFILLMENT");
    return balances.map((balance) => ({
      ...balance,
      remainingQuantity: balance.receiptRemainingQuantity,
    }));
  }

  async getInvoiceableLineBalances(
    tx: PurchaseTransactionClient,
    tenantId: string,
    sourceDocumentId: string,
  ): Promise<PurchaseLineBalance[]> {
    const balances = await this.getLineBalances(tx, tenantId, sourceDocumentId, "FULFILLMENT");
    return balances.map((balance) => ({
      ...balance,
      remainingQuantity: balance.invoiceableQuantity,
    }));
  }
}

export const purchaseBalanceService = new PurchaseBalanceService();
