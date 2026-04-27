import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createPurchaseDocument,
  deletePurchaseDocument,
  getPurchaseConversionBalance,
  getPurchaseDocumentHistory,
  getPurchaseOverview,
  listPurchaseDocuments,
  postPurchaseDocument,
  transitionPurchaseDocument,
  updatePurchaseDocument,
} from "./purchases.controller.js";
import {
  createPurchaseDocumentSchema,
  deletePurchaseDocumentSchema,
  getPurchaseConversionBalanceSchema,
  getPurchaseDocumentHistorySchema,
  getPurchaseOverviewSchema,
  listPurchaseDocumentsSchema,
  postPurchaseDocumentSchema,
  transitionPurchaseDocumentSchema,
  updatePurchaseDocumentSchema,
} from "./purchases.schema.js";

const router = Router();

router.use(protect);
router.get("/overview", validateRequest(getPurchaseOverviewSchema), getPurchaseOverview);
router.get("/documents", validateRequest(listPurchaseDocumentsSchema), listPurchaseDocuments);
router.get(
  "/documents/:documentId/history",
  validateRequest(getPurchaseDocumentHistorySchema),
  getPurchaseDocumentHistory,
);
router.get(
  "/conversion-balance/:documentId",
  validateRequest(getPurchaseConversionBalanceSchema),
  getPurchaseConversionBalance,
);
router.post("/documents", validateRequest(createPurchaseDocumentSchema), createPurchaseDocument);
router.patch(
  "/documents/:documentId",
  validateRequest(updatePurchaseDocumentSchema),
  updatePurchaseDocument,
);
router.post(
  "/documents/:documentId/post",
  validateRequest(postPurchaseDocumentSchema),
  postPurchaseDocument,
);
router.post(
  "/documents/:documentId/action",
  validateRequest(transitionPurchaseDocumentSchema),
  transitionPurchaseDocument,
);
router.delete(
  "/documents/:documentId",
  validateRequest(deletePurchaseDocumentSchema),
  deletePurchaseDocument,
);

export default router;
