import { Router } from "express";
import {
  login,
  refresh,
  selectStore,
  getMe,
  logout,
} from "./auth.controller.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { loginSchema, selectStoreSchema } from "./auth.schema.js";

const router = Router();

router.post("/login", validateRequest(loginSchema), login);
router.post("/refresh", refresh);
router.post("/select-store", validateRequest(selectStoreSchema), selectStore);
router.get("/me", getMe);

router.post("/logout", logout);

export default router;
