import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  allocatePayment,
  archiveFinancialAccount,
  createExpense,
  createFinancialAccount,
  createMadePayment,
  createReceivedPayment,
  getDocumentBalance,
  listPaymentAllocations,
  listExpenseCategories,
  listExpenses,
  listFinancialAccounts,
  listMoneyMovements,
  listOpenDocuments,
  overview,
  partyBalances,
  partyFinancialSummary,
  reversePaymentAllocation,
  voidMoneyMovement,
} from "./accounts.controller.js";
import {
  allocatePaymentSchema,
  accountsOverviewSchema,
  archiveFinancialAccountSchema,
  createExpenseSchema,
  createFinancialAccountSchema,
  documentBalanceSchema,
  listExpenseCategoriesSchema,
  listExpensesSchema,
  listFinancialAccountsSchema,
  listMoneyMovementsSchema,
  listOpenDocumentsSchema,
  listPaymentAllocationsSchema,
  paymentCreateSchema,
  partyBalancesSchema,
  partyFinancialSummarySchema,
  reversePaymentAllocationSchema,
  voidMoneyMovementSchema,
} from "./accounts.schema.js";

const router = Router();

router.use(protect);
router.get("/overview", validateRequest(accountsOverviewSchema), overview);
router.get("/party-balances", validateRequest(partyBalancesSchema), partyBalances);
router.get("/financial-accounts", validateRequest(listFinancialAccountsSchema), listFinancialAccounts);
router.post("/financial-accounts", validateRequest(createFinancialAccountSchema), createFinancialAccount);
router.post("/financial-accounts/:accountId/archive", validateRequest(archiveFinancialAccountSchema), archiveFinancialAccount);
router.get("/expense-categories", validateRequest(listExpenseCategoriesSchema), listExpenseCategories);
router.get("/money-movements", validateRequest(listMoneyMovementsSchema), listMoneyMovements);
router.post("/money-movements/:movementId/void", validateRequest(voidMoneyMovementSchema), voidMoneyMovement);
router.post("/payments/received", validateRequest(paymentCreateSchema), createReceivedPayment);
router.post("/payments/made", validateRequest(paymentCreateSchema), createMadePayment);
router.post("/payments/:movementId/allocate", validateRequest(allocatePaymentSchema), allocatePayment);
router.get("/payments/:movementId/allocations", validateRequest(listPaymentAllocationsSchema), listPaymentAllocations);
router.post(
  "/payments/:movementId/allocations/:allocationId/reverse",
  validateRequest(reversePaymentAllocationSchema),
  reversePaymentAllocation,
);
router.post("/expenses", validateRequest(createExpenseSchema), createExpense);
router.get("/expenses", validateRequest(listExpensesSchema), listExpenses);
router.get("/open-documents", validateRequest(listOpenDocumentsSchema), listOpenDocuments);
router.get("/document-balance", validateRequest(documentBalanceSchema), getDocumentBalance);
router.get("/party-summary", validateRequest(partyFinancialSummarySchema), partyFinancialSummary);

export default router;
