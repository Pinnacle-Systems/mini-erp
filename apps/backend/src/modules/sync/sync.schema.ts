import { z } from "zod";

const syncOperationSchema = z.enum(["create", "update", "delete", "purge"]);

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
const priceTypeSchema = z.enum(["SALES", "PURCHASE"]);
const priceTaxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);
const compositeEntityIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?::[A-Z_]+)?$/i,
  );

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
  entityId: compositeEntityIdSchema,
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

export const syncResultsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
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
    priceType: priceTypeSchema.default("SALES"),
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
    priceType: priceTypeSchema.default("SALES"),
    taxMode: priceTaxModeSchema.default("EXCLUSIVE"),
    gstSlab: z.string().trim().max(32).optional().nullable(),
    baseVersion: z.number().int().min(0).optional(),
  }),
});
