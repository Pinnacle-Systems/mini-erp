import { Router } from "express";
import {
  login,
  refresh,
  selectStore,
  selectLocation,
  getMe,
  logout,
} from "./auth.controller.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import { loginSchema, selectBusinessSchema, selectLocationSchema } from "./auth.schema.js";

const router = Router();

router.post("/login", validateRequest(loginSchema), login);
router.post("/refresh", refresh);
router.post("/select-business", validateRequest(selectBusinessSchema), selectStore);
router.post("/select-location", validateRequest(selectLocationSchema), selectLocation);
router.get("/me", getMe);

router.post("/logout", logout);

export default router;
