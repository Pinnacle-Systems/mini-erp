import { z } from "zod";
import { StoreRole } from "@/generated/prisma/enums";

export const createStoreMemberBodySchema = z
  .object({
    name: z.string().trim().optional(),
    email: z.email().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Phone number must be numeric and 10 digits long")
      .optional(),
    role: z.enum(StoreRole),
  })
  .refine((value) => Boolean(value.email?.trim() || value.phone?.trim()), {
    message: "Email or phone is required",
    path: ["email"],
  });

export const updateStoreMemberRoleBodySchema = z.object({
  role: z.enum(StoreRole),
});

export type CreateStoreMemberBody = z.infer<typeof createStoreMemberBodySchema>;
export type UpdateStoreMemberRoleBody = z.infer<typeof updateStoreMemberRoleBodySchema>;
