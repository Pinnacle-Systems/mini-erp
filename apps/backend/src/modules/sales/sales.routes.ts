import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createSalesDocument,
  deleteSalesDocument,
  getSalesConversionBalance,
  getSalesDocumentHistory,
  listSalesDocuments,
  postSalesDocument,
  transitionSalesDocument,
  updateSalesDocument,
} from "./sales.controller.js";
import {
  createSalesDocumentSchema,
  deleteSalesDocumentSchema,
  getSalesConversionBalanceSchema,
  getSalesDocumentHistorySchema,
  listSalesDocumentsSchema,
  postSalesDocumentSchema,
  transitionSalesDocumentSchema,
  updateSalesDocumentSchema,
} from "./sales.schema.js";

const router = Router();

router.use(protect);
router.get("/documents", validateRequest(listSalesDocumentsSchema), listSalesDocuments);
router.get(
  "/documents/:documentId/history",
  validateRequest(getSalesDocumentHistorySchema),
  getSalesDocumentHistory,
);
router.get(
  "/conversion-balance/:documentId",
  validateRequest(getSalesConversionBalanceSchema),
  getSalesConversionBalance,
);
router.post("/documents", validateRequest(createSalesDocumentSchema), createSalesDocument);
router.patch(
  "/documents/:documentId",
  validateRequest(updateSalesDocumentSchema),
  updateSalesDocument,
);
router.post(
  "/documents/:documentId/post",
  validateRequest(postSalesDocumentSchema),
  postSalesDocument,
);
router.post(
  "/documents/:documentId/action",
  validateRequest(transitionSalesDocumentSchema),
  transitionSalesDocument,
);
router.delete(
  "/documents/:documentId",
  validateRequest(deleteSalesDocumentSchema),
  deleteSalesDocument,
);

export default router;
