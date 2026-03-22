import { prisma } from "../../lib/prisma.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { successResponse } from "../../shared/http/response-mappers.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/utils/errors.js";
import { getBusinessCapabilitiesFromLicense } from "../license/license.service.js";
import {
  mapDocumentHistoryEntries,
  recordDocumentHistory,
  type DocumentHistoryActor,
  type DocumentHistoryMetadata,
} from "./document-history.service.js";
import { documentLinkService } from "./document-link.service.js";
import { stockPostingService } from "./stock-posting.service.js";
import { salesBalanceService } from "./sales-balance.service.js";
import type {
  SalesDocumentAction,
  SalesDocumentCancelReason,
  SalesDocumentInput,
  SalesDocumentType,
  SalesLineInput,
  SalesTransactionClient,
} from "./sales.types.js";

type SalesDocumentRecord = Awaited<ReturnType<typeof getDocumentOrThrow>>;
type PartySnapshot = {
  role: "customer" | "supplier";
  name: string;
  phone: string | null;
  address: string | null;
  taxId: string | null;
};

const SALES_DOCUMENT_META: Record<
  SalesDocumentType,
  {
    prefix: string;
    singularLabel: string;
    pluralLabel: string;
    notFoundLabel: string;
    duplicateLabel: string;
  }
> = {
  SALES_ESTIMATE: {
    prefix: "EST-",
    singularLabel: "estimate",
    pluralLabel: "estimates",
    notFoundLabel: "Sales estimate not found",
    duplicateLabel: "Estimate number already exists",
  },
  SALES_ORDER: {
    prefix: "SO-",
    singularLabel: "sales order",
    pluralLabel: "sales orders",
    notFoundLabel: "Sales order not found",
    duplicateLabel: "Sales order number already exists",
  },
  DELIVERY_CHALLAN: {
    prefix: "DC-",
    singularLabel: "delivery challan",
    pluralLabel: "delivery challans",
    notFoundLabel: "Delivery challan not found",
    duplicateLabel: "Delivery challan number already exists",
  },
  SALES_INVOICE: {
    prefix: "INV-",
    singularLabel: "invoice",
    pluralLabel: "invoices",
    notFoundLabel: "Sales invoice not found",
    duplicateLabel: "Invoice number already exists",
  },
  SALES_RETURN: {
    prefix: "SRN-",
    singularLabel: "sales return",
    pluralLabel: "sales returns",
    notFoundLabel: "Sales return not found",
    duplicateLabel: "Sales return number already exists",
  },
};

const SALES_DOCUMENT_CONVERSION_RULES: Partial<
  Record<SalesDocumentType, SalesDocumentType[]>
> = {
  SALES_ESTIMATE: ["SALES_ORDER", "SALES_INVOICE"],
  SALES_ORDER: ["DELIVERY_CHALLAN", "SALES_INVOICE"],
  DELIVERY_CHALLAN: ["SALES_INVOICE", "SALES_RETURN"],
  SALES_INVOICE: ["SALES_RETURN"],
};

const usesTransactionType = (documentType: SalesDocumentType) =>
  documentType === "SALES_INVOICE";

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

  if ((role !== "customer" && role !== "supplier") || !name.trim()) {
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

const requiresCustomerDetails = (documentType: SalesDocumentType) =>
  documentType !== "SALES_INVOICE";

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

const buildLineAmounts = (line: SalesLineInput) => {
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

const parseDocumentNumberSequence = (value: string, prefix: string) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(value.trim().toUpperCase());
  if (!match) {
    return null;
  }

  return Number(match[1]);
};

const formatDocumentNumber = (documentType: SalesDocumentType, sequence: number) => {
  const meta = SALES_DOCUMENT_META[documentType];
  return `${meta.prefix}${String(sequence).padStart(4, "0")}`;
};

const parseOptionalDateInput = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestError(`${field} must be a valid date`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) {
    throw new BadRequestError(`${field} must be a valid date`);
  }

  return parsed;
};

