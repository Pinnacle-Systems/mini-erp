import { Router } from "express";
import {
  push,
  pull,
  optionKeys,
  itemCategories,
} from "./sync.controller.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  itemCategoriesSchema,
  optionKeysSchema,
  pullSchema,
  pushSchema,
} from "./sync.schema.js";

const router = Router();

router.use(protect);
router.post("/push", validateRequest(pushSchema), push);
router.get("/pull", validateRequest(pullSchema), pull);
router.get("/option-keys", validateRequest(optionKeysSchema), optionKeys);
router.get("/item-categories", validateRequest(itemCategoriesSchema), itemCategories);

export default router;
