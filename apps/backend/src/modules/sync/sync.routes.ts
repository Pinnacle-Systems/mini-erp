import { Router } from "express";
import {
  push,
  pull,
  syncResults,
  optionKeys,
  itemCategories,
  itemPrices,
  upsertItemPrice,
} from "./sync.controller.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  itemCategoriesSchema,
  itemPricesSchema,
  optionKeysSchema,
  pullSchema,
  pushSchema,
  syncResultsSchema,
  upsertItemPriceSchema,
} from "./sync.schema.js";

const router = Router();

router.use(protect);
router.post("/push", validateRequest(pushSchema), push);
router.get("/pull", validateRequest(pullSchema), pull);
router.get("/results", validateRequest(syncResultsSchema), syncResults);
router.get("/option-keys", validateRequest(optionKeysSchema), optionKeys);
router.get("/item-categories", validateRequest(itemCategoriesSchema), itemCategories);
router.get("/item-prices", validateRequest(itemPricesSchema), itemPrices);
router.put(
  "/item-prices/:variantId",
  validateRequest(upsertItemPriceSchema),
  upsertItemPrice,
);

export default router;
