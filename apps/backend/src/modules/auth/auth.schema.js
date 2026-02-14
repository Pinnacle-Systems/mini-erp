import { z } from "zod";

export const loginSchema = z.object({
  body: z
    .object({
      email: z.email().optional(),
      phone: z
        .string()
        .regex(/^\d{10}/, "Phone number must be numeric and 10 digits long")
        .optional(),
      password: z.string(),
    })
    .refine((data) => data.email || data.phone, {
      error: "Either email or phone must be provided",
    }),
});