const formatOptionalDateOutput = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : "";

const getDocumentMetadata = (input: SalesDocumentInput) => ({
  validUntil:
    input.documentType === "SALES_ESTIMATE"
      ? parseOptionalDateInput(input.validUntil, "Validity date")
      : null,
  dispatchDate:
    input.documentType === "DELIVERY_CHALLAN"
      ? parseOptionalDateInput(input.dispatchDate, "Dispatch date")
      : null,
  dispatchCarrier:
    input.documentType === "DELIVERY_CHALLAN" ? input.dispatchCarrier.trim() || null : null,
  dispatchReference:
    input.documentType === "DELIVERY_CHALLAN" ? input.dispatchReference.trim() || null : null,
});

const getSalesCapabilityRequired = (documentType: SalesDocumentType) =>
  documentType === "SALES_RETURN" ? "TXN_SALE_RETURN" : "TXN_SALE_CREATE";

const assertSalesAccess = async (
  userId: string,
  tenantId: string,
  documentType: SalesDocumentType,
) => {
  const member = await tenantService.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const capabilities = await getBusinessCapabilitiesFromLicense(tenantId);
  const requiredCapability = getSalesCapabilityRequired(documentType);
  if (!capabilities.includes(requiredCapability)) {
    throw new ForbiddenError("Sales module is not enabled for this store license");
  }
};

const getSuggestedDocumentNumber = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: SalesDocumentType,
  excludedDocumentId?: string,
) => {
  const meta = SALES_DOCUMENT_META[documentType];
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
  documentType: SalesDocumentType,
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
    const suggested = await getSuggestedDocumentNumber(
      tx,
      tenantId,
      documentType,
      excludedDocumentId,
    );
    throw new ConflictError(SALES_DOCUMENT_META[documentType].duplicateLabel, {
      reasonCode: "DOCUMENT_NUMBER_CONFLICT",
      details: {
        requested: billNumber,
        suggested,
      },
    });
  }
};

const getCustomerReference = async (
  tx: Pick<typeof prisma, "party">,
  tenantId: string,
  input: Pick<
    SalesDocumentInput,
    | "customerId"
    | "customerName"
    | "customerPhone"
    | "customerAddress"
    | "customerGstNo"
    | "transactionType"
    | "documentType"
  >,
  options?: {
    allowIncomplete?: boolean;
  },
) => {
  const normalizedTransactionType = usesTransactionType(input.documentType)
    ? input.transactionType ?? "CASH"
    : null;
  const customerId = input.customerId ?? null;
  if (!customerId) {
    if (normalizedTransactionType === "CREDIT") {
      throw new BadRequestError(
        `${SALES_DOCUMENT_META[input.documentType].singularLabel} requires an existing customer for credit transactions`,
      );
    }
    if (
      !options?.allowIncomplete &&
      requiresCustomerDetails(input.documentType) &&
      !input.customerName.trim()
    ) {
      throw new BadRequestError(
        `${SALES_DOCUMENT_META[input.documentType].singularLabel} requires customer details`,
      );
    }

    return {
      partyId: null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerAddress: input.customerAddress.trim(),
      customerGstNo: input.customerGstNo.trim(),
    };
  }

  const party = await tx.party.findFirst({
    where: {
      id: customerId,
      business_id: tenantId,
      deleted_at: null,
      is_active: true,
      type: {
        in: ["CUSTOMER", "BOTH"],
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
      `Selected customer is not available for this ${SALES_DOCUMENT_META[input.documentType].singularLabel}`,
    );
  }

  return {
    partyId: party.id,
    customerName: party.name,
    customerPhone: party.phone ?? "",
    customerAddress: party.address ?? "",
    customerGstNo: party.tax_id ?? "",
  };
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
  lines: Array<Pick<SalesLineInput, "variantId">>,
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

const getDocumentOrThrow = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: SalesDocumentType,
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
    throw new NotFoundError(SALES_DOCUMENT_META[documentType].notFoundLabel);
  }

  return document;
};

const getParentDocumentReference = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  documentType: SalesDocumentType,
  parentId?: string | null,
) => {
  if (!parentId) {
    if (documentType === "SALES_RETURN") {
      throw new BadRequestError("Sales return must reference a posted invoice or delivery challan");
    }

    return null;
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
      location_id: true,
    },
  });

  if (!parent) {
    throw new BadRequestError("Selected source document is no longer available");
  }

  const allowedChildren = SALES_DOCUMENT_CONVERSION_RULES[
    parent.type as SalesDocumentType
  ];
  if (!allowedChildren?.includes(documentType)) {
    throw new BadRequestError(
      `${SALES_DOCUMENT_META[documentType].singularLabel} cannot be converted from this source document`,
    );
  }

  return parent;
};

