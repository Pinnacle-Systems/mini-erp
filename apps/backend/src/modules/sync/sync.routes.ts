import { Router } from "express";
import { push, pull } from "./sync.controller.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { pullSchema, pushSchema } from "./sync.schema.js";

const router = Router();

router.use(protect);
router.post("/push", validateRequest(pushSchema), push);
router.get("/pull", validateRequest(pullSchema), pull);

export default router;
