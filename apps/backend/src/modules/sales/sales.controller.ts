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

type SalesInvoiceLineInput = {
  id: string;
  variantId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  unit: string;
};

type SalesInvoiceInput = {
  tenantId: string;
  billNumber: string;
  transactionType: "CASH" | "CREDIT";
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  notes: string;
  lines: SalesInvoiceLineInput[];
};

type SalesTransactionClient = Parameters<typeof prisma.$transaction>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

type InvoiceRecord = Awaited<ReturnType<typeof getInvoiceOrThrow>>;

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

const buildLineAmounts = (line: SalesInvoiceLineInput) => {
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

const assertSalesAccess = async (userId: string, tenantId: string) => {
  const member = await tenantService.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const capabilities = await getBusinessCapabilitiesFromLicense(tenantId);
  if (!capabilities.includes("TXN_SALE_CREATE")) {
    throw new ForbiddenError("Sales module is not enabled for this store license");
  }
};

const assertUniqueBillNumber = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  billNumber: string,
  excludedInvoiceId?: string,
) => {
  const existing = await tx.document.findFirst({
    where: {
      business_id: tenantId,
      type: "SALES_INVOICE",
      doc_number: billNumber,
      deleted_at: null,
      ...(excludedInvoiceId
        ? {
            id: {
              not: excludedInvoiceId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ConflictError("Invoice number already exists");
  }
};

const getCustomerReference = async (
  tx: Pick<typeof prisma, "party">,
  tenantId: string,
  input: Pick<
    SalesInvoiceInput,
    "customerId" | "customerName" | "customerPhone" | "customerAddress" | "customerGstNo" | "transactionType"
  >,
) => {
  const customerId = input.customerId ?? null;
  if (!customerId) {
    if (input.transactionType === "CREDIT") {
      throw new BadRequestError("Credit invoices require an existing customer");
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
    throw new BadRequestError("Selected customer is not available for this invoice");
  }

  return {
    partyId: party.id,
    customerName: party.name,
    customerPhone: party.phone ?? "",
    customerAddress: party.address ?? "",
    customerGstNo: party.tax_id ?? "",
  };
};

const getVariantSnapshotMap = async (
  tx: Pick<typeof prisma, "itemVariant">,
  tenantId: string,
  lines: Array<Pick<SalesInvoiceLineInput, "variantId">>,
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

const getInvoiceOrThrow = async (
  tx: Pick<typeof prisma, "document">,
  tenantId: string,
  invoiceId: string,
) => {
  const invoice = await tx.document.findFirst({
    where: {
      id: invoiceId,
      business_id: tenantId,
      type: "SALES_INVOICE",
      deleted_at: null,
    },
    include: {
      lineItems: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!invoice) {
    throw new NotFoundError("Sales invoice not found");
  }

  return invoice;
};

const mapSalesInvoices = (invoices: InvoiceRecord[]) =>
  invoices.map((invoice) => ({
    id: invoice.id,
    status: invoice.status,
    postedAt: invoice.posted_at?.toISOString() ?? null,
    billNumber: invoice.doc_number,
    transactionType: invoice.transaction_type ?? "CASH",
    customerId: invoice.party_id ?? null,
    customerName: invoice.customer_name_snapshot ?? "",
    customerPhone: invoice.customer_phone_snapshot ?? "",
    customerAddress: invoice.customer_address_snapshot ?? "",
    customerGstNo: invoice.customer_tax_id_snapshot ?? "",
    notes: invoice.notes ?? "",
    savedAt: invoice.updated_at.toISOString(),
    lines: invoice.lineItems.map((line) => ({
      id: line.id,
      variantId: line.variant_id ?? "",
      description: line.description_snapshot ?? line.description,
      quantity: formatDecimalString(Number(line.quantity)),
      unitPrice: formatDecimalString(Number(line.unit_price)),
      taxRate: Number(line.tax_rate) > 0 ? `${Number(line.tax_rate)}%` : "0%",
      taxMode: line.tax_mode_snapshot === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
      unit: line.unit_snapshot ?? "PCS",
      stockOnHand: null,
    })),
  }));

const toSalesInvoiceListView = (invoices: ReturnType<typeof mapSalesInvoices>) =>
  successResponse({
    invoices,
  });

const toSalesInvoicePayload = (invoice: ReturnType<typeof mapSalesInvoices>[number]) =>
  successResponse({
    invoice,
  });

const saveDraftInvoice = async (
  tx: SalesTransactionClient,
  invoiceId: string | null,
  input: SalesInvoiceInput,
) => {
  const trimmedBillNumber = input.billNumber.trim();
  const uniqueLineIds = new Set(input.lines.map((line) => line.id));
  if (uniqueLineIds.size !== input.lines.length) {
    throw new BadRequestError("Invoice lines must have unique ids");
  }

  await assertUniqueBillNumber(tx, input.tenantId, trimmedBillNumber, invoiceId ?? undefined);

  const [customerRef, variantMap] = await Promise.all([
    getCustomerReference(tx, input.tenantId, input),
    getVariantSnapshotMap(tx, input.tenantId, input.lines),
  ]);

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

  if (invoiceId) {
    const existing = await getInvoiceOrThrow(tx, input.tenantId, invoiceId);
    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only draft invoices can be edited");
    }

    await tx.document.update({
      where: { id: invoiceId },
      data: {
        transaction_type: input.transactionType,
        doc_number: trimmedBillNumber,
        party_id: customerRef.partyId,
        customer_name_snapshot: customerRef.customerName || null,
        customer_phone_snapshot: customerRef.customerPhone || null,
        customer_address_snapshot: customerRef.customerAddress || null,
        customer_tax_id_snapshot: customerRef.customerGstNo || null,
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
        document_id: invoiceId,
      },
    });

    await tx.lineItem.createMany({
      data: normalizedLines.map((line) => ({
        id: line.id,
        document_id: invoiceId,
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

    return getInvoiceOrThrow(tx, input.tenantId, invoiceId);
  }

  const created = await tx.document.create({
    data: {
      business_id: input.tenantId,
      type: "SALES_INVOICE",
      status: "DRAFT",
      transaction_type: input.transactionType,
      doc_number: trimmedBillNumber,
      party_id: customerRef.partyId,
      customer_name_snapshot: customerRef.customerName || null,
      customer_phone_snapshot: customerRef.customerPhone || null,
      customer_address_snapshot: customerRef.customerAddress || null,
      customer_tax_id_snapshot: customerRef.customerGstNo || null,
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

  return getInvoiceOrThrow(tx, input.tenantId, created.id);
};

const postDraftInvoice = async (
  tx: SalesTransactionClient,
  tenantId: string,
  invoiceId: string,
) => {
  const invoice = await getInvoiceOrThrow(tx, tenantId, invoiceId);
  if (invoice.status !== "DRAFT") {
    throw new BadRequestError("Only draft invoices can be posted");
  }
  if (invoice.lineItems.length === 0) {
    throw new BadRequestError("Add at least one invoice line before posting");
  }
  if (invoice.transaction_type === "CREDIT" && !invoice.party_id) {
    throw new BadRequestError("Credit invoices require an existing customer");
  }

  await tx.document.update({
    where: { id: invoiceId },
    data: {
      status: "OPEN",
      posted_at: new Date(),
    },
  });

  return getInvoiceOrThrow(tx, tenantId, invoiceId);
};

export const listSalesInvoices = catchAsync(async (req, res) => {
  const { tenantId, limit = 50 } = req.query as { tenantId: string; limit?: number };

  await assertSalesAccess(req.user.id, tenantId);

  const invoices = await prisma.document.findMany({
    where: {
      business_id: tenantId,
      type: "SALES_INVOICE",
      status: "DRAFT",
      deleted_at: null,
    },
    include: {
      lineItems: {
        orderBy: {
          id: "asc",
        },
      },
    },
    orderBy: {
      updated_at: "desc",
    },
    take: Number(limit),
  });

  res.json(toSalesInvoiceListView(mapSalesInvoices(invoices)));
});

export const createSalesInvoice = catchAsync(async (req, res) => {
  const input = req.body as SalesInvoiceInput;

  await assertSalesAccess(req.user.id, input.tenantId);

  const invoice = await prisma.$transaction((tx) => saveDraftInvoice(tx, null, input));

  res.json(toSalesInvoicePayload(mapSalesInvoices([invoice])[0]));
});

export const updateSalesInvoice = catchAsync(async (req, res) => {
  const { invoiceId } = req.params as { invoiceId: string };
  const input = req.body as SalesInvoiceInput;

  await assertSalesAccess(req.user.id, input.tenantId);

  const invoice = await prisma.$transaction((tx) => saveDraftInvoice(tx, invoiceId, input));

  res.json(toSalesInvoicePayload(mapSalesInvoices([invoice])[0]));
});

export const postSalesInvoice = catchAsync(async (req, res) => {
  const { invoiceId } = req.params as { invoiceId: string };
  const { tenantId } = req.body as { tenantId: string };

  await assertSalesAccess(req.user.id, tenantId);

  const invoice = await prisma.$transaction((tx) => postDraftInvoice(tx, tenantId, invoiceId));

  res.json(toSalesInvoicePayload(mapSalesInvoices([invoice])[0]));
});

export const deleteSalesInvoice = catchAsync(async (req, res) => {
  const { invoiceId } = req.params as { invoiceId: string };
  const { tenantId } = req.body as { tenantId: string };

  await assertSalesAccess(req.user.id, tenantId);

  await prisma.$transaction(async (tx) => {
    const invoice = await getInvoiceOrThrow(tx, tenantId, invoiceId);
    if (invoice.status !== "DRAFT") {
      throw new BadRequestError("Only draft invoices can be deleted");
    }

    await tx.lineItem.deleteMany({
      where: {
        document_id: invoiceId,
      },
    });

    await tx.document.delete({
      where: {
        id: invoiceId,
      },
    });
  });

  res.json(successResponse());
});
