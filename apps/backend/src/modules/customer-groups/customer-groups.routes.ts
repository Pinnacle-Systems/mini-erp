import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.middleware.js";
import {
  createCustomerGroup,
  deleteCustomerGroup,
  listCustomerGroups,
  updateCustomerGroup,
} from "./customer-groups.controller.js";
import {
  createCustomerGroupSchema,
  customerGroupParamsSchema,
  deleteCustomerGroupSchema,
  listCustomerGroupsSchema,
  updateCustomerGroupSchema,
} from "./customer-groups.schema.js";

const router = Router();

router.use(protect);

router.get("/", validateRequest(listCustomerGroupsSchema), listCustomerGroups);
router.post("/", validateRequest(createCustomerGroupSchema), createCustomerGroup);
router.patch(
  "/:groupId",
  validateRequest(customerGroupParamsSchema),
  validateRequest(updateCustomerGroupSchema),
  updateCustomerGroup,
);
router.delete(
  "/:groupId",
  validateRequest(customerGroupParamsSchema),
  validateRequest(deleteCustomerGroupSchema),
  deleteCustomerGroup,
);

export default router;
