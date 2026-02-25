import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createStore,
  deleteStore,
  getStore,
  getUser,
  listStores,
  listUsers,
  lookupOwners,
  removeBusinessLogo,
  updateUser,
  updateStore,
  uploadBusinessLogo,
} from "./admin.controller.js";
import {
  createBusinessSchema,
  listBusinessesQuerySchema,
  listUsersQuerySchema,
  ownerLookupQuerySchema,
  businessParamsSchema,
  userParamsSchema,
  updateBusinessSchema,
  updateUserSchema,
  uploadBusinessLogoSchema,
} from "./admin.schema.js";

const adminRouter = Router();

adminRouter.use(protect);
adminRouter.get("/businesses", validateRequest(listBusinessesQuerySchema), listStores);
adminRouter.get("/users", validateRequest(listUsersQuerySchema), listUsers);
adminRouter.get("/users/:userId", validateRequest(userParamsSchema), getUser);
adminRouter.patch(
  "/users/:userId",
  validateRequest(userParamsSchema),
  validateRequest(updateUserSchema),
  updateUser,
);
adminRouter.get("/owners/lookup", validateRequest(ownerLookupQuerySchema), lookupOwners);
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
