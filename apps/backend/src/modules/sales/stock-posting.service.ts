import { BadRequestError } from "../../shared/utils/errors.js";
import { stockActivityRecorder } from "../inventory/stock-activity-recorder.service.js";
import type { StockActivitySourceType } from "../inventory/stock-activity.shared.js";
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

const getStockActivitySourceType = (
  documentType: SalesDocumentType,
): StockActivitySourceType => {
  if (documentType === "DELIVERY_CHALLAN") {
    return "DELIVERY_CHALLAN";
  }
  if (documentType === "SALES_RETURN") {
    return "SALES_RETURN";
  }
  return "SALES_INVOICE";
};

type StockPostingDocument = {
  id: string;
  doc_number: string;
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
        doc_number: true,
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

  private getStockLevelEntityId(variantId: string, locationId: string) {
    return `${variantId}:${locationId}`;
  }

  private async getNextSyncServerVersion(
    tx: SalesTransactionClient,
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
    tx: SalesTransactionClient,
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
    tx: SalesTransactionClient,
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
    tx: SalesTransactionClient,
    tenantId: string,
    snapshots: Array<{
      id: string;
      variantId: string;
      itemId: string;
      itemName: string;
      variantName: string | null;
      sku: string | null;
      unit: string;
      locationId: string;
      locationName: string;
      quantityOnHand: number;
    }>,
  ) {
    if (snapshots.length === 0) {
      return;
    }

    for (const snapshot of snapshots) {
      await this.appendSyncChange(tx, tenantId, "stock_level", String(snapshot.id), "UPDATE", snapshot);
    }
  }

  private async applyStockLedgerAndActivityEffects(
    tx: SalesTransactionClient,
    tenantId: string,
    document: Pick<
      StockPostingDocument,
      "id" | "doc_number" | "type" | "location_id" | "location_name_snapshot"
    >,
    productLines: Array<{
      variant_id: string;
      quantity: unknown;
    }>,
    sourceAction: "POSTED" | "CANCELLED" | "REOPENED",
    deltaForLine: (quantity: number) => number,
    reason: string,
  ) {
    if (!document.location_id || productLines.length === 0) {
      return;
    }

    const sourceType = getStockActivitySourceType(document.type as SalesDocumentType);
    const uniqueVariantIds = [...new Set(productLines.map((line) => line.variant_id))];
    const runningSnapshots = new Map<
      string,
      {
        id: string;
        variantId: string;
        itemId: string;
        itemName: string;
        variantName: string | null;
        sku: string | null;
        unit: string;
        locationId: string;
        locationName: string;
        quantityOnHand: number;
      }
    >();

    for (const variantId of uniqueVariantIds) {
      const snapshot = await this.getStockLevelSnapshot(
        tx,
        tenantId,
        variantId,
        document.location_id,
        document.location_name_snapshot ?? null,
      );
      runningSnapshots.set(variantId, snapshot);
    }

    for (const line of productLines) {
      const currentSnapshot = runningSnapshots.get(line.variant_id);
      if (!currentSnapshot) {
        continue;
      }

      const quantityDelta = roundQuantity(deltaForLine(Number(line.quantity)));
      await tx.stockLedger.create({
        data: {
          business_id: tenantId,
          location_id: document.location_id,
          variant_id: line.variant_id,
          quantity: quantityDelta,
          reason,
          reference_id: document.id,
          is_active: true,
          deleted_at: null,
        },
      });

      const nextQuantityOnHand = roundQuantity(currentSnapshot.quantityOnHand + quantityDelta);
      const nextSnapshot = {
        ...currentSnapshot,
        quantityOnHand: nextQuantityOnHand,
      };
      runningSnapshots.set(line.variant_id, nextSnapshot);

      const activityRow = await stockActivityRecorder.record(tx as any, {
        snapshot: stockActivityRecorder.withQuantityOnHandAfter(
          {
            businessId: tenantId,
            locationId: nextSnapshot.locationId,
            locationName: nextSnapshot.locationName,
            itemId: nextSnapshot.itemId,
            variantId: nextSnapshot.variantId,
            itemName: nextSnapshot.itemName,
            variantName: nextSnapshot.variantName,
            sku: nextSnapshot.sku,
            unit: nextSnapshot.unit,
          },
          nextQuantityOnHand,
        ),
        quantityDelta,
        sourceType,
        sourceAction,
        sourceDocumentId: document.id,
        sourceDocumentNumber: document.doc_number,
      });

      await this.appendSyncChange(
        tx,
        tenantId,
        "stock_activity",
        activityRow.id,
        "CREATE",
        stockActivityRecorder.toSyncPayload(activityRow),
      );
    }

    await this.appendStockLevelSyncChanges(tx, tenantId, Array.from(runningSnapshots.values()));
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

    await this.applyStockLedgerAndActivityEffects(
      tx,
      tenantId,
      document,
      productLines,
      "POSTED",
      (quantity) => (stockEffect === "DEDUCT" ? -quantity : quantity),
      getPostingReason(document.type as SalesDocumentType),
    );
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

    await this.applyStockLedgerAndActivityEffects(
      tx,
      tenantId,
      document,
      productLines,
      "CANCELLED",
      (quantity) => (stockEffect === "DEDUCT" ? quantity : -quantity),
      getTransitionReason(document.type as SalesDocumentType, "CANCEL"),
    );
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

    await this.applyStockLedgerAndActivityEffects(
      tx,
      tenantId,
      document,
      productLines,
      "REOPENED",
      (quantity) => (stockEffect === "DEDUCT" ? -quantity : quantity),
      getTransitionReason(document.type as SalesDocumentType, "REOPEN"),
    );
  }
}

export const stockPostingService = new StockPostingService();
