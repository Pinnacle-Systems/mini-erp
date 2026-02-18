import { z } from "zod";

export const onboardStoreBodySchema = z
  .object({
    storeName: z.string().trim().min(2, "Store name is required"),
    ownerName: z.string().trim().optional(),
    ownerEmail: z.email().optional(),
    ownerPhone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Owner phone must be a 10-digit number")
      .optional(),
  })
  .refine(
    (value) => Boolean(value.ownerEmail?.trim() || value.ownerPhone?.trim()),
    {
      message: "Owner email or phone is required",
      path: ["ownerEmail"],
    },
  );

export const listStoresQuerySchema = z.object({
  storeName: z.string().trim().optional(),
  ownerEmail: z.string().trim().optional(),
  ownerPhone: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listStoreOwnersQuerySchema = z.object({
  ownerEmail: z.string().trim().optional(),
  ownerPhone: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const updateStoreBodySchema = z
  .object({
    storeName: z.string().trim().min(2, "Store name is required").optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) => value.storeName !== undefined || value.isActive !== undefined,
    {
      message: "At least one update field is required",
    },
  );

export const updateStoreOwnerBodySchema = z
  .object({
    ownerName: z.string().trim().optional(),
    ownerEmail: z.email().optional(),
    ownerPhone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Owner phone must be a 10-digit number")
      .optional(),
  })
  .refine(
    (value) => Boolean(value.ownerEmail?.trim() || value.ownerPhone?.trim()),
    {
      message: "Owner email or phone is required",
      path: ["ownerEmail"],
    },
  );

export type OnboardStoreBody = z.infer<typeof onboardStoreBodySchema>;
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;
export type ListStoreOwnersQuery = z.infer<typeof listStoreOwnersQuerySchema>;
export type UpdateStoreBody = z.infer<typeof updateStoreBodySchema>;
export type UpdateStoreOwnerBody = z.infer<typeof updateStoreOwnerBodySchema>;
