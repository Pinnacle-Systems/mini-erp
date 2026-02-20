import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { createStore, deleteStore, getStore, listStores, updateStore } from "./admin.controller.js";
import {
  createStoreSchema,
  listStoresQuerySchema,
  storeParamsSchema,
  updateStoreSchema,
} from "./admin.schema.js";

const adminRouter = Router();

adminRouter.use(protect);
adminRouter.get("/stores", validateRequest(listStoresQuerySchema), listStores);
adminRouter.post("/stores", validateRequest(createStoreSchema), createStore);
adminRouter.get("/stores/:storeId", validateRequest(storeParamsSchema), getStore);
adminRouter.patch(
  "/stores/:storeId",
  validateRequest(storeParamsSchema),
  validateRequest(updateStoreSchema),
  updateStore,
);
adminRouter.delete("/stores/:storeId", validateRequest(storeParamsSchema), deleteStore);

export default adminRouter;
