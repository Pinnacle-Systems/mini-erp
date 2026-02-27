import syncService from "./sync.service.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { ForbiddenError } from "../../shared/utils/errors.js";
import { getBusinessModulesFromLicense } from "../license/license.service.js";

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

export const itemPrices = catchAsync(async (req, res) => {
  const {
    tenantId,
    q,
    includeInactive = false,
    page = 1,
    limit = 50,
  } = req.query;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }
  const modules = await getBusinessModulesFromLicense(String(tenantId));
  if (!modules.pricing) {
    throw new ForbiddenError("Pricing module is not enabled for this store license");
  }

  const result = await syncService.getItemPrices(String(tenantId), {
    q: typeof q === "string" ? q : undefined,
    includeInactive: Boolean(includeInactive),
    page: Number(page),
    limit: Number(limit),
  });

  res.json({
    success: true,
    ...result,
  });
});

export const upsertItemPrice = catchAsync(async (req, res) => {
  const { variantId } = req.params;
  const { tenantId, amount, currency, baseVersion } = req.body;
  const member = await tenantService.validateMembership(req.user.id, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }
  const modules = await getBusinessModulesFromLicense(String(tenantId));
  if (!modules.pricing) {
    throw new ForbiddenError("Pricing module is not enabled for this store license");
  }

  const price = await syncService.upsertItemPrice(String(tenantId), String(variantId), {
    amount,
    currency,
    actorUserId: req.user.id,
    baseVersion: typeof baseVersion === "number" ? baseVersion : undefined,
  });

  res.json({
    success: true,
    price,
  });
});
