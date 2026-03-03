import { z } from "zod";
import { INDIA_STATES } from "./india-states.js";
import { BUSINESS_TYPES } from "./business-types.js";
import { BUSINESS_CATEGORIES } from "./business-categories.js";
const LICENSE_LIMIT_TYPES = ["MAX_USERS", "MAX_CONCURRENT_USERS"] as const;
const BUSINESS_BUNDLE_KEYS = [
  "SALES_LITE",
  "SALES_STOCK_OUT",
  "TRADING",
  "SERVICE_BILLING",
  "CUSTOM",
] as const;
const BUSINESS_CAPABILITY_KEYS = [
  "ITEM_PRODUCTS",
  "ITEM_SERVICES",
  "PARTIES_CUSTOMERS",
  "PARTIES_SUPPLIERS",
  "TXN_SALE_CREATE",
  "TXN_SALE_RETURN",
  "TXN_PURCHASE_CREATE",
  "TXN_PURCHASE_RETURN",
  "INV_STOCK_OUT",
  "INV_STOCK_IN",
  "INV_ADJUSTMENT",
  "INV_TRANSFER",
  "FINANCE_RECEIVABLES",
  "FINANCE_PAYABLES",
] as const;

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

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}, z.string().max(255).optional());

const optionalNullableTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.string().max(255).nullable().optional());

const optionalIndiaState = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}, z.enum(INDIA_STATES).optional());

const optionalNullableIndiaState = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.enum(INDIA_STATES).nullable().optional());

const optionalBusinessType = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}, z.enum(BUSINESS_TYPES).optional());

const optionalNullableBusinessType = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.enum(BUSINESS_TYPES).nullable().optional());

const optionalBusinessCategory = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}, z.enum(BUSINESS_CATEGORIES).optional());

const optionalNullableBusinessCategory = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.enum(BUSINESS_CATEGORIES).nullable().optional());

const optionalNullableLicenseDate = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "License date must be in YYYY-MM-DD format").nullable().optional());

const optionalNullableLicenseLimitType = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}, z.enum(LICENSE_LIMIT_TYPES).nullable().optional());

const optionalNullablePositiveInt = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "") return null;
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return value;
}, z.number().int().min(1).nullable().optional());

const licenseSchema = z
  .object({
    beginsOn: optionalNullableLicenseDate,
    endsOn: optionalNullableLicenseDate,
    bundleKey: z.enum(BUSINESS_BUNDLE_KEYS).nullable().optional(),
    addOnCapabilities: z.array(z.enum(BUSINESS_CAPABILITY_KEYS)).max(14).optional(),
    removedCapabilities: z.array(z.enum(BUSINESS_CAPABILITY_KEYS)).max(14).optional(),
    userLimitType: optionalNullableLicenseLimitType,
    userLimitValue: optionalNullablePositiveInt,
  })
  .superRefine((value, ctx) => {
    const hasAnyField =
      value.beginsOn !== undefined ||
      value.endsOn !== undefined ||
      value.bundleKey !== undefined ||
      value.addOnCapabilities !== undefined ||
      value.removedCapabilities !== undefined ||
      value.userLimitType !== undefined ||
      value.userLimitValue !== undefined;
    if (!hasAnyField) return;

    if (!value.beginsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "License begin date is required",
        path: ["beginsOn"],
      });
    }
    if (!value.endsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "License end date is required",
        path: ["endsOn"],
      });
    }

    if (value.beginsOn && value.endsOn && value.beginsOn > value.endsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "License end date must be on or after begin date",
        path: ["endsOn"],
      });
    }

    if (value.userLimitType && !value.userLimitValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "User limit value is required when user limit type is set",
        path: ["userLimitValue"],
      });
    }

    if (value.userLimitValue && !value.userLimitType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "User limit type is required when user limit value is set",
        path: ["userLimitType"],
      });
    }
  });

export const listBusinessesQuerySchema = z.object({
  query: z.object({
    businessName: z.string().trim().optional(),
    ownerEmail: z.string().trim().optional(),
    ownerPhone: z.string().trim().optional(),
    includeDeleted: parseBooleanQueryParam.default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    includeDeleted: parseBooleanQueryParam.default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const ownerLookupQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Search text is required"),
    limit: z.coerce.number().int().min(1).max(20).default(8),
  }),
});

