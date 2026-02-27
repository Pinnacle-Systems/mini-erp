import { z } from "zod";

const syncOperationSchema = z.enum(["create", "update", "delete"]);

const parseBooleanQueryParam = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

const PRICE_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

const amountSchema = z.preprocess((value) => {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return value;
    return PRICE_AMOUNT_PATTERN.test(String(value)) ? value : value.toString();
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    if (!PRICE_AMOUNT_PATTERN.test(normalized)) return normalized;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}, z.number().min(0).nullable());

export const mutationSchema = z.object({
  mutationId: z.uuid(),
  deviceId: z.string().min(1),
  userId: z.uuid(),
  entity: z.string().min(1),
  entityId: z.uuid(),
  op: syncOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().min(0).optional(),
  clientTimestamp: z.string().datetime(),
});

export const pushSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    mutations: z.array(mutationSchema).max(500),
  }),
});

export const pullSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    cursor: z.string().regex(/^\d+$/).default("0"),
    limit: z.coerce.number().int().min(1).max(1000).default(200),
  }),
});

export const optionKeysSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
  }),
});

export const itemCategoriesSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    q: z.string().trim().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
});

export const itemPricesSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    q: z.string().trim().max(128).optional(),
    includeInactive: parseBooleanQueryParam.default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

export const upsertItemPriceSchema = z.object({
  params: z.object({
    variantId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    amount: amountSchema,
    currency: z.string().trim().length(3).optional(),
    baseVersion: z.number().int().min(0).optional(),
  }),
});
