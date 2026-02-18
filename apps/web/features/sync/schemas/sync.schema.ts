import { z } from "zod";

const syncOperationSchema = z.enum(["create", "update", "delete"]);

export const mutationSchema = z.object({
  mutationId: z.uuid(),
  deviceId: z.string().min(1),
  userId: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  op: syncOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().positive().optional(),
  clientTimestamp: z.iso.datetime(),
});

export const pushRequestSchema = z.object({
  mutations: z.array(mutationSchema).max(500),
});

export const pullQuerySchema = z.object({
  cursor: z.string().default("0"),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export type PushRequestBody = z.infer<typeof pushRequestSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;
