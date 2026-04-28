import { prisma } from "../../lib/prisma.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/utils/errors.js";
import { getBusinessCapabilitiesFromLicense } from "../license/license.service.js";
import accountsService from "../accounts/accounts.service.js";
import { appendSyncChange } from "../sync/sync.service.js";
import {
  mapDocumentHistoryEntries,
  recordDocumentHistory,
  type DocumentHistoryActor,
} from "../sales/document-history.service.js";
import { purchaseBalanceService } from "./purchase-balance.service.js";
import { purchaseDocumentLinkService } from "./purchase-document-link.service.js";
import { getPurchaseOverview as getPurchaseOverviewService } from "./purchases-overview.service.js";
import { purchaseStockPostingService } from "./purchase-stock-posting.service.js";
import {
  toPurchaseConversionBalanceView,
  toPurchaseDocumentHistoryView,
  toPurchaseDocumentListView,
  toPurchaseDocumentPayload,
  toPurchaseOverviewView,
} from "./purchases.response-mappers.js";
import type {
  PurchaseDocumentAction,
  PurchaseDocumentCancelReason,
  PurchaseDocumentInput,
  PurchaseDocumentPostInput,
  PurchaseDocumentType,
  PurchaseLineInput,
  PurchaseTransactionClient,
} from "./purchases.types.js";

type PurchaseDocumentRecord = Awaited<ReturnType<typeof getPurchaseDocumentOrThrow>>;

type PurchaseAccessDeps = {
  validateMembership: typeof tenantService.validateMembership;
  getCapabilities: typeof getBusinessCapabilitiesFromLicense;
};

type PartySnapshot = {
  role: "supplier" | "customer";
  name: string;
  phone: string | null;
  address: string | null;
  taxId: string | null;
};

const PURCHASE_DOCUMENT_META: Record<
  PurchaseDocumentType,
  {
    prefix: string;
    singularLabel: string;
    pluralLabel: string;
    notFoundLabel: string;
    duplicateLabel: string;
  }
> = {
  PURCHASE_ORDER: {
    prefix: "PO-",
    singularLabel: "purchase order",
    pluralLabel: "purchase orders",
    notFoundLabel: "Purchase order not found",
    duplicateLabel: "Purchase order number already exists",
  },
  GOODS_RECEIPT_NOTE: {
    prefix: "GRN-",
    singularLabel: "goods receipt note",
    pluralLabel: "goods receipt notes",
    notFoundLabel: "Goods receipt note not found",
    duplicateLabel: "Goods receipt note number already exists",
  },
  PURCHASE_INVOICE: {
    prefix: "PINV-",
    singularLabel: "purchase invoice",
    pluralLabel: "purchase invoices",
    notFoundLabel: "Purchase invoice not found",
    duplicateLabel: "Purchase invoice number already exists",
  },
  PURCHASE_RETURN: {
    prefix: "PRTN-",
    singularLabel: "purchase return",
    pluralLabel: "purchase returns",
    notFoundLabel: "Purchase return not found",
    duplicateLabel: "Purchase return number already exists",
  },
};

const PURCHASE_DOCUMENT_CONVERSION_RULES: Partial<
  Record<PurchaseDocumentType, PurchaseDocumentType[]>
> = {
  PURCHASE_ORDER: ["GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE"],
  GOODS_RECEIPT_NOTE: ["PURCHASE_INVOICE", "PURCHASE_RETURN"],
  PURCHASE_INVOICE: ["PURCHASE_RETURN"],
};

const usesSettlementMode = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_INVOICE";

const requiresSupplierDetails = () => true;

const toRounded = (value: number, fractionDigits: number) => {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
};

const parsePositiveNumber = (value: string, field: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestError(`${field} must be a valid non-negative number`);
  }
  return parsed;
};

const parseTaxRate = (value: string) => {
  if (value === "EXEMPT") {
    return 0;
  }

  const normalized = value.endsWith("%") ? value.slice(0, -1) : value;
  return parsePositiveNumber(normalized, "Tax rate");
};

const formatDecimalString = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));

const buildLineAmounts = (line: PurchaseLineInput) => {
  const quantity = toRounded(parsePositiveNumber(line.quantity, "Quantity"), 3);
  const unitPrice = toRounded(parsePositiveNumber(line.unitPrice, "Unit price"), 2);
  const taxRate = toRounded(parseTaxRate(line.taxRate), 2);
  const grossAmount = toRounded(quantity * unitPrice, 2);

  if (line.taxMode === "INCLUSIVE" && taxRate > 0) {
    const subTotal = toRounded(grossAmount / (1 + taxRate / 100), 2);
    const taxTotal = toRounded(grossAmount - subTotal, 2);
    return {
      quantity,
      unitPrice,
      taxRate,
      subTotal,
      taxTotal,
      total: grossAmount,
    };
  }

  const subTotal = grossAmount;
  const taxTotal = toRounded(subTotal * (taxRate / 100), 2);
  return {
    quantity,
    unitPrice,
    taxRate,
    subTotal,
    taxTotal,
    total: toRounded(subTotal + taxTotal, 2),
  };
};

const buildPartySnapshot = (input: {
  role: PartySnapshot["role"];
  name: string;
  phone: string;
  address: string;
  taxId: string;
}): PartySnapshot | null => {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const taxId = input.taxId.trim();

  if (!name && !phone && !address && !taxId) {
    return null;
  }

  return {
    role: input.role,
    name,
    phone: phone || null,
    address: address || null,
    taxId: taxId || null,
  };
};

const parsePartySnapshot = (value: unknown): PartySnapshot | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const role = raw.role;
  const name = typeof raw.name === "string" ? raw.name : "";
  const phone = typeof raw.phone === "string" ? raw.phone : null;
  const address = typeof raw.address === "string" ? raw.address : null;
  const taxId = typeof raw.taxId === "string" ? raw.taxId : null;

  if ((role !== "supplier" && role !== "customer") || !name.trim()) {
    return null;
  }

  return {
    role,
    name: name.trim(),
    phone,
    address,
    taxId,
  };
};

