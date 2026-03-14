import type { SalesDocumentType } from "./sales.types.js";

export type InventoryEffect = "NONE" | "DEDUCT" | "ADD";

type InventoryResponsibility = {
  effect: InventoryEffect;
  parentType: SalesDocumentType | null;
};

class InventoryResponsibilityService {
  resolve(
    documentType: SalesDocumentType,
    parentType?: SalesDocumentType | null,
  ): InventoryResponsibility {
    const normalizedParentType = parentType ?? null;

    if (documentType === "DELIVERY_CHALLAN") {
      return {
        effect: "DEDUCT",
        parentType: normalizedParentType,
      };
    }

    if (documentType === "SALES_INVOICE") {
      return {
        effect: normalizedParentType === "DELIVERY_CHALLAN" ? "NONE" : "DEDUCT",
        parentType: normalizedParentType,
      };
    }

    if (documentType === "SALES_RETURN") {
      return {
        effect: normalizedParentType === "SALES_INVOICE" || normalizedParentType === "DELIVERY_CHALLAN"
          ? "ADD"
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

export const inventoryResponsibilityService = new InventoryResponsibilityService();
