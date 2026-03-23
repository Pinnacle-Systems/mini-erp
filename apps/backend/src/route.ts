import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import accountsRoutes from "./modules/accounts/accounts.routes.js";
import customerGroupRoutes from "./modules/customer-groups/customer-groups.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import purchasesRoutes from "./modules/purchases/purchases.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import syncRoutes from "./modules/sync/sync.routes.js";
import systemRoutes from "./modules/system/system.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.sendStatus(200);
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/accounts", accountsRoutes);
router.use("/customer-groups", customerGroupRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/purchases", purchasesRoutes);
router.use("/sales", salesRoutes);
router.use("/sync", syncRoutes);
router.use("/system", systemRoutes);
export default router;
