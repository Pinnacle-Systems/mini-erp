import { BadRequestError } from "../../shared/utils/errors.js";
import { purchaseInventoryResponsibilityService } from "./purchase-inventory-responsibility.service.js";
import type { PurchaseDocumentType, PurchaseTransactionClient } from "./purchases.types.js";

const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const isNegativeStockAllowed = () =>
  process.env.ALLOW_NEGATIVE_STOCK?.trim().toLowerCase() === "true";

const getPostingReason = (documentType: PurchaseDocumentType) => {
  if (documentType === "GOODS_RECEIPT_NOTE") {
    return "PURCHASE_GRN_POST";
  }
  if (documentType === "PURCHASE_RETURN") {
    return "PURCHASE_RETURN_POST";
  }
  return "PURCHASE_INVOICE_POST";
};

const getTransitionReason = (
  documentType: PurchaseDocumentType,
  action: "CANCEL" | "REOPEN",
) => {
  if (documentType === "GOODS_RECEIPT_NOTE") {
    return action === "CANCEL" ? "PURCHASE_GRN_CANCEL" : "PURCHASE_GRN_REOPEN";
  }
  if (documentType === "PURCHASE_RETURN") {
    return action === "CANCEL" ? "PURCHASE_RETURN_CANCEL" : "PURCHASE_RETURN_REOPEN";
  }
  return action === "CANCEL" ? "PURCHASE_INVOICE_CANCEL" : "PURCHASE_INVOICE_REOPEN";
};

