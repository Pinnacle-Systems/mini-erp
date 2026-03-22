import tenantService from "../tenant/tenant.service.js";
import accountsService from "./accounts.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ForbiddenError } from "../../shared/utils/errors.js";
import { successResponse } from "../../shared/http/response-mappers.js";

const assertMembership = async (userId: string, tenantId: string) => {
  const member = await tenantService.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }
};

export const overview = catchAsync(async (req, res) => {
  const { tenantId } = req.query as { tenantId: string };
  await assertMembership(req.user.id, tenantId);
  res.json(successResponse(await accountsService.getOverview(tenantId)));
});

export const listFinancialAccounts = catchAsync(async (req, res) => {
  const { tenantId, includeInactive = false } = req.query as {
    tenantId: string;
    includeInactive?: boolean;
  };
  await assertMembership(req.user.id, tenantId);
  res.json(
    successResponse({
      accounts: await accountsService.listFinancialAccounts(tenantId, Boolean(includeInactive)),
    }),
  );
});

export const createFinancialAccount = catchAsync(async (req, res) => {
  const { tenantId, ...input } = req.body as any;
  await assertMembership(req.user.id, tenantId);
  res.json(successResponse({ account: await accountsService.createFinancialAccount(tenantId, input) }));
});

export const archiveFinancialAccount = catchAsync(async (req, res) => {
  const { accountId } = req.params as { accountId: string };
  const { tenantId } = req.body as { tenantId: string };
  await assertMembership(req.user.id, tenantId);
  await accountsService.archiveFinancialAccount(tenantId, accountId);
  res.json(successResponse({ archived: true }));
});

export const listExpenseCategories = catchAsync(async (req, res) => {
  const { tenantId, includeInactive = false } = req.query as {
    tenantId: string;
    includeInactive?: boolean;
  };
  await assertMembership(req.user.id, tenantId);
  res.json(
    successResponse({
      categories: await accountsService.listExpenseCategories(tenantId, Boolean(includeInactive)),
    }),
  );
});

export const listMoneyMovements = catchAsync(async (req, res) => {
  const { tenantId, sourceKind, accountId, limit = 50 } = req.query as any;
  await assertMembership(req.user.id, tenantId);
  res.json(
    successResponse({
      movements: await accountsService.listMoneyMovements(tenantId, {
        sourceKind,
        accountId,
        limit: Number(limit),
      }),
    }),
  );
});

export const voidMoneyMovement = catchAsync(async (req, res) => {
  const { movementId } = req.params as { movementId: string };
  const { tenantId } = req.body as { tenantId: string };
  await assertMembership(req.user.id, tenantId);
  const movement = await accountsService.voidMoneyMovement(tenantId, movementId);
  res.json(successResponse({ movement }));
});

export const createReceivedPayment = catchAsync(async (req, res) => {
  const { tenantId, ...input } = req.body as any;
  await assertMembership(req.user.id, tenantId);
  const movement = await accountsService.createReceivedPayment(tenantId, input);
  res.json(successResponse({ movement }));
});

export const createMadePayment = catchAsync(async (req, res) => {
  const { tenantId, ...input } = req.body as any;
  await assertMembership(req.user.id, tenantId);
  const movement = await accountsService.createMadePayment(tenantId, input);
  res.json(successResponse({ movement }));
});

export const createExpense = catchAsync(async (req, res) => {
  const { tenantId, ...input } = req.body as any;
  await assertMembership(req.user.id, tenantId);
  res.json(successResponse({ expense: await accountsService.createExpense(tenantId, input) }));
});

export const listExpenses = catchAsync(async (req, res) => {
  const { tenantId, categoryId, accountId, limit = 50 } = req.query as any;
  await assertMembership(req.user.id, tenantId);
  res.json(
    successResponse({
      expenses: await accountsService.listExpenses(tenantId, {
        categoryId,
        accountId,
        limit: Number(limit),
      }),
    }),
  );
});

export const listOpenDocuments = catchAsync(async (req, res) => {
  const { tenantId, flow, limit = 50 } = req.query as any;
  await assertMembership(req.user.id, tenantId);
  const documents = await accountsService.listOpenDocuments(tenantId, flow, Number(limit));
  res.json(successResponse({ documents }));
});

export const getDocumentBalance = catchAsync(async (req, res) => {
  const { tenantId, documentType, documentId } = req.query as any;
  await assertMembership(req.user.id, tenantId);
  res.json(
    successResponse({
      balance: await accountsService.getDocumentBalance(tenantId, documentType, documentId),
    }),
  );
});
