import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  archiveFinancialAccount,
  createExpense,
  createFinancialAccount,
  createMadePayment,
  createReceivedPayment,
  getDocumentBalance,
  listExpenseCategories,
  listExpenses,
  listFinancialAccounts,
  listMoneyMovements,
  listOpenDocuments,
  overview,
} from "./accounts.controller.js";
import {
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
  paymentCreateSchema,
} from "./accounts.schema.js";

const router = Router();

router.use(protect);
router.get("/overview", validateRequest(accountsOverviewSchema), overview);
router.get("/financial-accounts", validateRequest(listFinancialAccountsSchema), listFinancialAccounts);
router.post("/financial-accounts", validateRequest(createFinancialAccountSchema), createFinancialAccount);
router.post("/financial-accounts/:accountId/archive", validateRequest(archiveFinancialAccountSchema), archiveFinancialAccount);
router.get("/expense-categories", validateRequest(listExpenseCategoriesSchema), listExpenseCategories);
router.get("/money-movements", validateRequest(listMoneyMovementsSchema), listMoneyMovements);
router.post("/payments/received", validateRequest(paymentCreateSchema), createReceivedPayment);
router.post("/payments/made", validateRequest(paymentCreateSchema), createMadePayment);
router.post("/expenses", validateRequest(createExpenseSchema), createExpense);
router.get("/expenses", validateRequest(listExpensesSchema), listExpenses);
router.get("/open-documents", validateRequest(listOpenDocumentsSchema), listOpenDocuments);
router.get("/document-balance", validateRequest(documentBalanceSchema), getDocumentBalance);

export default router;