type StockPostingDocument = {
  id: string;
  type: string;
  parent_id: string | null;
  location_id: string | null;
  location_name_snapshot?: string | null;
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

class PurchaseStockPostingService {
  private async getDocumentForStockEffects(
    tx: PurchaseTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<{
    document: StockPostingDocument;
    parentType: PurchaseDocumentType | null;
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
        location_name_snapshot: true,
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

    let parentType: PurchaseDocumentType | null = null;
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

      parentType = (parent?.type as PurchaseDocumentType | undefined) ?? null;
    }

    return {
      document,
      parentType,
    };
  }

  private async getProductLinesForDocument(
    tx: PurchaseTransactionClient,
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
    documentType: PurchaseDocumentType,
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
    if (documentType !== "PURCHASE_INVOICE") {
      return productLines;
    }

    return productLines.filter((line) => {
      const sourceDocumentType = line.target_links?.[0]?.source_line.document.type ?? null;
      return sourceDocumentType !== "GOODS_RECEIPT_NOTE";
    });
  }

  private async assertSufficientStock(
    tx: PurchaseTransactionClient,
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

  private getStockLevelEntityId(variantId: string, locationId: string) {
    return `${variantId}:${locationId}`;
  }

  private async getNextSyncServerVersion(
    tx: PurchaseTransactionClient,
    tenantId: string,
    entity: string,
    entityId: string,
  ) {
    const txAny = tx as any;
    const latestEntityChange = await txAny.syncChangeLog.findFirst({
      where: {
        tenant_id: tenantId,
        entity,
        entity_id: entityId,
      },
      orderBy: {
        server_version: "desc",
      },
      select: {
        server_version: true,
      },
    });

    return (latestEntityChange?.server_version ?? 0) + 1;
  }

  private async appendSyncChange(
    tx: PurchaseTransactionClient,
    tenantId: string,
    entity: string,
    entityId: string,
    operation: "CREATE" | "UPDATE" | "DELETE" | "PURGE",
    data: Record<string, unknown>,
  ) {
    const txAny = tx as any;
    const serverVersion = await this.getNextSyncServerVersion(tx, tenantId, entity, entityId);
    await txAny.syncChangeLog.create({
      data: {
        tenant_id: tenantId,
        entity,
        entity_id: entityId,
        operation,
        data,
        server_version: serverVersion,
      },
    });
  }

  private async getStockLevelSnapshot(
    tx: PurchaseTransactionClient,
    tenantId: string,
    variantId: string,
    locationId: string,
    fallbackLocationName: string | null,
  ) {
    const txAny = tx as any;
    const [variant, ledgerEntries, location] = await Promise.all([
      txAny.itemVariant.findUnique({
        where: { id: variantId },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              unit: true,
              deleted_at: true,
            },
          },
        },
      }),
      txAny.stockLedger.findMany({
        where: {
          business_id: tenantId,
          variant_id: variantId,
          location_id: locationId,
          deleted_at: null,
        },
        select: {
          quantity: true,
        },
      }),
      txAny.businessLocation.findFirst({
        where: {
          id: locationId,
          business_id: tenantId,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!variant || variant.business_id !== tenantId || variant.deleted_at || variant.item?.deleted_at) {
      throw new BadRequestError("One or more selected items are no longer available");
    }

    const quantityOnHand = ledgerEntries.reduce((total, entry) => total + Number(entry.quantity), 0);

    return {
      id: this.getStockLevelEntityId(variant.id, locationId),
      variantId: variant.id,
      itemId: variant.item_id,
      itemName: variant.item?.name ?? "",
      variantName: variant.name ?? null,
      sku: variant.sku ?? null,
      unit: variant.item?.unit ?? "PCS",
      locationId,
      locationName: location?.name ?? fallbackLocationName ?? "",
      quantityOnHand,
    };
  }

  private async appendStockLevelSyncChanges(
    tx: PurchaseTransactionClient,
    tenantId: string,
    document: Pick<StockPostingDocument, "location_id" | "location_name_snapshot">,
    productLines: Array<{ variant_id: string }>,
  ) {
    if (!document.location_id || productLines.length === 0) {
      return;
    }

    const uniqueVariantIds = [...new Set(productLines.map((line) => line.variant_id))];
    for (const variantId of uniqueVariantIds) {
      const snapshot = await this.getStockLevelSnapshot(
        tx,
        tenantId,
        variantId,
        document.location_id,
        document.location_name_snapshot ?? null,
      );
      await this.appendSyncChange(tx, tenantId, "stock_level", String(snapshot.id), "UPDATE", snapshot);
    }
  }

  async applyPostingEffects(
    tx: PurchaseTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);

    const responsibility = purchaseInventoryResponsibilityService.resolve(
      document.type as PurchaseDocumentType,
      parentType,
    );
    const stockEffect = document.type === "PURCHASE_INVOICE" ? "ADD" : responsibility.effect;

    if (stockEffect === "NONE") {
      return;
    }

    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting purchase documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as PurchaseDocumentType,
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
          stockEffect === "ADD"
            ? roundQuantity(Number(line.quantity))
            : -roundQuantity(Number(line.quantity)),
        reason: getPostingReason(document.type as PurchaseDocumentType),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });

    await this.appendStockLevelSyncChanges(tx, tenantId, document, productLines);
  }

  async applyCancellationEffects(
    tx: PurchaseTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);

    const responsibility = purchaseInventoryResponsibilityService.resolve(
      document.type as PurchaseDocumentType,
      parentType,
    );
    const stockEffect = document.type === "PURCHASE_INVOICE" ? "ADD" : responsibility.effect;

    if (stockEffect === "NONE") {
      return;
    }

    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting purchase documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as PurchaseDocumentType,
      await this.getProductLinesForDocument(tx, tenantId, document),
    );
    if (productLines.length === 0) {
      return;
    }

    if (stockEffect === "ADD" && !isNegativeStockAllowed()) {
      await this.assertSufficientStock(tx, tenantId, document.location_id, productLines);
    }

    await tx.stockLedger.createMany({
      data: productLines.map((line) => ({
        business_id: tenantId,
        location_id: document.location_id,
        variant_id: line.variant_id,
        quantity:
          stockEffect === "ADD"
            ? -roundQuantity(Number(line.quantity))
            : roundQuantity(Number(line.quantity)),
        reason: getTransitionReason(document.type as PurchaseDocumentType, "CANCEL"),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });

    await this.appendStockLevelSyncChanges(tx, tenantId, document, productLines);
  }

  async applyReopenEffects(
    tx: PurchaseTransactionClient,
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    const { document, parentType } = await this.getDocumentForStockEffects(tx, tenantId, documentId);

    const responsibility = purchaseInventoryResponsibilityService.resolve(
      document.type as PurchaseDocumentType,
      parentType,
    );
    const stockEffect = document.type === "PURCHASE_INVOICE" ? "ADD" : responsibility.effect;

    if (stockEffect === "NONE") {
      return;
    }

    if (!document.location_id) {
      throw new BadRequestError("Stock-affecting purchase documents require a business location");
    }

    const productLines = this.getStockEffectiveProductLines(
      document.type as PurchaseDocumentType,
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
          stockEffect === "ADD"
            ? roundQuantity(Number(line.quantity))
            : -roundQuantity(Number(line.quantity)),
        reason: getTransitionReason(document.type as PurchaseDocumentType, "REOPEN"),
        reference_id: document.id,
        is_active: true,
        deleted_at: null,
      })),
    });

    await this.appendStockLevelSyncChanges(tx, tenantId, document, productLines);
  }
}

export const purchaseStockPostingService = new PurchaseStockPostingService();
