import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.sendStatus(200);
});

router.use("/auth", authRoutes);
export default router;
