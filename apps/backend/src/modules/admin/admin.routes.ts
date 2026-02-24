import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createStore,
  deleteStore,
  getStore,
  listStores,
  removeBusinessLogo,
  updateStore,
  uploadBusinessLogo,
} from "./admin.controller.js";
import {
  createBusinessSchema,
  listBusinessesQuerySchema,
  businessParamsSchema,
  updateBusinessSchema,
  uploadBusinessLogoSchema,
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
adminRouter.post(
  "/businesses/:businessId/logo",
  validateRequest(businessParamsSchema),
  validateRequest(uploadBusinessLogoSchema),
  uploadBusinessLogo,
);
adminRouter.delete(
  "/businesses/:businessId/logo",
  validateRequest(businessParamsSchema),
  removeBusinessLogo,
);
adminRouter.delete("/businesses/:businessId", validateRequest(businessParamsSchema), deleteStore);

export default adminRouter;