const emitPurchaseReadModelSnapshot = async (
  tx: PurchaseTransactionClient,
  tenantId: string,
  document: PurchaseDocumentRecord | { id: string },
  options?: { isTombstone?: boolean },
) => {
  if (options?.isTombstone) {
    await appendSyncChange(tx, tenantId, "purchase_document_read_model", document.id, "UPDATE", {
      id: document.id,
      isActive: false,
      deletedAt: new Date().toISOString(),
    });
    return;
  }

  const fullDocument = document as PurchaseDocumentRecord;
  const partySnapshot = parsePartySnapshot(fullDocument.party_snapshot);

  await appendSyncChange(
    tx,
    tenantId,
    "purchase_document_read_model",
    fullDocument.id,
    "UPDATE",
    {
      id: fullDocument.id,
      documentType: fullDocument.type,
      documentNumber: fullDocument.doc_number,
      status: fullDocument.status,
      postedAt: fullDocument.posted_at?.toISOString() ?? null,
      grandTotal: Number(fullDocument.grand_total ?? 0),
      settlementSnapshot: null,
      supplierId: fullDocument.party_id,
      supplierName: partySnapshot?.name ?? "",
      locationId: fullDocument.location_id ?? null,
      locationName: fullDocument.location_name_snapshot ?? "",
      isActive: true,
      deletedAt: null,
      updatedAt: fullDocument.updated_at.toISOString(),
    },
  );
};

const parseDocumentNumberSequence = (value: string, prefix: string) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(value.trim().toUpperCase());
  if (!match) {
    return null;
  }

  return Number(match[1]);
};

const formatDocumentNumber = (documentType: PurchaseDocumentType, sequence: number) => {
  const meta = PURCHASE_DOCUMENT_META[documentType];
  return `${meta.prefix}${String(sequence).padStart(4, "0")}`;
};

export const getPurchaseCapabilityRequired = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_RETURN" ? "TXN_PURCHASE_RETURN" : "TXN_PURCHASE_CREATE";

export const assertPurchaseAccess = async (
  userId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
  deps: PurchaseAccessDeps = {
    validateMembership: tenantService.validateMembership,
    getCapabilities: getBusinessCapabilitiesFromLicense,
  },
) => {
  const member = await deps.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const capabilities = await deps.getCapabilities(tenantId);
  const requiredCapabilities = ["PARTIES_SUPPLIERS", getPurchaseCapabilityRequired(documentType)] as const;

  if (!requiredCapabilities.every((capability) => capabilities.includes(capability))) {
    throw new ForbiddenError(
      `${PURCHASE_DOCUMENT_META[documentType].singularLabel} workflow is not enabled for this store license`,
    );
  }
};

export const getSuggestedPurchaseDocumentNumber = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: PurchaseDocumentType,
  excludedDocumentId?: string,
) => {
  const meta = PURCHASE_DOCUMENT_META[documentType];
  const existing = await tx.document.findMany({
    where: {
      business_id: tenantId,
      type: documentType,
      deleted_at: null,
      ...(excludedDocumentId
        ? {
            id: {
              not: excludedDocumentId,
            },
          }
        : {}),
    },
    select: {
      doc_number: true,
    },
  });

  const maxSequence = existing.reduce((max, row) => {
    const parsed = parseDocumentNumberSequence(row.doc_number, meta.prefix);
    return parsed && parsed > max ? parsed : max;
  }, 0);

  return formatDocumentNumber(documentType, maxSequence + 1);
};

