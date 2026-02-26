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

export const optionKeys = catchAsync(async (req, res) => {
  const { tenantId } = req.query;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const optionDiscovery = await syncService.getOptionKeys(String(tenantId));

  res.json({
    success: true,
    optionKeys: optionDiscovery.optionKeys,
    optionValuesByKey: optionDiscovery.optionValuesByKey,
  });
});

export const itemCategories = catchAsync(async (req, res) => {
  const { tenantId, q, limit = 30 } = req.query;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const categories = await syncService.getItemCategories(
    String(tenantId),
    typeof q === "string" ? q : undefined,
    Number(limit),
  );

  res.json({
    success: true,
    categories: categories.map((category) => category.name),
    entries: categories,
  });
});
