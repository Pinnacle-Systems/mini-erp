import { Router } from "express";
import {
  login,
  refresh,
  selectStore,
  getMe,
  logout,
} from "./auth.controller.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { loginSchema } from "./auth.schema.js";
import { protect } from "../../shared/middleware/auth.middleware.js";

const router = Router();

router.post("/login", validateRequest(loginSchema), login);
router.post("/refresh", refresh);

router.post("/logout", protect, logout);
router.post("/select-store", selectStore);
router.get("/me", getMe);

export default router;
