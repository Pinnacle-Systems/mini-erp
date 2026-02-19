import { z } from "zod";

const syncOperationSchema = z.enum(["create", "update", "delete"]);

export const mutationSchema = z.object({
  mutationId: z.uuid(),
  deviceId: z.string().min(1),
  userId: z.uuid(),
  entity: z.string().min(1),
  entityId: z.uuid(),
  op: syncOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().positive().optional(),
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
