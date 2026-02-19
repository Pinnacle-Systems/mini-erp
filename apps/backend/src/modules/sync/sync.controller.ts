import syncService from "./sync.service.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ForbiddenError } from "../../shared/utils/errors.js";

export const push = catchAsync(async (req, res) => {
  const { tenantId, mutations } = req.body;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const result = await syncService.processMutations(tenantId, req.user.id, mutations);

  res.json({
    success: true,
    cursor: result.cursor,
    acknowledgements: result.acknowledgements,
  });
});

export const pull = catchAsync(async (req, res) => {
  const { tenantId, cursor = "0", limit = 200 } = req.query;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const result = await syncService.getDeltasSinceCursor(
    tenantId,
    String(cursor),
    Number(limit),
  );

  res.json({
    success: true,
    nextCursor: result.nextCursor,
    deltas: result.deltas,
  });
});