const getConversionBalanceForDocument = async (
  tx: SalesTransactionClient,
  tenantId: string,
  documentId: string,
) => {
  const sourceDocument = await tx.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      deleted_at: null,
      type: {
        in: ["SALES_ESTIMATE", "SALES_ORDER", "DELIVERY_CHALLAN", "SALES_INVOICE"],
      },
    },
    select: {
      id: true,
      type: true,
      doc_number: true,
    },
  });

  if (!sourceDocument) {
    throw new NotFoundError("Source document not found");
  }

  const sourceDocumentType = sourceDocument.type as SalesDocumentType;
  const lineBalances =
    sourceDocumentType === "SALES_ORDER"
      ? await salesBalanceService.getShipmentLineBalances(tx, tenantId, sourceDocument.id)
      : sourceDocumentType === "DELIVERY_CHALLAN"
        ? await salesBalanceService.getInvoiceableLineBalances(tx, tenantId, sourceDocument.id)
        : sourceDocumentType === "SALES_INVOICE"
          ? await salesBalanceService.getLineBalances(tx, tenantId, sourceDocument.id, "RETURN")
          : await salesBalanceService.getLineBalances(tx, tenantId, sourceDocument.id, "FULFILLMENT");

  return successResponse({
    documentId: sourceDocument.id,
    documentType: sourceDocumentType,
    documentNumber: sourceDocument.doc_number,
    lines: lineBalances.map((line) => ({
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
  });
};

const syncParentConversionStatus = async (
  tx: SalesTransactionClient,
  tenantId: string,
  actor: DocumentHistoryActor,
  parentId?: string | null,
  metadata?: DocumentHistoryMetadata,
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
      grand_total: true,
    },
  });

  if (
    !parent ||
    ["CANCELLED", "VOID", "EXPIRED"].includes(parent.status as string)
  ) {
    return;
  }
  if (!parent.posted_at) {
    return;
  }

  const eligibleChildTypes =
    SALES_DOCUMENT_CONVERSION_RULES[parent.type as SalesDocumentType];
  if (!eligibleChildTypes?.length) {
    return;
  }

  const parentType = parent.type as SalesDocumentType;
  if (!["SALES_ESTIMATE", "SALES_ORDER"].includes(parentType)) {
    return;
  }

  const lineBalances =
    parentType === "SALES_ORDER"
      ? await salesBalanceService.getShipmentLineBalances(tx, tenantId, parent.id)
      : await salesBalanceService.getLineBalances(tx, tenantId, parent.id, "FULFILLMENT");
  const hasAnyConsumption = lineBalances.some(
    (line) => line.fulfilledQuantity > 0 || line.returnedQuantity > 0,
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

const mapSalesDocuments = (documents: SalesDocumentRecord[]) =>
  documents.map((document) => {
    const partySnapshot = parsePartySnapshot(document.party_snapshot);

    return {
      id: document.id,
      documentType: document.type as SalesDocumentType,
      parentId: document.parent_id ?? null,
      parentDocumentNumber: document.parent?.doc_number ?? null,
      childIds: document.children.map((child) => child.id),
      status: document.status,
      cancelReason: document.cancel_reason ?? null,
      postedAt: document.posted_at?.toISOString() ?? null,
      billNumber: document.doc_number,
      locationId: document.location_id ?? null,
      locationName: document.location_name_snapshot ?? "",
      transactionType: document.settlement_mode ?? "CASH",
      customerId: document.party_id ?? null,
      customerName: partySnapshot?.name ?? "",
      customerPhone: partySnapshot?.phone ?? "",
      customerAddress: partySnapshot?.address ?? "",
      customerGstNo: partySnapshot?.taxId ?? "",
      validUntil: formatOptionalDateOutput(document.valid_until),
      dispatchDate: formatOptionalDateOutput(document.dispatch_date),
      dispatchCarrier: document.dispatch_carrier ?? "",
      dispatchReference: document.dispatch_reference ?? "",
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
        stockOnHand: null,
      })),
    };
  });

