import { z } from "zod";

const memberIdsSchema = z.array(z.uuid()).max(500).default([]);

export const customerGroupParamsSchema = z.object({
  params: z.object({
    groupId: z.uuid(),
  }),
});

export const listCustomerGroupsSchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
  }),
});

export const createCustomerGroupSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    isActive: z.boolean().default(true),
    memberIds: memberIdsSchema,
  }),
});

export const updateCustomerGroupSchema = z.object({
  params: z.object({
    groupId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    isActive: z.boolean(),
    memberIds: memberIdsSchema,
  }),
});

export const deleteCustomerGroupSchema = z.object({
  params: z.object({
    groupId: z.uuid(),
  }),
  body: z.object({
    tenantId: z.uuid(),
  }),
});
