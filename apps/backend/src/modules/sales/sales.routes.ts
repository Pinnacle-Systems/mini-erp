import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createSalesInvoice,
  deleteSalesInvoice,
  listSalesInvoices,
  postSalesInvoice,
  updateSalesInvoice,
} from "./sales.controller.js";
import {
  createSalesInvoiceSchema,
  deleteSalesInvoiceSchema,
  listSalesInvoicesSchema,
  postSalesInvoiceSchema,
  updateSalesInvoiceSchema,
} from "./sales.schema.js";

const router = Router();

router.use(protect);
router.get("/invoices", validateRequest(listSalesInvoicesSchema), listSalesInvoices);
router.post("/invoices", validateRequest(createSalesInvoiceSchema), createSalesInvoice);
router.patch(
  "/invoices/:invoiceId",
  validateRequest(updateSalesInvoiceSchema),
  updateSalesInvoice,
);
router.post(
  "/invoices/:invoiceId/post",
  validateRequest(postSalesInvoiceSchema),
  postSalesInvoice,
);
router.delete(
  "/invoices/:invoiceId",
  validateRequest(deleteSalesInvoiceSchema),
  deleteSalesInvoice,
);

export default router;