const assertUniqueBillNumber = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: PurchaseDocumentType,
  billNumber: string,
  excludedDocumentId?: string,
) => {
  const existing = await tx.document.findFirst({
    where: {
      business_id: tenantId,
      type: documentType,
      doc_number: billNumber,
      deleted_at: null,
      ...(excludedDocumentId
        ? {
            id: {
              not: excludedDocumentId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    const suggested = await getSuggestedPurchaseDocumentNumber(
      tx,
      tenantId,
      documentType,
      excludedDocumentId,
    );
    throw new ConflictError(PURCHASE_DOCUMENT_META[documentType].duplicateLabel, {
      reasonCode: "DOCUMENT_NUMBER_CONFLICT",
      details: {
        requested: billNumber,
        suggested,
      },
    });
  }
};

const getSupplierReference = async (
  tx: Pick<typeof prisma, "party">,
  tenantId: string,
  input: Pick<
    PurchaseDocumentInput,
    | "supplierId"
    | "supplierName"
    | "supplierPhone"
    | "supplierAddress"
    | "supplierTaxId"
    | "settlementMode"
    | "documentType"
  >,
  options?: {
    allowIncomplete?: boolean;
  },
) => {
  const normalizedSettlementMode = usesSettlementMode(input.documentType)
    ? input.settlementMode ?? "CASH"
    : null;
  const supplierId = input.supplierId ?? null;

  if (!supplierId) {
    if (normalizedSettlementMode === "CREDIT") {
      throw new BadRequestError(
        `${PURCHASE_DOCUMENT_META[input.documentType].singularLabel} requires an existing supplier for credit transactions`,
      );
    }
    if (!options?.allowIncomplete && requiresSupplierDetails() && !input.supplierName.trim()) {
      throw new BadRequestError(
        `${PURCHASE_DOCUMENT_META[input.documentType].singularLabel} requires supplier details`,
      );
    }

    return {
      partyId: null,
      supplierName: input.supplierName.trim(),
      supplierPhone: input.supplierPhone.trim(),
      supplierAddress: input.supplierAddress.trim(),
      supplierTaxId: input.supplierTaxId.trim(),
    };
  }

  const party = await tx.party.findFirst({
    where: {
      id: supplierId,
      business_id: tenantId,
      deleted_at: null,
      is_active: true,
      type: {
        in: ["SUPPLIER", "BOTH"],
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      tax_id: true,
    },
  });

  if (!party) {
    throw new BadRequestError(
      `Selected supplier is not available for this ${PURCHASE_DOCUMENT_META[input.documentType].singularLabel}`,
    );
  }

  return {
    partyId: party.id,
    supplierName: party.name,
    supplierPhone: party.phone ?? "",
    supplierAddress: party.address ?? "",
    supplierTaxId: party.tax_id ?? "",
  };
};

const getParentDocumentReference = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: PurchaseDocumentType,
  parentId?: string | null,
) => {
  if (!parentId) {
    if (documentType === "PURCHASE_RETURN") {
      throw new BadRequestError(
        "Purchase return must reference a posted purchase invoice or goods receipt note",
      );
    }

    return null;
  }

  const parent = await tx.document.findFirst({
    where: {
      id: parentId,
      business_id: tenantId,
      deleted_at: null,
      type: {
        in: ["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE"],
      },
    },
    select: {
      id: true,
      type: true,
      location_id: true,
      posted_at: true,
    },
  });

  if (!parent) {
    throw new BadRequestError("Selected source document is no longer available");
  }

  const allowedChildren = PURCHASE_DOCUMENT_CONVERSION_RULES[parent.type as PurchaseDocumentType];
  if (!allowedChildren?.includes(documentType)) {
    throw new BadRequestError(
      `${PURCHASE_DOCUMENT_META[documentType].singularLabel} cannot be converted from this source document`,
    );
  }

  if (documentType === "PURCHASE_RETURN" && !parent.posted_at) {
    throw new BadRequestError(
      "Purchase return must reference a posted purchase invoice or goods receipt note",
    );
  }

  return parent;
};

const getDocumentLocationReference = async (
  tenantId: string,
  locationId?: string | null,
) => {
  if (locationId) {
    const selectedLocation = await tenantService.validateBusinessLocation(tenantId, locationId);
    if (selectedLocation) {
      return {
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
      };
    }
  }

  const defaultLocation = await tenantService.getDefaultBusinessLocation(tenantId);
  if (!defaultLocation) {
    throw new BadRequestError("Default business location is not configured");
  }

  return {
    locationId: defaultLocation.id,
    locationName: defaultLocation.name,
  };
};

const getVariantSnapshotMap = async (
  tx: Pick<typeof prisma, "itemVariant">,
  tenantId: string,
  lines: Array<Pick<PurchaseLineInput, "variantId">>,
) => {
  const uniqueVariantIds = [...new Set(lines.map((line) => line.variantId))];
  const variants = await tx.itemVariant.findMany({
    where: {
      id: {
        in: uniqueVariantIds,
      },
      business_id: tenantId,
      deleted_at: null,
      is_active: true,
      item: {
        deleted_at: null,
        is_active: true,
      },
    },
    select: {
      id: true,
      item_id: true,
      sku: true,
      barcode: true,
      name: true,
      option_values: {
        include: {
          option_value: {
            include: {
              option: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      item: {
        select: {
          name: true,
          hsn_sac: true,
          unit: true,
        },
      },
    },
  });

  if (variants.length !== uniqueVariantIds.length) {
    throw new BadRequestError("One or more selected items are no longer available");
  }

  return new Map(variants.map((variant) => [variant.id, variant] as const));
};

const buildOptionSnapshot = (variant: {
  option_values: Array<{
    option_value: {
      value: string;
      option: {
        name: string;
      };
    };
  }>;
}) =>
  variant.option_values.map((entry) => ({
    optionName: entry.option_value.option.name,
    value: entry.option_value.value,
  }));

const getPurchaseDocumentOrThrow = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: PurchaseDocumentType,
  documentId: string,
) => {
  const document = await tx.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      type: documentType,
      deleted_at: null,
    },
    include: {
      parent: {
        select: {
          id: true,
          doc_number: true,
        },
      },
      children: {
        where: {
          deleted_at: null,
        },
        orderBy: {
          created_at: "asc",
        },
        select: {
          id: true,
        },
      },
      lineItems: {
        orderBy: {
          id: "asc",
        },
        include: {
          target_links: {
            orderBy: {
              id: "asc",
            },
            select: {
              source_line_id: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    throw new NotFoundError(PURCHASE_DOCUMENT_META[documentType].notFoundLabel);
  }

  return document;
};

const mapPurchaseDocuments = (documents: PurchaseDocumentRecord[]) =>
  documents.map((document) => {
    const partySnapshot = parsePartySnapshot(document.party_snapshot);

    return {
      id: document.id,
      documentType: document.type as PurchaseDocumentType,
      parentId: document.parent_id ?? null,
      parentDocumentNumber: document.parent?.doc_number ?? null,
      childIds: document.children.map((child) => child.id),
      status: document.status,
      cancelReason: document.cancel_reason ?? null,
      postedAt: document.posted_at?.toISOString() ?? null,
      billNumber: document.doc_number,
      locationId: document.location_id ?? null,
      locationName: document.location_name_snapshot ?? "",
      settlementMode: document.settlement_mode ?? "CASH",
      grandTotal: Number(document.grand_total ?? 0),
      supplierId: document.party_id ?? null,
      supplierName: partySnapshot?.name ?? "",
      supplierPhone: partySnapshot?.phone ?? "",
      supplierAddress: partySnapshot?.address ?? "",
      supplierTaxId: partySnapshot?.taxId ?? "",
      notes: document.notes ?? "",
      savedAt: document.updated_at.toISOString(),
      lines: document.lineItems.map((line) => ({
        id: line.id,
        sourceLineId: line.target_links[0]?.source_line_id ?? null,
        variantId: line.variant_id ?? "",
        description: line.description_snapshot ?? line.description,
        quantity: formatDecimalString(Number(line.quantity)),
        unitPrice: formatDecimalString(Number(line.unit_price)),
        taxRate: Number(line.tax_rate) > 0 ? `${Number(line.tax_rate)}%` : "0%",
        taxMode: line.tax_mode_snapshot === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
        unit: line.unit_snapshot ?? "PCS",
      })),
    };
  });

const enrichPurchaseDocumentsWithSettlement = async (
  tenantId: string,
  documents: ReturnType<typeof mapPurchaseDocuments>,
) => {
  const settlementById = await accountsService.buildSettlementMap(
    tenantId,
    documents
      .filter((document) => document.documentType === "PURCHASE_INVOICE")
      .map((document) => ({
        id: document.id,
        documentType: document.documentType as "PURCHASE_INVOICE",
        status: document.status ?? null,
        grandTotal: document.grandTotal,
      })),
  );

  return documents.map((document) => ({
    ...document,
    settlement:
      document.documentType === "PURCHASE_INVOICE"
        ? (settlementById.get(document.id) ?? null)
        : null,
  }));
};

const buildSourceLineMap = (document: PurchaseDocumentRecord) =>
  Object.fromEntries(
    document.lineItems.map((line) => [line.id, line.target_links[0]?.source_line_id ?? null]),
  );

const syncParentConversionStatus = async (
  tx: PurchaseTransactionClient,
  tenantId: string,
  actor: DocumentHistoryActor,
  parentId?: string | null,
  metadata?: Record<string, unknown>,
) => {
  if (!parentId) {
    return;
  }

  const parent = await tx.document.findFirst({
    where: {
      id: parentId,
      business_id: tenantId,
      deleted_at: null,
    },
    select: {
      id: true,
      type: true,
      status: true,
      posted_at: true,
    },
  });

  if (!parent || ["CANCELLED", "VOID"].includes(parent.status as string)) {
    return;
  }
  if (!parent.posted_at) {
    return;
  }

  const parentType = parent.type as PurchaseDocumentType;
  if (!["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE"].includes(parentType)) {
    return;
  }

  const lineBalances =
    parentType === "PURCHASE_ORDER"
      ? await purchaseBalanceService.getReceiptLineBalances(tx, tenantId, parent.id)
      : parentType === "GOODS_RECEIPT_NOTE"
        ? await purchaseBalanceService.getInvoiceableLineBalances(tx, tenantId, parent.id)
        : await purchaseBalanceService.getLineBalances(tx, tenantId, parent.id, "RETURN");

  const hasAnyConsumption = lineBalances.some(
    (line) => line.remainingQuantity < line.originalQuantity,
  );
  const isFullyAllocated = lineBalances.every((line) => line.remainingQuantity <= 0);
  const nextStatus = !hasAnyConsumption ? "OPEN" : isFullyAllocated ? "COMPLETED" : "PARTIAL";

  if (nextStatus === parent.status) {
    return;
  }

  await tx.document.update({
    where: {
      id: parent.id,
    },
    data: {
      status: nextStatus,
    },
  });

  await recordDocumentHistory(tx, {
    tenantId,
    documentId: parent.id,
    eventType: "STATUS_CHANGED",
    actor,
    fromStatus: parent.status,
    toStatus: nextStatus,
    metadata: {
      reason: "CONVERSION_PROGRESS",
      ...(metadata ?? {}),
    },
  });
};

export const saveDraftPurchaseDocument = async (
  tx: PurchaseTransactionClient,
  documentId: string | null,
  input: PurchaseDocumentInput,
  actor: DocumentHistoryActor,
) => {
  const trimmedBillNumber = input.billNumber.trim();
  const uniqueLineIds = new Set(input.lines.map((line) => line.id));
  if (uniqueLineIds.size !== input.lines.length) {
    throw new BadRequestError("Document lines must have unique ids");
  }

  await assertUniqueBillNumber(
    tx,
    input.tenantId,
    input.documentType,
    trimmedBillNumber,
    documentId ?? undefined,
  );

  const parentRef = await getParentDocumentReference(
    tx,
    input.tenantId,
    input.documentType,
    input.parentId,
  );
  const [supplierRef, variantMap, locationRef] = await Promise.all([
    getSupplierReference(tx, input.tenantId, input, { allowIncomplete: true }),
    getVariantSnapshotMap(tx, input.tenantId, input.lines),
    getDocumentLocationReference(input.tenantId, input.locationId ?? parentRef?.location_id ?? null),
  ]);
  const partySnapshot = buildPartySnapshot({
    role: "supplier",
    name: supplierRef.supplierName,
    phone: supplierRef.supplierPhone,
    address: supplierRef.supplierAddress,
    taxId: supplierRef.supplierTaxId,
  });

  const normalizedLines = input.lines.map((line) => {
    const variant = variantMap.get(line.variantId);
    if (!variant) {
      throw new BadRequestError("One or more selected items are no longer available");
    }

    const amounts = buildLineAmounts(line);
    return {
      id: line.id,
      variantId: line.variantId,
      itemId: variant.item_id,
      description: line.description.trim(),
      descriptionSnapshot: line.description.trim(),
      itemNameSnapshot: variant.item.name,
      variantNameSnapshot: variant.name ?? "",
      skuSnapshot: variant.sku ?? "",
      barcodeSnapshot: variant.barcode ?? "",
      unitSnapshot: line.unit.trim() || variant.item.unit,
      hsnSacSnapshot: variant.item.hsn_sac ?? "",
      taxModeSnapshot: line.taxMode,
      optionValuesSnapshot: buildOptionSnapshot(variant),
      quantity: amounts.quantity,
      unitPrice: amounts.unitPrice,
      taxRate: amounts.taxRate,
      netAmount: amounts.subTotal,
      taxAmount: amounts.taxTotal,
      grossAmount: amounts.total,
      total: amounts.total,
    };
  });

  const totals = normalizedLines.reduce(
    (summary, line) => ({
      subTotal: toRounded(summary.subTotal + line.netAmount, 2),
      taxTotal: toRounded(summary.taxTotal + line.taxAmount, 2),
      grandTotal: toRounded(summary.grandTotal + line.grossAmount, 2),
    }),
    { subTotal: 0, taxTotal: 0, grandTotal: 0 },
  );

  if (documentId) {
    const existing = await getPurchaseDocumentOrThrow(tx, input.tenantId, input.documentType, documentId);
    if (existing.status !== "DRAFT") {
      throw new BadRequestError(
        `Only draft ${PURCHASE_DOCUMENT_META[input.documentType].singularLabel}s can be edited`,
      );
    }

    await tx.document.update({
      where: { id: documentId },
      data: {
        settlement_mode: usesSettlementMode(input.documentType)
          ? (input.settlementMode ?? "CASH")
          : null,
        doc_number: trimmedBillNumber,
        location_id: locationRef.locationId,
        location_name_snapshot: locationRef.locationName,
        parent_id: parentRef?.id ?? null,
        party_id: supplierRef.partyId,
        party_snapshot: partySnapshot,
        currency: "INR",
        notes: input.notes.trim() || null,
        sub_total: totals.subTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
      },
    });

    await tx.lineItem.deleteMany({
      where: {
        document_id: documentId,
      },
    });

    await tx.lineItem.createMany({
      data: normalizedLines.map((line) => ({
        id: line.id,
        document_id: documentId,
        item_id: line.itemId,
        variant_id: line.variantId,
        description: line.description,
        description_snapshot: line.descriptionSnapshot,
        item_name_snapshot: line.itemNameSnapshot || null,
        variant_name_snapshot: line.variantNameSnapshot || null,
        sku_snapshot: line.skuSnapshot || null,
        barcode_snapshot: line.barcodeSnapshot || null,
        unit_snapshot: line.unitSnapshot || null,
        hsn_sac_snapshot: line.hsnSacSnapshot || null,
        tax_mode_snapshot: line.taxModeSnapshot,
        option_values_snapshot: line.optionValuesSnapshot,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
        net_amount: line.netAmount,
        tax_amount: line.taxAmount,
        gross_amount: line.grossAmount,
        total: line.total,
      })),
    });

    await purchaseDocumentLinkService.upsertLinksForDocument(tx, input.tenantId, documentId, {
      ...Object.fromEntries(input.lines.map((line) => [line.id, line.sourceLineId ?? null])),
    });

    await recordDocumentHistory(tx, {
      tenantId: input.tenantId,
      documentId,
      eventType: "UPDATED",
      actor,
      fromStatus: existing.status,
      toStatus: existing.status,
      metadata: {
        lineCount: normalizedLines.length,
        parentDocumentId: parentRef?.id ?? null,
        locationId: locationRef.locationId,
      },
    });

    const updatedDocument = await getPurchaseDocumentOrThrow(
      tx,
      input.tenantId,
      input.documentType,
      documentId,
    );
    await emitPurchaseReadModelSnapshot(tx, input.tenantId, updatedDocument, {
      isTombstone: updatedDocument.status === "DRAFT" || updatedDocument.status === "VOID",
    });
    return updatedDocument;
  }

  const created = await tx.document.create({
    data: {
      business_id: input.tenantId,
      type: input.documentType,
      status: "DRAFT",
      settlement_mode: usesSettlementMode(input.documentType)
        ? (input.settlementMode ?? "CASH")
        : null,
      doc_number: trimmedBillNumber,
      location_id: locationRef.locationId,
      location_name_snapshot: locationRef.locationName,
      parent_id: parentRef?.id ?? null,
      party_id: supplierRef.partyId,
      party_snapshot: partySnapshot,
      currency: "INR",
      notes: input.notes.trim() || null,
      sub_total: totals.subTotal,
      tax_total: totals.taxTotal,
      grand_total: totals.grandTotal,
      deleted_at: null,
    },
  });

  await tx.lineItem.createMany({
    data: normalizedLines.map((line) => ({
      id: line.id,
      document_id: created.id,
      item_id: line.itemId,
      variant_id: line.variantId,
      description: line.description,
      description_snapshot: line.descriptionSnapshot,
      item_name_snapshot: line.itemNameSnapshot || null,
      variant_name_snapshot: line.variantNameSnapshot || null,
      sku_snapshot: line.skuSnapshot || null,
      barcode_snapshot: line.barcodeSnapshot || null,
      unit_snapshot: line.unitSnapshot || null,
      hsn_sac_snapshot: line.hsnSacSnapshot || null,
      tax_mode_snapshot: line.taxModeSnapshot,
      option_values_snapshot: line.optionValuesSnapshot,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      tax_rate: line.taxRate,
      net_amount: line.netAmount,
      tax_amount: line.taxAmount,
      gross_amount: line.grossAmount,
      total: line.total,
      })),
    });

  await purchaseDocumentLinkService.upsertLinksForDocument(tx, input.tenantId, created.id, {
    ...Object.fromEntries(input.lines.map((line) => [line.id, line.sourceLineId ?? null])),
  });

  await recordDocumentHistory(tx, {
    tenantId: input.tenantId,
    documentId: created.id,
    eventType: "CREATED",
    actor,
    toStatus: "DRAFT",
    metadata: {
      lineCount: normalizedLines.length,
      parentDocumentId: parentRef?.id ?? null,
      locationId: locationRef.locationId,
    },
  });

  const createdDocument = await getPurchaseDocumentOrThrow(
    tx,
    input.tenantId,
    input.documentType,
    created.id,
  );
  await emitPurchaseReadModelSnapshot(tx, input.tenantId, createdDocument, {
    isTombstone: createdDocument.status === "DRAFT" || createdDocument.status === "VOID",
  });
  return createdDocument;
};

export const postDraftPurchaseDocument = async (
  tx: PurchaseTransactionClient,
  tenantId: string,
  documentType: PurchaseDocumentType,
  documentId: string,
  actor: DocumentHistoryActor,
  paymentInput?: Omit<PurchaseDocumentPostInput, "tenantId" | "documentType">,
) => {
  const document = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
  if (document.status !== "DRAFT") {
    throw new BadRequestError(
      `Only draft ${PURCHASE_DOCUMENT_META[documentType].singularLabel}s can be posted`,
    );
  }
  if (document.lineItems.length === 0) {
    throw new BadRequestError(
      `Add at least one ${PURCHASE_DOCUMENT_META[documentType].singularLabel} line before posting`,
    );
  }

  const partySnapshot = parsePartySnapshot(document.party_snapshot);
  if (!partySnapshot?.name.trim()) {
    throw new BadRequestError(
      `${PURCHASE_DOCUMENT_META[documentType].singularLabel} requires supplier details`,
    );
  }
  if (document.settlement_mode === "CREDIT" && !document.party_id) {
    throw new BadRequestError(
      `${PURCHASE_DOCUMENT_META[documentType].singularLabel} requires an existing supplier for credit transactions`,
    );
  }

  if (documentType !== "PURCHASE_INVOICE") {
    if (paymentInput?.financialAccountId || paymentInput?.paymentDate || paymentInput?.paymentReference) {
      throw new BadRequestError("Only purchase invoices can include payment details during posting");
    }
  } else if (document.settlement_mode === "CREDIT") {
    if (paymentInput?.financialAccountId || paymentInput?.paymentDate || paymentInput?.paymentReference) {
      throw new BadRequestError(
        "Credit purchase invoices cannot record payment details during posting",
      );
    }
  } else if (document.settlement_mode === "CASH" && !paymentInput?.financialAccountId) {
    throw new BadRequestError("Select the account used for payment before posting this cash invoice");
  }

  await purchaseDocumentLinkService.upsertLinksForDocument(
    tx,
    tenantId,
    documentId,
    buildSourceLineMap(document),
  );
  await purchaseStockPostingService.applyPostingEffects(tx, tenantId, documentId);

  const postedAt = new Date();
  await tx.document.update({
    where: { id: documentId },
    data: {
      status: "OPEN",
      posted_at: postedAt,
    },
  });

  await recordDocumentHistory(tx, {
    tenantId,
    documentId,
    eventType: "STATUS_CHANGED",
    actor,
    fromStatus: "DRAFT",
    toStatus: "OPEN",
    metadata: {
      reason: "POSTED",
    },
  });

  if (documentType === "PURCHASE_INVOICE" && document.settlement_mode === "CASH") {
    const payment = await accountsService.createMadePayment(
      tenantId,
      {
        occurredAt: paymentInput?.paymentDate ?? postedAt.toISOString(),
        amount: Number(document.grand_total ?? 0),
        financialAccountId: paymentInput!.financialAccountId!,
        partyId: document.party_id ?? undefined,
        referenceNo: paymentInput?.paymentReference?.trim() || undefined,
        notes: `Auto-payment for Purchase Invoice: ${document.doc_number}`,
        allocations: [
          {
            documentType: "PURCHASE_INVOICE",
            documentId: document.id,
            allocatedAmount: Number(document.grand_total ?? 0),
          },
        ],
      },
      tx as any,
    );

    await recordDocumentHistory(tx, {
      tenantId,
      documentId,
      eventType: "STATUS_CHANGED",
      actor,
      fromStatus: "OPEN",
      toStatus: "OPEN",
      metadata: {
        reason: "AUTO_PAYMENT_RECORDED",
        paymentAccountName:
          typeof payment.account_name === "string" && payment.account_name.trim()
            ? payment.account_name
            : null,
        paymentReference: payment.reference_no ?? null,
        paymentOccurredAt: payment.occurred_at instanceof Date ? payment.occurred_at.toISOString() : null,
      },
    });
  }

  if (document.parent_id) {
    const parent = await tx.document.findFirst({
      where: {
        id: document.parent_id,
        business_id: tenantId,
        deleted_at: null,
      },
      select: {
        id: true,
        type: true,
        doc_number: true,
      },
    });

    if (parent) {
      await recordDocumentHistory(tx, {
        tenantId,
        documentId,
        eventType: "CONVERSION_LINKED",
        actor,
        fromStatus: "OPEN",
        toStatus: "OPEN",
        metadata: {
          direction: "FROM_SOURCE",
          sourceDocumentId: parent.id,
          sourceDocumentType: parent.type,
          sourceDocumentNumber: parent.doc_number,
        },
      });
      await recordDocumentHistory(tx, {
        tenantId,
        documentId: parent.id,
        eventType: "CONVERSION_LINKED",
        actor,
        fromStatus: null,
        toStatus: null,
        metadata: {
          direction: "TO_TARGET",
          targetDocumentId: document.id,
          targetDocumentType: document.type,
          targetDocumentNumber: document.doc_number,
        },
      });
    }
  }

  await syncParentConversionStatus(tx, tenantId, actor, document.parent_id, {
    sourceDocumentId: document.id,
    sourceDocumentType: document.type,
    sourceDocumentNumber: document.doc_number,
  });

  const postedDocument = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
  await emitPurchaseReadModelSnapshot(tx, tenantId, postedDocument, {
    isTombstone: postedDocument.status === "DRAFT" || postedDocument.status === "VOID",
  });
  return postedDocument;
};

export const transitionPurchaseDocumentState = async (
  tx: PurchaseTransactionClient,
  tenantId: string,
  documentType: PurchaseDocumentType,
  documentId: string,
  action: PurchaseDocumentAction,
  actor: DocumentHistoryActor,
  cancelReason?: PurchaseDocumentCancelReason | null,
) => {
  const document = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);

  if (action === "CANCEL") {
    if (!["OPEN", "PARTIAL"].includes(document.status)) {
      throw new BadRequestError(
        `Only open ${PURCHASE_DOCUMENT_META[documentType].pluralLabel} can be cancelled`,
      );
    }
    if (!cancelReason) {
      throw new BadRequestError("Cancel reason is required");
    }

    let voidedPaymentMovements: Array<{
      id: string;
      referenceNo: string;
      notes: string;
      occurredAt: string;
      accountName: string;
    }> =
      [];
    if (document.type === "PURCHASE_INVOICE") {
      voidedPaymentMovements = await accountsService.voidMoneyMovementsForSourceDocument(
        tenantId,
        "PURCHASE_INVOICE",
        documentId,
        tx as any,
      );
    }

    await purchaseStockPostingService.applyCancellationEffects(tx, tenantId, documentId);

    await tx.document.update({
      where: { id: documentId },
      data: {
        status: "CANCELLED",
        cancel_reason: cancelReason,
      },
    });

    await recordDocumentHistory(tx, {
      tenantId,
      documentId,
      eventType: "STATUS_CHANGED",
      actor,
      fromStatus: document.status,
      toStatus: "CANCELLED",
      metadata: {
        reason: "CANCELLED",
        cancelReason,
        voidedPaymentAccountNames: voidedPaymentMovements
          .map((movement) => movement.accountName)
          .filter((value, index, collection) => value && collection.indexOf(value) === index),
      },
    });

    if (voidedPaymentMovements.length > 0) {
      await recordDocumentHistory(tx, {
        tenantId,
        documentId,
        eventType: "STATUS_CHANGED",
        actor,
        fromStatus: "CANCELLED",
        toStatus: "CANCELLED",
        metadata: {
          reason: "AUTO_PAYMENT_VOIDED",
          paymentAccountNames: voidedPaymentMovements
            .map((movement) => movement.accountName)
            .filter((value, index, collection) => value && collection.indexOf(value) === index),
        },
      });
    }

    await syncParentConversionStatus(tx, tenantId, actor, document.parent_id, {
      sourceDocumentId: document.id,
      sourceDocumentType: document.type,
      sourceDocumentNumber: document.doc_number,
    });

    const cancelledDocument = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
    await emitPurchaseReadModelSnapshot(tx, tenantId, cancelledDocument, {
      isTombstone: cancelledDocument.status === "DRAFT" || cancelledDocument.status === "VOID",
    });
    return cancelledDocument;
  }

  if (action === "VOID") {
    if (document.posted_at) {
      throw new BadRequestError(
        `Posted ${PURCHASE_DOCUMENT_META[documentType].pluralLabel} cannot be voided`,
      );
    }

    if (!["OPEN", "PARTIAL"].includes(document.status)) {
      throw new BadRequestError(
        `Only open ${PURCHASE_DOCUMENT_META[documentType].pluralLabel} can be voided`,
      );
    }

    await tx.document.update({
      where: { id: documentId },
      data: {
        status: "VOID",
        cancel_reason: null,
      },
    });

    await recordDocumentHistory(tx, {
      tenantId,
      documentId,
      eventType: "STATUS_CHANGED",
      actor,
      fromStatus: document.status,
      toStatus: "VOID",
      metadata: {
        reason: "VOIDED",
      },
    });

    await syncParentConversionStatus(tx, tenantId, actor, document.parent_id, {
      sourceDocumentId: document.id,
      sourceDocumentType: document.type,
      sourceDocumentNumber: document.doc_number,
    });

    const voidedDocument = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
    await emitPurchaseReadModelSnapshot(tx, tenantId, voidedDocument, {
      isTombstone: voidedDocument.status === "DRAFT" || voidedDocument.status === "VOID",
    });
    return voidedDocument;
  }

  if (document.status !== "CANCELLED") {
    throw new BadRequestError(
      `Only cancelled ${PURCHASE_DOCUMENT_META[documentType].singularLabel}s can be reopened`,
    );
  }
  if (!document.posted_at) {
    throw new BadRequestError(
      `Only posted ${PURCHASE_DOCUMENT_META[documentType].singularLabel}s can be reopened`,
    );
  }

  if (document.type === "PURCHASE_INVOICE") {
    const activeLinkedPayments = await accountsService.listPostedMoneyMovementsForSourceDocument(
      tenantId,
      "PURCHASE_INVOICE",
      documentId,
      tx as any,
    );
    if (activeLinkedPayments.length > 0) {
      throw new BadRequestError(
        "This purchase invoice cannot be reopened while linked payments remain posted",
      );
    }
  }

  await purchaseStockPostingService.applyReopenEffects(tx, tenantId, documentId);

  await tx.document.update({
    where: { id: documentId },
    data: {
      status: "OPEN",
      cancel_reason: null,
    },
  });

  await recordDocumentHistory(tx, {
    tenantId,
    documentId,
    eventType: "STATUS_CHANGED",
    actor,
    fromStatus: document.status,
    toStatus: "OPEN",
    metadata: {
      reason: "REOPENED",
    },
  });

  await syncParentConversionStatus(tx, tenantId, actor, document.parent_id, {
    sourceDocumentId: document.id,
    sourceDocumentType: document.type,
    sourceDocumentNumber: document.doc_number,
  });

  const reopenedDocument = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
  await emitPurchaseReadModelSnapshot(tx, tenantId, reopenedDocument, {
    isTombstone: reopenedDocument.status === "DRAFT" || reopenedDocument.status === "VOID",
  });
  return reopenedDocument;
};

export const listPurchaseDocuments = catchAsync(async (req, res) => {
  const { tenantId, documentType, limit = 50 } = req.query as {
    tenantId: string;
    documentType: PurchaseDocumentType;
    limit?: number;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);

  const documents = await prisma.document.findMany({
    where: {
      business_id: tenantId,
      type: documentType,
      deleted_at: null,
    },
    include: {
      parent: {
        select: {
          id: true,
          doc_number: true,
        },
      },
      children: {
        where: {
          deleted_at: null,
        },
        orderBy: {
          created_at: "asc",
        },
        select: {
          id: true,
        },
      },
      lineItems: {
        orderBy: {
          id: "asc",
        },
        include: {
          target_links: {
            orderBy: {
              id: "asc",
            },
            select: {
              source_line_id: true,
            },
          },
        },
      },
    },
    orderBy: {
      updated_at: "desc",
    },
    take: Number(limit),
  });

  res.json(
    toPurchaseDocumentListView(
      await enrichPurchaseDocumentsWithSettlement(tenantId, mapPurchaseDocuments(documents)),
    ),
  );
});

export const getPurchaseOverview = catchAsync(async (req, res) => {
  const tenantId = req.user.tenantId;
  const { locationId } = req.query as { locationId?: string };
  if (!tenantId) {
    throw new ForbiddenError("Select a business to continue");
  }
  if (locationId) {
    const location = await tenantService.validateBusinessLocation(tenantId, locationId);
    if (!location) {
      throw new BadRequestError("Selected location is not available");
    }
  }

  const overview = await getPurchaseOverviewService(tenantId, locationId);

  res.json(toPurchaseOverviewView(overview as unknown as Record<string, unknown>));
});

export const getPurchaseDocumentHistory = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType } = req.query as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  await getPurchaseDocumentOrThrow(prisma, tenantId, documentType, documentId);

  const entries = await prisma.documentHistory.findMany({
    where: {
      business_id: tenantId,
      document_id: documentId,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  res.json(toPurchaseDocumentHistoryView(mapDocumentHistoryEntries(entries)));
});

export const getPurchaseConversionBalance = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId } = req.query as { tenantId: string };

  const sourceDocument = await prisma.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      deleted_at: null,
      type: {
        in: ["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE"],
      },
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!sourceDocument) {
    throw new NotFoundError("Source document not found");
  }

  await assertPurchaseAccess(req.user.id, tenantId, sourceDocument.type as PurchaseDocumentType);
  const sourceDocumentType = sourceDocument.type as PurchaseDocumentType;
  const lineBalances =
    sourceDocumentType === "PURCHASE_ORDER"
      ? await purchaseBalanceService.getReceiptLineBalances(prisma, tenantId, sourceDocument.id)
      : sourceDocumentType === "GOODS_RECEIPT_NOTE"
        ? await purchaseBalanceService.getInvoiceableLineBalances(prisma, tenantId, sourceDocument.id)
        : await purchaseBalanceService.getLineBalances(prisma, tenantId, sourceDocument.id, "RETURN");

  res.json(
    toPurchaseConversionBalanceView(
      lineBalances.map((line) => ({
        sourceLineId: line.sourceLineId,
        itemId: line.itemId,
        variantId: line.variantId,
        description: line.description,
        unitPrice: formatDecimalString(line.unitPrice),
        taxRate: line.taxRate > 0 ? `${line.taxRate}%` : "0%",
        taxMode: line.taxMode,
        unit: line.unit,
        originalQuantity: formatDecimalString(line.originalQuantity),
        remainingQuantity: formatDecimalString(line.remainingQuantity),
      })),
    ),
  );
});

export const createPurchaseDocument = catchAsync(async (req, res) => {
  const input = req.body as PurchaseDocumentInput;

  await assertPurchaseAccess(req.user.id, input.tenantId, input.documentType);

  const document = await prisma.$transaction((tx) =>
    saveDraftPurchaseDocument(tx, null, input, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }),
  );

  res.json(
    toPurchaseDocumentPayload(
      (await enrichPurchaseDocumentsWithSettlement(input.tenantId, mapPurchaseDocuments([document])))[0],
    ),
  );
});

export const updatePurchaseDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const input = req.body as PurchaseDocumentInput;

  await assertPurchaseAccess(req.user.id, input.tenantId, input.documentType);

  const document = await prisma.$transaction((tx) =>
    saveDraftPurchaseDocument(tx, documentId, input, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }),
  );

  res.json(
    toPurchaseDocumentPayload(
      (await enrichPurchaseDocumentsWithSettlement(input.tenantId, mapPurchaseDocuments([document])))[0],
    ),
  );
});

export const postPurchaseDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType, financialAccountId, paymentReference, paymentDate } =
    req.body as PurchaseDocumentPostInput;

  await assertPurchaseAccess(req.user.id, tenantId, documentType);

  const document = await prisma.$transaction((tx) =>
    postDraftPurchaseDocument(tx, tenantId, documentType, documentId, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }, {
      financialAccountId,
      paymentReference,
      paymentDate,
    }),
  );

  res.json(
    toPurchaseDocumentPayload(
      (await enrichPurchaseDocumentsWithSettlement(tenantId, mapPurchaseDocuments([document])))[0],
    ),
  );
});

