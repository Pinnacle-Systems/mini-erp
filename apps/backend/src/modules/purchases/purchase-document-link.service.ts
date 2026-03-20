import { BadRequestError } from "../../shared/utils/errors.js";
import { purchaseBalanceService } from "./purchase-balance.service.js";
import type { PurchaseDocumentType, PurchaseTransactionClient } from "./purchases.types.js";

type LinkType = "FULFILLMENT" | "RETURN";

const SUPPORTED_LINK_RULES: Record<string, LinkType> = {
  "PURCHASE_ORDER:GOODS_RECEIPT_NOTE": "FULFILLMENT",
  "PURCHASE_ORDER:PURCHASE_INVOICE": "FULFILLMENT",
  "GOODS_RECEIPT_NOTE:PURCHASE_INVOICE": "FULFILLMENT",
  "GOODS_RECEIPT_NOTE:PURCHASE_RETURN": "RETURN",
  "PURCHASE_INVOICE:PURCHASE_RETURN": "RETURN",
};

const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const buildLineSignature = (line: {
  variant_id: string | null;
  description_snapshot: string | null;
  description: string;
  unit_price: unknown;
  tax_rate: unknown;
}) =>
  [
    line.variant_id ?? "",
    (line.description_snapshot ?? line.description).trim().toLowerCase(),
    Number(line.unit_price).toFixed(2),
    Number(line.tax_rate).toFixed(2),
  ].join("|");

class PurchaseDocumentLinkService {
  async upsertLinksForDocument(
    tx: PurchaseTransactionClient,
    tenantId: string,
    documentId: string,
    sourceLineIdByTargetLineId?: Record<string, string | null | undefined>,
  ): Promise<void> {
    const document = await tx.document.findFirst({
      where: {
        id: documentId,
        business_id: tenantId,
        deleted_at: null,
      },
      select: {
        id: true,
        type: true,
        parent_id: true,
        posted_at: true,
        lineItems: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            variant_id: true,
            description_snapshot: true,
            description: true,
            quantity: true,
            unit_price: true,
            tax_rate: true,
          },
        },
      },
    });

    if (!document?.parent_id) {
      return;
    }

    const parent = await tx.document.findFirst({
      where: {
        id: document.parent_id,
        business_id: tenantId,
        deleted_at: null,
      },
      select: {
        id: true,
        type: true,
        posted_at: true,
        lineItems: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            variant_id: true,
            description_snapshot: true,
            description: true,
            quantity: true,
            unit_price: true,
            tax_rate: true,
          },
        },
      },
    });

    if (!parent) {
      throw new BadRequestError("Selected source document is no longer available");
    }
    if (!parent.posted_at) {
      throw new BadRequestError("Source document must be posted before conversion can be posted");
    }

    const ruleKey = `${parent.type}:${document.type}`;
    const linkType = SUPPORTED_LINK_RULES[ruleKey];
    if (!linkType) {
      throw new BadRequestError("This document conversion does not support line-level linking");
    }

    const balances =
      linkType === "RETURN"
        ? await purchaseBalanceService.getLineBalances(tx, tenantId, parent.id, "RETURN")
        : parent.type === "PURCHASE_ORDER"
          ? await purchaseBalanceService.getReceiptLineBalances(tx, tenantId, parent.id)
          : parent.type === "GOODS_RECEIPT_NOTE"
            ? await purchaseBalanceService.getInvoiceableLineBalances(tx, tenantId, parent.id)
            : await purchaseBalanceService.getLineBalances(tx, tenantId, parent.id, "FULFILLMENT");
    const remainingBySourceLineId = new Map(
      balances.map((balance) => [
        balance.sourceLineId,
        roundQuantity(
          linkType === "RETURN" ? balance.returnableQuantity : balance.remainingQuantity,
        ),
      ]),
    );
    const sourceLinesByVariantId = new Map<string, typeof parent.lineItems>();

    for (const line of parent.lineItems) {
      const variantKey = line.variant_id ?? "__null__";
      const existing = sourceLinesByVariantId.get(variantKey) ?? [];
      existing.push(line);
      sourceLinesByVariantId.set(variantKey, existing);
    }
    const usesExplicitSourceLineIds = sourceLineIdByTargetLineId !== undefined;
    const parentSourceLineIds = new Set(parent.lineItems.map((line) => line.id));

    const linksToCreate: Array<{
      source_line_id: string;
      target_line_id: string;
      quantity: number;
      type: LinkType;
    }> = [];

    for (const childLine of document.lineItems) {
      let quantityToAllocate = roundQuantity(Number(childLine.quantity));
      if (quantityToAllocate <= 0) {
        continue;
      }

      const hintedSourceLineId = sourceLineIdByTargetLineId?.[childLine.id] ?? null;
      if (usesExplicitSourceLineIds && !hintedSourceLineId) {
        continue;
      }
      if (hintedSourceLineId && !parentSourceLineIds.has(hintedSourceLineId)) {
        throw new BadRequestError(
          `Unable to link line ${(childLine.description_snapshot ?? childLine.description).trim()} to the selected parent line`,
        );
      }

      const variantKey = childLine.variant_id ?? "__null__";
      const candidatePool = sourceLinesByVariantId.get(variantKey) ?? [];
      const childSignature = buildLineSignature(childLine);
      const orderedCandidates = hintedSourceLineId
        ? candidatePool.filter((candidate) => candidate.id === hintedSourceLineId)
        : [...candidatePool].sort((left, right) => {
            const leftExact = buildLineSignature(left) === childSignature ? 0 : 1;
            const rightExact = buildLineSignature(right) === childSignature ? 0 : 1;
            if (leftExact !== rightExact) {
              return leftExact - rightExact;
            }
            return left.id.localeCompare(right.id);
          });

      if (hintedSourceLineId && orderedCandidates.length === 0) {
        throw new BadRequestError(
          `Unable to link line ${(childLine.description_snapshot ?? childLine.description).trim()} to the selected source line`,
        );
      }

      for (const sourceLine of orderedCandidates) {
        const available = remainingBySourceLineId.get(sourceLine.id) ?? 0;
        if (available <= 0 || quantityToAllocate <= 0) {
          continue;
        }

        const allocatedQuantity = roundQuantity(Math.min(available, quantityToAllocate));
        if (allocatedQuantity <= 0) {
          continue;
        }

        linksToCreate.push({
          source_line_id: sourceLine.id,
          target_line_id: childLine.id,
          quantity: allocatedQuantity,
          type: linkType,
        });
        remainingBySourceLineId.set(sourceLine.id, roundQuantity(available - allocatedQuantity));
        quantityToAllocate = roundQuantity(quantityToAllocate - allocatedQuantity);

        if (usesExplicitSourceLineIds) {
          break;
        }
      }

      if (quantityToAllocate > 0) {
        const sourceLabel =
          linkType === "RETURN" ? "returnable quantity" : "remaining quantity";
        throw new BadRequestError(
          `Converted quantity exceeds available ${sourceLabel} for line ${(childLine.description_snapshot ?? childLine.description).trim()}`,
        );
      }
    }

    if (document.lineItems.length > 0) {
      await tx.documentLineLink.deleteMany({
        where: {
          target_line_id: {
            in: document.lineItems.map((line) => line.id),
          },
        },
      });
    }

    if (linksToCreate.length > 0) {
      await tx.documentLineLink.createMany({
        data: linksToCreate,
      });
    }
  }
}

export const purchaseDocumentLinkService = new PurchaseDocumentLinkService();
