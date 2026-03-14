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

const getTransitionReason = (
  documentType: SalesDocumentType,
  action: "CANCEL" | "REOPEN",
) => {
  if (documentType === "DELIVERY_CHALLAN") {
    return action === "CANCEL"
      ? "SALE_DELIVERY_CHALLAN_CANCEL"
      : "SALE_DELIVERY_CHALLAN_REOPEN";
  }
  if (documentType === "SALES_RETURN") {
    return action === "CANCEL" ? "SALE_RETURN_CANCEL" : "SALE_RETURN_REOPEN";
  }
  return action === "CANCEL" ? "SALE_INVOICE_CANCEL" : "SALE_INVOICE_REOPEN";
};

type StockPostingDocument = {
  id: string;
  type: string;
  parent_id: string | null;
  location_id: string | null;
  lineItems: Array<{
    id: string;
    variant_id: string | null;
    quantity: unknown;
    description_snapshot: string | null;
    description: string;
    target_links: Array<{
      source_line: {
        document: {
          type: string;
        };
      };
    }>;
  }>;
};

class StockPostingService {
  private async getDocumentForStockEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<{
    document: StockPostingDocument;
    parentType: SalesDocumentType | null;
  }> {
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
            target_links: {
              orderBy: {
                id: "asc",
              },
              select: {
                source_line: {
                  select: {
                    document: {
                      select: {
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

    return {
      document,
      parentType,
    };
  }

  private async getProductLinesForDocument(
    tx: SalesTransactionClient,
    tenantId: string,
    document: StockPostingDocument,
  ) {
    const variantIds = [
      ...new Set(
        document.lineItems
          .map((line) => line.variant_id)
          .filter((variantId): variantId is string => Boolean(variantId)),
      ),
    ];

    if (variantIds.length === 0) {
      return [] as Array<{
        id: string;
        variant_id: string;
        quantity: unknown;
        description_snapshot: string | null;
        description: string;
      }>;
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

    return document.lineItems.filter(
      (line): line is {
        id: string;
        variant_id: string;
        quantity: unknown;
        description_snapshot: string | null;
        description: string;
        target_links: Array<{
          source_line: {
            document: {
              type: string;
            };
          };
        }>;
      } =>
        Boolean(line.variant_id) &&
        variantTypeById.get(line.variant_id as string) === "PRODUCT" &&
        roundQuantity(Number(line.quantity)) > 0,
    );
  }

  private getStockEffectiveProductLines(
    documentType: SalesDocumentType,
    productLines: Array<{
      id: string;
      variant_id: string;
      quantity: unknown;
      description_snapshot: string | null;
      description: string;
      target_links?: Array<{
        source_line: {
          document: {
            type: string;
          };
        };
      }>;
    }>,
  ) {
    if (documentType !== "SALES_INVOICE") {
      return productLines;
    }

    return productLines.filter((line) => {
      const sourceDocumentType = line.target_links?.[0]?.source_line.document.type ?? null;
      return sourceDocumentType !== "DELIVERY_CHALLAN";
    });
  }

  private async assertSufficientStock(
    tx: SalesTransactionClient,
    tenantId: string,
    locationId: string,
    productLines: Array<{
      variant_id: string;
      quantity: unknown;
    }>,
  ) {
    const requestedByVariantId = new Map<string, number>();
    for (const line of productLines) {
      requestedByVariantId.set(
        line.variant_id,
        roundQuantity((requestedByVariantId.get(line.variant_id) ?? 0) + Number(line.quantity)),
      );
    }

    const ledgerEntries = await tx.stockLedger.findMany({
      where: {
        business_id: tenantId,
        location_id: locationId,
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

  async applyPostingEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);

    const responsibility = inventoryResponsibilityService.resolve(
      document.type as SalesDocumentType,
      parentType,
    );
    const stockEffect =
      document.type === "SALES_INVOICE" ? "DEDUCT" : responsibility.effect;
    if (stockEffect === "NONE") {
      return;
    }

    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting sales documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as SalesDocumentType,
      await this.getProductLinesForDocument(tx, tenantId, document),
    );
    if (productLines.length === 0) {
      return;
    }

    if (stockEffect === "DEDUCT" && !isNegativeStockAllowed()) {
      await this.assertSufficientStock(tx, tenantId, document.location_id, productLines);
    }

    await tx.stockLedger.createMany({
      data: productLines.map((line) => ({
        business_id: tenantId,
        location_id: document.location_id,
        variant_id: line.variant_id as string,
        quantity:
          stockEffect === "DEDUCT"
            ? -roundQuantity(Number(line.quantity))
            : roundQuantity(Number(line.quantity)),
        reason: getPostingReason(document.type as SalesDocumentType),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });
  }

  async applyCancellationEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);
    const responsibility = inventoryResponsibilityService.resolve(
      document.type as SalesDocumentType,
      parentType,
    );
    const stockEffect =
      document.type === "SALES_INVOICE" ? "DEDUCT" : responsibility.effect;
    if (stockEffect === "NONE") {
      return;
    }
    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting sales documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as SalesDocumentType,
      await this.getProductLinesForDocument(tx, tenantId, document),
    );
    if (productLines.length === 0) {
      return;
    }

    await tx.stockLedger.createMany({
      data: productLines.map((line) => ({
        business_id: tenantId,
        location_id: document.location_id,
        variant_id: line.variant_id,
        quantity:
          stockEffect === "DEDUCT"
            ? roundQuantity(Number(line.quantity))
            : -roundQuantity(Number(line.quantity)),
        reason: getTransitionReason(document.type as SalesDocumentType, "CANCEL"),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });
  }

  async applyReopenEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);
    const responsibility = inventoryResponsibilityService.resolve(
      document.type as SalesDocumentType,
      parentType,
    );
    const stockEffect =
      document.type === "SALES_INVOICE" ? "DEDUCT" : responsibility.effect;
    if (stockEffect === "NONE") {
      return;
    }
    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting sales documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as SalesDocumentType,
      await this.getProductLinesForDocument(tx, tenantId, document),
    );
    if (productLines.length === 0) {
      return;
    }

    if (stockEffect === "DEDUCT" && !isNegativeStockAllowed()) {
      await this.assertSufficientStock(tx, tenantId, document.location_id, productLines);
    }

    await tx.stockLedger.createMany({
      data: productLines.map((line) => ({
        business_id: tenantId,
        location_id: document.location_id,
        variant_id: line.variant_id,
        quantity:
          stockEffect === "DEDUCT"
            ? -roundQuantity(Number(line.quantity))
            : roundQuantity(Number(line.quantity)),
        reason: getTransitionReason(document.type as SalesDocumentType, "REOPEN"),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });
  }
}

export const stockPostingService = new StockPostingService();
