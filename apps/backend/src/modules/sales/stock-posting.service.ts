import { BadRequestError } from "../../shared/utils/errors.js";
import { inventoryResponsibilityService } from "./inventory-responsibility.service.js";
import type { SalesDocumentType, SalesTransactionClient } from "./sales.types.js";

const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const isNegativeStockAllowed = () =>
  process.env.ALLOW_NEGATIVE_STOCK?.trim().toLowerCase() === "true";

const getPostingReason = (documentType: SalesDocumentType) => {
  if (documentType === "DELIVERY_CHALLAN") {
    return "SALE_DELIVERY_CHALLAN_POST";
  }
  if (documentType === "SALES_RETURN") {
    return "SALE_RETURN_POST";
  }
  return "SALE_INVOICE_POST";
};

class StockPostingService {
  async applyPostingEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    documentId: string,
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
        location_id: true,
        lineItems: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            variant_id: true,
            quantity: true,
            description_snapshot: true,
            description: true,
          },
        },
      },
    });

    if (!document) {
      throw new BadRequestError("Document not found for stock posting");
    }

    let parentType: SalesDocumentType | null = null;
    if (document.parent_id) {
      const parent = await tx.document.findFirst({
        where: {
          id: document.parent_id,
          business_id: tenantId,
          deleted_at: null,
        },
        select: {
          type: true,
        },
      });

      parentType = (parent?.type as SalesDocumentType | undefined) ?? null;
    }

    const responsibility = inventoryResponsibilityService.resolve(
      document.type as SalesDocumentType,
      parentType,
    );
    if (responsibility.effect === "NONE") {
      return;
    }

    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting sales documents require a business location");
    }

    const variantIds = [
      ...new Set(
        document.lineItems
          .map((line) => line.variant_id)
          .filter((variantId): variantId is string => Boolean(variantId)),
      ),
    ];

    if (variantIds.length === 0) {
      return;
    }

    const variants = await tx.itemVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
        business_id: tenantId,
        deleted_at: null,
        item: {
          deleted_at: null,
        },
      },
      select: {
        id: true,
        item: {
          select: {
            item_type: true,
          },
        },
      },
    });

    const variantTypeById = new Map(
      variants.map((variant) => [variant.id, variant.item.item_type as "PRODUCT" | "SERVICE"] as const),
    );

    if (variants.length !== variantIds.length) {
      throw new BadRequestError("One or more selected items are no longer available");
    }

    const productLines = document.lineItems.filter(
      (line) =>
        line.variant_id &&
        variantTypeById.get(line.variant_id) === "PRODUCT" &&
        roundQuantity(Number(line.quantity)) > 0,
    );

    if (productLines.length === 0) {
      return;
    }

    if (responsibility.effect === "DEDUCT" && !isNegativeStockAllowed()) {
      const requestedByVariantId = new Map<string, number>();
      for (const line of productLines) {
        const variantId = line.variant_id as string;
        requestedByVariantId.set(
          variantId,
          roundQuantity((requestedByVariantId.get(variantId) ?? 0) + Number(line.quantity)),
        );
      }

      const ledgerEntries = await tx.stockLedger.findMany({
        where: {
          business_id: tenantId,
          location_id: document.location_id,
          variant_id: {
            in: [...requestedByVariantId.keys()],
          },
          deleted_at: null,
        },
        select: {
          variant_id: true,
          quantity: true,
        },
      });

      const availableByVariantId = new Map<string, number>();
      for (const entry of ledgerEntries) {
        availableByVariantId.set(
          entry.variant_id,
          roundQuantity((availableByVariantId.get(entry.variant_id) ?? 0) + Number(entry.quantity)),
        );
      }

      for (const [variantId, requestedQuantity] of requestedByVariantId.entries()) {
        const availableQuantity = availableByVariantId.get(variantId) ?? 0;
        if (availableQuantity < requestedQuantity) {
          throw new BadRequestError("Posting would make stock negative for one or more items");
        }
      }
    }

    await tx.stockLedger.createMany({
      data: productLines.map((line) => ({
        business_id: tenantId,
        location_id: document.location_id,
        variant_id: line.variant_id as string,
        quantity:
          responsibility.effect === "DEDUCT"
            ? -roundQuantity(Number(line.quantity))
            : roundQuantity(Number(line.quantity)),
        reason: getPostingReason(document.type as SalesDocumentType),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });
  }
}

export const stockPostingService = new StockPostingService();