export const transitionPurchaseDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType, action, cancelReason } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
    action: PurchaseDocumentAction;
    cancelReason?: PurchaseDocumentCancelReason | null;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);

  const document = await prisma.$transaction((tx) =>
    transitionPurchaseDocumentState(
      tx,
      tenantId,
      documentType,
      documentId,
      action,
      {
        userId: req.user.id,
        name: req.user.name ?? null,
      },
      cancelReason,
    ),
  );

  res.json(
    toPurchaseDocumentPayload(
      (await enrichPurchaseDocumentsWithSettlement(tenantId, mapPurchaseDocuments([document])))[0],
    ),
  );
});

export const deletePurchaseDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);

  await prisma.$transaction(async (tx) => {
    const document = await getPurchaseDocumentOrThrow(tx, tenantId, documentType, documentId);
    if (document.status !== "DRAFT") {
      throw new BadRequestError(
        `Only draft ${PURCHASE_DOCUMENT_META[documentType].singularLabel}s can be deleted`,
      );
    }

    await tx.lineItem.deleteMany({
      where: {
        document_id: documentId,
      },
    });

    await tx.document.delete({
      where: {
        id: documentId,
      },
    });

    await emitPurchaseReadModelSnapshot(tx, tenantId, { id: documentId }, { isTombstone: true });
  });

  res.json({ success: true });
});
