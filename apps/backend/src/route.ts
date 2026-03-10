import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import customerGroupRoutes from "./modules/customer-groups/customer-groups.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import syncRoutes from "./modules/sync/sync.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.sendStatus(200);
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/customer-groups", customerGroupRoutes);
router.use("/sales", salesRoutes);
router.use("/sync", syncRoutes);
export default router;
