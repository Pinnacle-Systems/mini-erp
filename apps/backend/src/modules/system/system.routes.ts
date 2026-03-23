import { Router } from "express";
import { recordClientDiagnostic } from "./system.controller.js";
import { clientDiagnosticsSchema } from "./system.schema.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";

const router = Router();

router.post(
  "/client-diagnostics",
  validateRequest(clientDiagnosticsSchema),
  recordClientDiagnostic,
);

export default router;
