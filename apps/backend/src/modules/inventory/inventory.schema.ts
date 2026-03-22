import { z } from "zod";
import {
  STOCK_ACTIVITY_DEFAULT_PAGE_LIMIT,
  STOCK_ACTIVITY_SOURCE_ACTIONS,
  STOCK_ACTIVITY_SOURCE_TYPES,
} from "./stock-activity.shared.js";

const stockActivitySourceTypeSchema = z.enum(STOCK_ACTIVITY_SOURCE_TYPES);
const stockActivitySourceActionSchema = z.enum(STOCK_ACTIVITY_SOURCE_ACTIONS);

export const stockActivityQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    locationId: z.uuid().optional(),
    variantId: z.uuid().optional(),
    sourceType: stockActivitySourceTypeSchema.optional(),
    sourceAction: stockActivitySourceActionSchema.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    q: z.string().trim().max(128).optional(),
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(STOCK_ACTIVITY_DEFAULT_PAGE_LIMIT),
  }),
});
