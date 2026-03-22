import tenantService from "../tenant/tenant.service.js";
import inventoryService from "./inventory.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ForbiddenError } from "../../shared/utils/errors.js";
import { successResponse } from "../../shared/http/response-mappers.js";

export const listStockActivity = catchAsync(async (req, res) => {
  const {
    tenantId,
    locationId,
    variantId,
    sourceType,
    sourceAction,
    dateFrom,
    dateTo,
    q,
    cursor,
    limit,
  } = req.query;

  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const result = await inventoryService.getStockActivity({
    tenantId: String(tenantId),
    locationId: typeof locationId === "string" ? locationId : undefined,
    variantId: typeof variantId === "string" ? variantId : undefined,
    sourceType: typeof sourceType === "string" ? sourceType as any : undefined,
    sourceAction: typeof sourceAction === "string" ? sourceAction as any : undefined,
    dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
    dateTo: typeof dateTo === "string" ? dateTo : undefined,
    q: typeof q === "string" ? q : undefined,
    cursor: typeof cursor === "string" ? cursor : undefined,
    limit: Number(limit),
  });

  res.json(successResponse(result));
});
