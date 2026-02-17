import { z } from "zod";

export const loginBodySchema = z
  .object({
    email: z.email().optional(),
    phone: z
      .string()
      .regex(/^\d{10}$/, "Phone number must be numeric and 10 digits long")
      .optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  });

export const refreshBodySchema = z.object({
  currentStoreId: z.uuid().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
