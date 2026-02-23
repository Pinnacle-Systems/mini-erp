import { z } from "zod";

const parseBooleanQueryParam = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

export const listStoresQuerySchema = z.object({
  query: z.object({
    storeName: z.string().trim().optional(),
    ownerEmail: z.string().trim().optional(),
    ownerPhone: z.string().trim().optional(),
    includeDeleted: parseBooleanQueryParam.default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const createStoreSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Store name is required"),
      ownerEmail: z.string().trim().email().optional(),
      ownerPhone: z
        .string()
        .trim()
        .regex(/^\d{10}$/, "Owner phone must be numeric and 10 digits long")
        .optional(),
    })
    .refine((value) => value.ownerEmail !== undefined || value.ownerPhone !== undefined, {
      error: "Owner email or phone is required",
    }),
});

export const updateStoreSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Store name is required").optional(),
      ownerId: z.uuid("Owner ID must be a valid UUID").optional(),
      isActive: z.boolean().optional(),
      modules: z
        .object({
          catalog: z.boolean().optional(),
          inventory: z.boolean().optional(),
          pricing: z.boolean().optional(),
        })
        .strict()
        .optional(),
    })
    .refine(
      (value) =>
        value.name !== undefined ||
        value.ownerId !== undefined ||
        value.isActive !== undefined ||
        value.modules !== undefined,
      {
        error: "At least one update field is required",
      },
    ),
});

export const storeParamsSchema = z.object({
  params: z.object({
    storeId: z.uuid("Store ID must be a valid UUID"),
  }),
});
