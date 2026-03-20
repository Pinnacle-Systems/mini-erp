import type { PurchaseDocumentType } from "./purchases.types.js";

export type PurchaseInventoryEffect = "NONE" | "DEDUCT" | "ADD";

type InventoryResponsibility = {
  effect: PurchaseInventoryEffect;
  parentType: PurchaseDocumentType | null;
};

class PurchaseInventoryResponsibilityService {
  resolve(
    documentType: PurchaseDocumentType,
    parentType?: PurchaseDocumentType | null,
  ): InventoryResponsibility {
    const normalizedParentType = parentType ?? null;

    if (documentType === "GOODS_RECEIPT_NOTE") {
      return {
        effect: "ADD",
        parentType: normalizedParentType,
      };
    }

    if (documentType === "PURCHASE_INVOICE") {
      return {
        effect: normalizedParentType === "GOODS_RECEIPT_NOTE" ? "NONE" : "ADD",
        parentType: normalizedParentType,
      };
    }

    if (documentType === "PURCHASE_RETURN") {
      return {
        effect:
          normalizedParentType === "PURCHASE_INVOICE" || normalizedParentType === "GOODS_RECEIPT_NOTE"
            ? "DEDUCT"
            : "NONE",
        parentType: normalizedParentType,
      };
    }

    return {
      effect: "NONE",
      parentType: normalizedParentType,
    };
  }
}

export const purchaseInventoryResponsibilityService = new PurchaseInventoryResponsibilityService();