export const createBusinessSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Business name is required"),
      ownerId: z.uuid("Owner ID must be a valid UUID").optional(),
      ownerEmail: z.string().trim().email().optional(),
      ownerPhone: z
        .string()
        .trim()
        .regex(/^\d{10}$/, "Owner phone must be numeric and 10 digits long")
        .optional(),
      phoneNumber: optionalTrimmedString,
      gstin: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim().toUpperCase();
        return normalized === "" ? undefined : normalized;
      }, z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]Z[A-Z0-9]$/, "GSTIN format is invalid").optional()),
      email: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? undefined : normalized;
      }, z.string().email("Business email is invalid").optional()),
      businessType: optionalBusinessType,
      businessCategory: optionalBusinessCategory,
      state: optionalIndiaState,
      pincode: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? undefined : normalized;
      }, z.string().regex(/^\d{6}$/, "Pincode must be a 6-digit number").optional()),
      address: optionalTrimmedString,
      logo: optionalTrimmedString,
      license: licenseSchema.optional(),
    })
    .refine(
      (value) => value.ownerId !== undefined || Boolean(value.ownerPhone?.trim()),
      {
        error: "Select an owner",
        path: ["ownerId"],
      },
    ),
});

export const updateBusinessSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Business name is required").optional(),
      ownerId: z.uuid("Owner ID must be a valid UUID").optional(),
      isActive: z.boolean().optional(),
      modules: z
        .object({
          catalog: z.boolean().optional(),
          inventory: z.boolean().optional(),
          sales: z.boolean().optional(),
          pricing: z.boolean().optional(),
        })
        .strict()
        .optional(),
      phoneNumber: optionalNullableTrimmedString,
      gstin: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim().toUpperCase();
        return normalized === "" ? null : normalized;
      }, z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]Z[A-Z0-9]$/, "GSTIN format is invalid").nullable().optional()),
      email: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? null : normalized;
      }, z.string().email("Business email is invalid").nullable().optional()),
      businessType: optionalNullableBusinessType,
      businessCategory: optionalNullableBusinessCategory,
      state: optionalNullableIndiaState,
      pincode: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? null : normalized;
      }, z.string().regex(/^\d{6}$/, "Pincode must be a 6-digit number").nullable().optional()),
      address: optionalNullableTrimmedString,
      logo: optionalNullableTrimmedString,
      license: licenseSchema.optional(),
    })
    .refine(
      (value) =>
        value.name !== undefined ||
        value.ownerId !== undefined ||
        value.isActive !== undefined ||
        value.modules !== undefined ||
        value.phoneNumber !== undefined ||
        value.gstin !== undefined ||
        value.email !== undefined ||
        value.businessType !== undefined ||
        value.businessCategory !== undefined ||
        value.state !== undefined ||
        value.pincode !== undefined ||
        value.address !== undefined ||
        value.logo !== undefined ||
        value.license !== undefined,
      {
        error: "At least one update field is required",
      },
    ),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: optionalNullableTrimmedString,
      email: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? null : normalized;
      }, z.string().email("User email is invalid").nullable().optional()),
      phone: z.preprocess((value) => {
        if (typeof value !== "string") return value;
        const normalized = value.trim();
        return normalized === "" ? null : normalized;
      }, z.string().regex(/^\d{10}$/, "Phone must be numeric and 10 digits long").nullable().optional()),
    })
    .refine(
      (value) =>
        value.name !== undefined ||
        value.email !== undefined ||
        value.phone !== undefined,
      {
        error: "At least one update field is required",
      },
    ),
});

export const businessParamsSchema = z.object({
  params: z.object({
    businessId: z.uuid("Business ID must be a valid UUID"),
  }),
});

export const userParamsSchema = z.object({
  params: z.object({
    userId: z.uuid("User ID must be a valid UUID"),
  }),
});

export const uploadBusinessLogoSchema = z.object({
  body: z.object({
    fileName: z.string().trim().min(1).max(255).optional(),
    mimeType: z.string().trim().min(1, "MIME type is required"),
    dataBase64: z.string().trim().min(1, "File data is required"),
  }),
});
