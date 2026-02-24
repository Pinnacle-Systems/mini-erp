import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { createStore, deleteStore, getStore, listStores, updateStore } from "./admin.controller.js";
import {
  createBusinessSchema,
  listBusinessesQuerySchema,
  businessParamsSchema,
  updateBusinessSchema,
} from "./admin.schema.js";

const adminRouter = Router();

adminRouter.use(protect);
adminRouter.get("/businesses", validateRequest(listBusinessesQuerySchema), listStores);
adminRouter.post("/businesses", validateRequest(createBusinessSchema), createStore);
adminRouter.get("/businesses/:businessId", validateRequest(businessParamsSchema), getStore);
adminRouter.patch(
  "/businesses/:businessId",
  validateRequest(businessParamsSchema),
  validateRequest(updateBusinessSchema),
  updateStore,
);
adminRouter.delete("/businesses/:businessId", validateRequest(businessParamsSchema), deleteStore);

export default adminRouter;