const buildSourceLineMap = (document: SalesDocumentRecord) =>
  Object.fromEntries(
    document.lineItems.map((line) => [line.id, line.target_links[0]?.source_line_id ?? null]),
  );

const toSalesDocumentListView = (documents: ReturnType<typeof mapSalesDocuments>) =>
  successResponse({
    documents,
  });

const toSalesDocumentPayload = (document: ReturnType<typeof mapSalesDocuments>[number]) =>
  successResponse({
    document,
  });

const saveDraftDocument = async (
  tx: SalesTransactionClient,
  documentId: string | null,
  input: SalesDocumentInput,
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
  const [customerRef, variantMap, locationRef] = await Promise.all([
    getCustomerReference(tx, input.tenantId, input, { allowIncomplete: true }),
    getVariantSnapshotMap(tx, input.tenantId, input.lines),
    getDocumentLocationReference(
      input.tenantId,
      input.documentType === "SALES_RETURN" && !input.locationId
        ? (parentRef?.location_id ?? null)
        : input.locationId,
    ),
  ]);
  const metadata = getDocumentMetadata(input);
  const partySnapshot = buildPartySnapshot({
    role: "customer",
    name: customerRef.customerName,
    phone: customerRef.customerPhone,
    address: customerRef.customerAddress,
    taxId: customerRef.customerGstNo,
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
    const existing = await getDocumentOrThrow(tx, input.tenantId, input.documentType, documentId);
    if (existing.status !== "DRAFT") {
      throw new BadRequestError(`Only draft ${SALES_DOCUMENT_META[input.documentType].singularLabel}s can be edited`);
    }
    if (parentRef?.id === documentId) {
      throw new BadRequestError("Document cannot reference itself as its source");
    }

    await tx.document.update({
      where: { id: documentId },
      data: {
        settlement_mode: usesTransactionType(input.documentType)
          ? (input.transactionType ?? "CASH")
          : null,
        doc_number: trimmedBillNumber,
        location_id: locationRef.locationId,
        location_name_snapshot: locationRef.locationName,
        parent_id: parentRef?.id ?? null,
        party_id: customerRef.partyId,
        party_snapshot: partySnapshot,
        valid_until: metadata.validUntil,
        dispatch_date: metadata.dispatchDate,
        dispatch_carrier: metadata.dispatchCarrier,
        dispatch_reference: metadata.dispatchReference,
        currency: "INR",
        notes: input.notes.trim() || null,
        shipping_addr: customerRef.customerAddress || null,
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

    await documentLinkService.upsertLinksForDocument(tx, input.tenantId, documentId, {
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

    return getDocumentOrThrow(tx, input.tenantId, input.documentType, documentId);
  }

  const created = await tx.document.create({
    data: {
      business_id: input.tenantId,
      type: input.documentType,
      status: "DRAFT",
      settlement_mode: usesTransactionType(input.documentType)
        ? (input.transactionType ?? "CASH")
        : null,
      doc_number: trimmedBillNumber,
      location_id: locationRef.locationId,
      location_name_snapshot: locationRef.locationName,
      parent_id: parentRef?.id ?? null,
      party_id: customerRef.partyId,
      party_snapshot: partySnapshot,
      valid_until: metadata.validUntil,
      dispatch_date: metadata.dispatchDate,
      dispatch_carrier: metadata.dispatchCarrier,
      dispatch_reference: metadata.dispatchReference,
      currency: "INR",
      notes: input.notes.trim() || null,
      shipping_addr: customerRef.customerAddress || null,
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

  await documentLinkService.upsertLinksForDocument(tx, input.tenantId, created.id, {
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

  return getDocumentOrThrow(tx, input.tenantId, input.documentType, created.id);
};

export const postDraftDocument = async (
  tx: SalesTransactionClient,
  tenantId: string,
  documentType: SalesDocumentType,
  documentId: string,
  actor: DocumentHistoryActor,
) => {
  const document = await getDocumentOrThrow(tx, tenantId, documentType, documentId);
  if (document.status !== "DRAFT") {
    throw new BadRequestError(
      `Only draft ${SALES_DOCUMENT_META[documentType].singularLabel}s can be posted`,
    );
  }
  if (document.lineItems.length === 0) {
    throw new BadRequestError(
      `Add at least one ${SALES_DOCUMENT_META[documentType].singularLabel} line before posting`,
    );
  }
  const partySnapshot = parsePartySnapshot(document.party_snapshot);

  if (document.type !== "SALES_INVOICE" && !partySnapshot?.name.trim()) {
    throw new BadRequestError(
      `${SALES_DOCUMENT_META[documentType].singularLabel} requires customer details`,
    );
  }
  if (document.settlement_mode === "CREDIT" && !document.party_id) {
    throw new BadRequestError(
      `${SALES_DOCUMENT_META[documentType].singularLabel} requires an existing customer for credit transactions`,
    );
  }

  await documentLinkService.upsertLinksForDocument(
    tx,
    tenantId,
    documentId,
    buildSourceLineMap(document),
  );
  await stockPostingService.applyPostingEffects(tx, tenantId, documentId);

  await tx.document.update({
    where: { id: documentId },
    data: {
      status: "OPEN",
      posted_at: new Date(),
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

  return getDocumentOrThrow(tx, tenantId, documentType, documentId);
};

export const transitionDocumentState = async (
  tx: SalesTransactionClient,
  tenantId: string,
  documentType: SalesDocumentType,
  documentId: string,
  action: SalesDocumentAction,
  actor: DocumentHistoryActor,
  cancelReason?: SalesDocumentCancelReason | null,
) => {
  const document = await getDocumentOrThrow(tx, tenantId, documentType, documentId);

  if (action === "CANCEL") {
    if (!["OPEN", "PARTIAL"].includes(document.status)) {
      throw new BadRequestError(
        `Only open ${SALES_DOCUMENT_META[documentType].pluralLabel} can be cancelled`,
      );
    }
    if (!cancelReason) {
      throw new BadRequestError("Cancel reason is required");
    }

    await stockPostingService.applyCancellationEffects(tx, tenantId, documentId);

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
      },
    });

    await syncParentConversionStatus(tx, tenantId, actor, document.parent_id, {
      sourceDocumentId: document.id,
      sourceDocumentType: document.type,
      sourceDocumentNumber: document.doc_number,
    });

    return getDocumentOrThrow(tx, tenantId, documentType, documentId);
  }

  if (action === "VOID") {
    if (document.posted_at) {
      throw new BadRequestError(
        `Posted ${SALES_DOCUMENT_META[documentType].pluralLabel} cannot be voided`,
      );
    }

    if (!["OPEN", "PARTIAL"].includes(document.status)) {
      throw new BadRequestError(
        `Only open ${SALES_DOCUMENT_META[documentType].pluralLabel} can be voided`,
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

    return getDocumentOrThrow(tx, tenantId, documentType, documentId);
  }

  if (document.status !== "CANCELLED") {
    throw new BadRequestError(
      `Only cancelled ${SALES_DOCUMENT_META[documentType].singularLabel}s can be reopened`,
    );
  }
  if (!document.posted_at) {
    throw new BadRequestError(
      `Only posted ${SALES_DOCUMENT_META[documentType].singularLabel}s can be reopened`,
    );
  }

  await stockPostingService.applyReopenEffects(tx, tenantId, documentId);

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

  return getDocumentOrThrow(tx, tenantId, documentType, documentId);
};

export const listSalesDocuments = catchAsync(async (req, res) => {
  const { tenantId, documentType, limit = 50 } = req.query as {
    tenantId: string;
    documentType: SalesDocumentType;
    limit?: number;
  };

  await assertSalesAccess(req.user.id, tenantId, documentType);

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

  res.json(toSalesDocumentListView(mapSalesDocuments(documents)));
});

export const getSalesDocumentHistory = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType } = req.query as {
    tenantId: string;
    documentType: SalesDocumentType;
  };

  await assertSalesAccess(req.user.id, tenantId, documentType);
  await getDocumentOrThrow(prisma, tenantId, documentType, documentId);

  const entries = await prisma.documentHistory.findMany({
    where: {
      business_id: tenantId,
      document_id: documentId,
    },
    orderBy: [
      {
        created_at: "desc",
      },
      {
        id: "desc",
      },
    ],
  });

  res.json(
    successResponse({
      history: mapDocumentHistoryEntries(entries),
    }),
  );
});

export const getSalesConversionBalance = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId } = req.query as { tenantId: string };

  const sourceDocument = await prisma.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      deleted_at: null,
    },
    select: {
      type: true,
    },
  });

  if (!sourceDocument) {
    throw new NotFoundError("Source document not found");
  }

  await assertSalesAccess(req.user.id, tenantId, sourceDocument.type as SalesDocumentType);

  res.json(await getConversionBalanceForDocument(prisma, tenantId, documentId));
});

export const createSalesDocument = catchAsync(async (req, res) => {
  const input = req.body as SalesDocumentInput;

  await assertSalesAccess(req.user.id, input.tenantId, input.documentType);

  const document = await prisma.$transaction((tx) =>
    saveDraftDocument(tx, null, input, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }),
  );

  res.json(toSalesDocumentPayload(mapSalesDocuments([document])[0]));
});

export const updateSalesDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const input = req.body as SalesDocumentInput;

  await assertSalesAccess(req.user.id, input.tenantId, input.documentType);

  const document = await prisma.$transaction((tx) =>
    saveDraftDocument(tx, documentId, input, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }),
  );

  res.json(toSalesDocumentPayload(mapSalesDocuments([document])[0]));
});

