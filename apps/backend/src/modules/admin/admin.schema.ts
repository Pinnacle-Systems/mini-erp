import { z } from "zod";
import { INDIA_STATES } from "./india-states.js";
import { BUSINESS_TYPES } from "./business-types.js";
import { BUSINESS_CATEGORIES } from "./business-categories.js";

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

export const createBusinessSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Business name is required"),
      ownerEmail: z.string().trim().email().optional(),
      ownerPhone: z
        .string()
        .trim()
        .regex(/^\d{10}$/, "Owner phone must be numeric and 10 digits long"),
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
    }),
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
        value.logo !== undefined,
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

export const uploadBusinessLogoSchema = z.object({
  body: z.object({
    fileName: z.string().trim().min(1).max(255).optional(),
    mimeType: z.string().trim().min(1, "MIME type is required"),
    dataBase64: z.string().trim().min(1, "File data is required"),
  }),
});
