import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .regex(/^\d{10}$/, "Phone number must be numeric and 10 digits long"),
    password: z.string(),
  }),
});

export const selectStoreSchema = z.object({
  body: z.object({
    storeId: z.uuid(),
  }),
});
