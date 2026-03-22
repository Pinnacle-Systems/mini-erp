import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { listStockActivity } from "./inventory.controller.js";
import { stockActivityQuerySchema } from "./inventory.schema.js";

const router = Router();

router.use(protect);
router.get("/stock-activity", validateRequest(stockActivityQuerySchema), listStockActivity);

export default router;
