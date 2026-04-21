import { z } from "zod";

const financialAccountTypeSchema = z.enum(["CASH", "BANK", "UPI", "CREDIT_CARD", "OTHER"]);
const moneyMovementSourceKindSchema = z.enum(["PAYMENT_RECEIVED", "PAYMENT_MADE", "EXPENSE", "MANUAL"]);
const financialDocumentTypeSchema = z.enum([
  "SALES_INVOICE",
  "SALES_RETURN",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
]);

const allocationSchema = z.object({
  documentType: financialDocumentTypeSchema,
  documentId: z.uuid(),
  allocatedAmount: z.coerce.number().positive(),
});

const allocationBatchSchema = z
  .array(allocationSchema)
  .max(10)
  .superRefine((allocations, context) => {
    const seen = new Set<string>();
    for (let index = 0; index < allocations.length; index += 1) {
      const allocation = allocations[index];
      if (seen.has(allocation.documentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate allocation rows for the same document are not allowed",
          path: [index, "documentId"],
        });
        continue;
      }
      seen.add(allocation.documentId);
    }
  });

export const accountsOverviewSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
  }),
});

export const listFinancialAccountsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export const createFinancialAccountSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    accountType: financialAccountTypeSchema,
    currency: z.string().trim().length(3).optional().default("INR"),
    openingBalance: z.coerce.number().optional().default(0),
    locationId: z.uuid().optional().nullable(),
  }),
});

export const archiveFinancialAccountSchema = z.object({
  params: z.object({
    accountId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
  }),
});

export const voidMoneyMovementSchema = z.object({
  params: z.object({
    movementId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
  }),
});

export const listMoneyMovementsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    sourceKind: moneyMovementSourceKindSchema.optional(),
    accountId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const paymentCreateSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    occurredAt: z.string().datetime(),
    amount: z.coerce.number().positive(),
    financialAccountId: z.uuid(),
    partyId: z.uuid().optional(),
    referenceNo: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional(),
    allocations: allocationBatchSchema.optional().default([]),
  }),
});

export const allocatePaymentSchema = z.object({
  params: z.object({
    movementId: z.uuid(),
  }),
  body: z.object({
    allocations: allocationBatchSchema.min(1),
  }),
});

export const createExpenseSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    occurredAt: z.string().datetime(),
    amount: z.coerce.number().positive(),
    expenseCategoryId: z.uuid(),
    financialAccountId: z.uuid(),
    payeeName: z.string().trim().min(1).max(120),
    referenceNo: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional(),
    locationId: z.uuid().optional().nullable(),
    partyId: z.uuid().optional().nullable(),
  }),
});

export const listExpensesSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    categoryId: z.uuid().optional(),
    accountId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const listExpenseCategoriesSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export const listOpenDocumentsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    flow: z.enum(["RECEIVABLE", "PAYABLE"]),
    partyId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const documentBalanceSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    documentType: financialDocumentTypeSchema,
    documentId: z.uuid(),
  }),
});

export const partyFinancialSummarySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    partyId: z.uuid(),
    flow: z.enum(["RECEIVABLE", "PAYABLE"]),
  }),
});