export const postSalesDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: SalesDocumentType;
  };

  await assertSalesAccess(req.user.id, tenantId, documentType);

  const document = await prisma.$transaction((tx) =>
    postDraftDocument(tx, tenantId, documentType, documentId, {
      userId: req.user.id,
      name: req.user.name ?? null,
    }),
  );

  res.json(toSalesDocumentPayload(mapSalesDocuments([document])[0]));
});

export const transitionSalesDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType, action, cancelReason } = req.body as {
    tenantId: string;
    documentType: SalesDocumentType;
    action: SalesDocumentAction;
    cancelReason?: SalesDocumentCancelReason | null;
  };

  await assertSalesAccess(req.user.id, tenantId, documentType);

  const document = await prisma.$transaction((tx) =>
    transitionDocumentState(
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

  res.json(toSalesDocumentPayload(mapSalesDocuments([document])[0]));
});

export const deleteSalesDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params as { documentId: string };
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: SalesDocumentType;
  };

  await assertSalesAccess(req.user.id, tenantId, documentType);

  await prisma.$transaction(async (tx) => {
    const document = await getDocumentOrThrow(tx, tenantId, documentType, documentId);
    if (document.status !== "DRAFT") {
      throw new BadRequestError(
        `Only draft ${SALES_DOCUMENT_META[documentType].singularLabel}s can be deleted`,
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
  });

  res.json(successResponse());
});
