import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../shared/utils/errors.js";
import { getBusinessModulesFromLicense } from "../license/license.service.js";

type SyncRejectionReasonCode =
  | "VERSION_CONFLICT"
  | "VALIDATION_FAILED"
  | "PERMISSION_DENIED"
  | "DEPENDENCY_MISSING"
  | "ENTITY_IN_USE";

type SyncRejection = {
  mutationId: string;
  status: "rejected";
  reasonCode: SyncRejectionReasonCode;
  message: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
};

type AppliedOutcomeEntity = {
  entity: string;
  entityId: string;
};

type AppliedOutcome = {
  category: "mutation" | "hybrid_delete";
  summary: string;
  archived: AppliedOutcomeEntity[];
  purged: AppliedOutcomeEntity[];
  updated: AppliedOutcomeEntity[];
};

type MutationAcknowledgement =
  | {
      mutationId: string;
      status: "applied";
      outcome?: AppliedOutcome;
    }
  | SyncRejection;

type SyncResultRecord = {
  mutationId: string;
  entity: string;
  entityId: string;
  operation: "create" | "update" | "delete" | "purge";
  resultStatus: "applied" | "rejected";
  summary: string;
  processedAt: string;
  userId: string;
  outcome?: AppliedOutcome;
  rejection?: {
    reasonCode: SyncRejectionReasonCode;
    details?: Record<string, unknown>;
  };
};

type MutationLogResultStatus = "APPLIED" | "REJECTED";

class SyncRejectionError extends AppError {
  reasonCode: SyncRejectionReasonCode;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;

  constructor({
    message,
    statusCode,
    reasonCode,
    entity,
    entityId,
    details,
  }: {
    message: string;
    statusCode: number;
    reasonCode: SyncRejectionReasonCode;
    entity: string;
    entityId: string;
    details?: Record<string, unknown>;
  }) {
    super(message, statusCode);
    this.reasonCode = reasonCode;
    this.entity = entity;
    this.entityId = entityId;
    this.details = details;
  }
}

const SUPPORTED_ENTITIES = new Set([
  "customer",
  "supplier",
  "item",
  "item_variant",
  "item_category",
  "item_collection",
  "item_collection_item",
  "item_price",
  "stock_adjustment",
]);

const RECENT_STOCK_ADJUSTMENT_LIMIT_PER_VARIANT = 10;
const SUPPORTED_ITEM_FIELDS = new Set([
  "sku",
  "name",
  "hsnSac",
  "category",
  "unit",
  "itemType",
  "metadata",
  "variants",
]);
const HSN_SAC_DIGITS_PATTERN = /^\d+$/;
const METADATA_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const ITEM_METADATA_MAX_BYTES = 8 * 1024;
const VARIANT_METADATA_MAX_BYTES = 4 * 1024;
const METADATA_MAX_DEPTH = 4;
const METADATA_MAX_KEYS = 100;
const METADATA_MAX_STRING_LENGTH = 500;
type ItemPayload = {
  sku?: string | null;
  name?: string;
  hsnSac?: string | null;
  category?: string | null;
  unit?: string;
  itemType?: string;
  metadata?: Record<string, unknown> | null;
  variants?: VariantPayload[];
};
type VariantPayload = {
  id?: string;
  itemId?: string;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  optionValues?: Record<string, string>;
  metadata?: Record<string, unknown> | null;
  salesPrice?: number | string | null;
  purchasePrice?: number | string | null;
};
type CustomerPayload = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNo?: string | null;
};
type PriceTypeValue = "SALES" | "PURCHASE";
type PriceTaxModeValue = "EXCLUSIVE" | "INCLUSIVE";
const DEFAULT_ITEM_VALUES = {
  name: "Untitled Item",
  unit: "PCS",
  itemType: "PRODUCT" as const,
};
const DEFAULT_PRICE_BOOK_CODE = "STANDARD";
const DEFAULT_PRICE_BOOK_NAME = "Standard";
const DEFAULT_PRICE_CURRENCY = "INR";
const STOCK_ADJUSTMENT_REASONS = new Set([
  "OPENING_BALANCE",
  "ADJUSTMENT_INCREASE",
  "ADJUSTMENT_DECREASE",
]);
const PRICE_TYPES = new Set(["SALES", "PURCHASE"]);
const PRICE_TAX_MODES = new Set(["EXCLUSIVE", "INCLUSIVE"]);
const GST_SLAB_PATTERN = /^[A-Z0-9][A-Z0-9._/%-]{0,31}$/;
const prismaAny = prisma as any;

const toReasonCodeFromStatus = (statusCode?: number): SyncRejectionReasonCode => {
  if (statusCode === 403) return "PERMISSION_DENIED";
  if (statusCode === 404) return "DEPENDENCY_MISSING";
  if (statusCode === 409) return "VERSION_CONFLICT";
  return "VALIDATION_FAILED";
};

const toSyncRejection = (
  mutation,
  error: unknown,
): SyncRejection => {
  if (error instanceof SyncRejectionError) {
    return {
      mutationId: mutation.mutationId,
      status: "rejected",
      reasonCode: error.reasonCode,
      message: error.message,
      entity: error.entity,
      entityId: error.entityId,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof AppError) {
    return {
      mutationId: mutation.mutationId,
      status: "rejected",
      reasonCode: toReasonCodeFromStatus(error.statusCode),
      message: error.message,
      entity: mutation.entity,
      entityId: mutation.entityId,
    };
  }

  return {
    mutationId: mutation.mutationId,
    status: "rejected",
    reasonCode: "VALIDATION_FAILED",
    message: error instanceof Error ? error.message : "Mutation failed",
    entity: mutation.entity,
    entityId: mutation.entityId,
  };
};

const mapAppliedOutcomeEntity = (entity: string, entityId: string): AppliedOutcomeEntity => ({
  entity,
  entityId,
});

const toResultStatus = (status: MutationLogResultStatus): SyncResultRecord["resultStatus"] =>
  status === "APPLIED" ? "applied" : "rejected";

const toOperationLabel = (count: number, noun: string, verb: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"} ${count === 1 ? `was ${verb}` : `were ${verb}`}`;

const buildAppliedOutcomeSummary = (outcome: Omit<AppliedOutcome, "summary" | "category">) => {
  const archivedCount = outcome.archived.length;
  const purgedCount = outcome.purged.length;
  const updatedCount = outcome.updated.length;

  if (archivedCount > 0 && purgedCount > 0) {
    return {
      category: "hybrid_delete" as const,
      summary: `${toOperationLabel(archivedCount, "entity", "archived")} and ${toOperationLabel(purgedCount, "entity", "permanently deleted")}.`,
    };
  }

  if (purgedCount > 0) {
    return {
      category: "mutation" as const,
      summary: `${toOperationLabel(purgedCount, "entity", "permanently deleted")}.`,
    };
  }

  if (archivedCount > 0) {
    return {
      category: "mutation" as const,
      summary: `${toOperationLabel(archivedCount, "entity", "archived")}.`,
    };
  }

  if (updatedCount > 0) {
    return {
      category: "mutation" as const,
      summary: `${toOperationLabel(updatedCount, "entity", "updated")}.`,
    };
  }

  return {
    category: "mutation" as const,
    summary: "Mutation applied.",
  };
};

const buildAppliedOutcome = (
  mutation,
  additionalChanges: Array<{
    entity: string;
    entityId: string;
    operation: "CREATE" | "UPDATE" | "DELETE" | "PURGE";
    data: Record<string, unknown>;
  }>,
): AppliedOutcome => {
  const archived: AppliedOutcomeEntity[] = [];
  const purged: AppliedOutcomeEntity[] = [];
  const updated: AppliedOutcomeEntity[] = [];

  const applyOperation = (
    entity: string,
    entityId: string,
    operation: "create" | "update" | "delete" | "purge" | "CREATE" | "UPDATE" | "DELETE" | "PURGE",
  ) => {
    if (operation === "delete" || operation === "DELETE") {
      archived.push(mapAppliedOutcomeEntity(entity, entityId));
      return;
    }
    if (operation === "purge" || operation === "PURGE") {
      purged.push(mapAppliedOutcomeEntity(entity, entityId));
      return;
    }
    updated.push(mapAppliedOutcomeEntity(entity, entityId));
  };

  applyOperation(mutation.entity, mutation.entityId, mutation.op);
  for (const change of additionalChanges) {
    applyOperation(change.entity, change.entityId, change.operation);
  }

  const summary = buildAppliedOutcomeSummary({ archived, purged, updated });
  return {
    category: summary.category,
    summary: summary.summary,
    archived,
    purged,
    updated,
  };
};

const buildRejectedResultPayload = (rejection: SyncRejection) => ({
  reasonCode: rejection.reasonCode,
  message: rejection.message,
  ...(rejection.details ? { details: rejection.details } : {}),
});

const persistRejectedMutationResult = async (
  tenantId: string,
  mutation,
  rejection: SyncRejection,
) => {
  const processedAt = new Date();
  const resultPayload = buildRejectedResultPayload(rejection);

  await prismaAny.syncMutationLog.upsert({
    where: { mutation_id: mutation.mutationId },
    update: {
      result_status: "REJECTED",
      result_summary: rejection.message,
      result_payload: resultPayload,
      processed_at: processedAt,
    },
    create: {
      mutation_id: mutation.mutationId,
      tenant_id: tenantId,
      device_id: mutation.deviceId,
      user_id: mutation.userId,
      entity: mutation.entity,
      entity_id: mutation.entityId,
      operation: toPrismaSyncOperation(mutation.op),
      payload: mutation.payload,
      base_version: mutation.baseVersion,
      client_timestamp: new Date(mutation.clientTimestamp),
      result_status: "REJECTED",
      result_summary: rejection.message,
      result_payload: resultPayload,
      processed_at: processedAt,
    },
  });
};

const mapMutationLogToSyncResultRecord = (entry): SyncResultRecord | null => {
  if (!entry?.result_status || !entry?.processed_at) {
    return null;
  }

  const base = {
    mutationId: entry.mutation_id,
    entity: entry.entity,
    entityId: entry.entity_id,
    operation: toSyncOperation(entry.operation),
    resultStatus: toResultStatus(entry.result_status),
    summary:
      typeof entry.result_summary === "string" && entry.result_summary.trim().length > 0
        ? entry.result_summary
        : entry.result_status === "APPLIED"
          ? "Mutation applied."
          : "Mutation rejected.",
    processedAt: entry.processed_at.toISOString(),
    userId: entry.user_id,
  } satisfies Omit<SyncResultRecord, "outcome" | "rejection">;

  if (entry.result_status === "APPLIED") {
    return {
      ...base,
      ...(entry.result_payload &&
      typeof entry.result_payload === "object" &&
      !Array.isArray(entry.result_payload)
        ? { outcome: entry.result_payload as AppliedOutcome }
        : {}),
    };
  }

  const payload =
    entry.result_payload && typeof entry.result_payload === "object" && !Array.isArray(entry.result_payload)
      ? (entry.result_payload as Record<string, unknown>)
      : null;

  return {
    ...base,
    ...(payload
      ? {
          rejection: {
            reasonCode:
              typeof payload.reasonCode === "string"
                ? (payload.reasonCode as SyncRejectionReasonCode)
                : "VALIDATION_FAILED",
            ...(payload.details &&
            typeof payload.details === "object" &&
            !Array.isArray(payload.details)
              ? { details: payload.details as Record<string, unknown> }
              : {}),
          },
        }
      : {}),
  };
};

const validationError = (
  message: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
) =>
  new SyncRejectionError({
    message,
    statusCode: 400,
    reasonCode: "VALIDATION_FAILED",
    entity,
    entityId,
    details,
  });

const dependencyMissingError = (
  message: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
) =>
  new SyncRejectionError({
    message,
    statusCode: 404,
    reasonCode: "DEPENDENCY_MISSING",
    entity,
    entityId,
    details,
  });

const permissionDeniedError = (
  message: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
) =>
  new SyncRejectionError({
    message,
    statusCode: 403,
    reasonCode: "PERMISSION_DENIED",
    entity,
    entityId,
    details,
  });

const entityInUseError = (
  message: string,
  entity: string,
  entityId: string,
  usageKinds: string[],
  details?: Record<string, unknown>,
) =>
  new SyncRejectionError({
    message,
    statusCode: 409,
    reasonCode: "ENTITY_IN_USE",
    entity,
    entityId,
    details: {
      usageKinds,
      message,
      ...(details ?? {}),
    },
  });

const toPrismaSyncOperation = (op) => {
  if (op === "create") return "CREATE";
  if (op === "update") return "UPDATE";
  if (op === "purge") return "PURGE";
  return "DELETE";
};

const hasItemCapabilityForType = (
  itemType: "PRODUCT" | "SERVICE",
  options: {
    canManageProducts?: boolean;
    canManageServices?: boolean;
  },
) => {
  if (itemType === "SERVICE") {
    return Boolean(options.canManageServices);
  }
  return Boolean(options.canManageProducts);
};

const getItemTypePermissionMessage = (itemType: "PRODUCT" | "SERVICE") =>
  itemType === "SERVICE"
    ? "Service management is not enabled for this store license"
    : "Product management is not enabled for this store license";

const resolveRequestedItemType = (payload: unknown): "PRODUCT" | "SERVICE" => {
  const raw =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).itemType : undefined;
  return raw === "SERVICE" ? "SERVICE" : "PRODUCT";
};

const resolveExistingItemType = async (tenantId: string, itemId: string) => {
  const item = await prismaAny.item.findUnique({
    where: { id: itemId },
    select: {
      business_id: true,
      item_type: true,
    },
  });
  if (!item || item.business_id !== tenantId) {
    return null;
  }
  return item.item_type === "SERVICE" ? "SERVICE" : "PRODUCT";
};

const resolveVariantItemType = async (tenantId: string, variantId: string) => {
  const variant = await prismaAny.itemVariant.findUnique({
    where: { id: variantId },
    select: {
      business_id: true,
      item: {
        select: {
          business_id: true,
          item_type: true,
        },
      },
    },
  });
  if (
    !variant ||
    variant.business_id !== tenantId ||
    !variant.item ||
    variant.item.business_id !== tenantId
  ) {
    return null;
  }
  return variant.item.item_type === "SERVICE" ? "SERVICE" : "PRODUCT";
};

const assertItemMutationCapability = async (
  tenantId: string,
  mutation,
  options: {
    canManageProducts?: boolean;
    canManageServices?: boolean;
  },
) => {
  if (mutation.entity === "item") {
    if (mutation.op === "create") {
      const requestedType = resolveRequestedItemType(mutation.payload);
      if (!hasItemCapabilityForType(requestedType, options)) {
        throw permissionDeniedError(
          getItemTypePermissionMessage(requestedType),
          mutation.entity,
          mutation.entityId,
        );
      }
      return;
    }

    const currentType = await resolveExistingItemType(tenantId, mutation.entityId);
    if (currentType && !hasItemCapabilityForType(currentType, options)) {
      throw permissionDeniedError(
        getItemTypePermissionMessage(currentType),
        mutation.entity,
        mutation.entityId,
      );
    }
    if (mutation.op === "update" && currentType) {
      const requestedType = resolveRequestedItemType(mutation.payload);
      if (requestedType !== currentType && !hasItemCapabilityForType(requestedType, options)) {
        throw permissionDeniedError(
          getItemTypePermissionMessage(requestedType),
          mutation.entity,
          mutation.entityId,
        );
      }
    }
    return;
  }

  if (mutation.entity === "item_variant") {
    const variantPayload =
      mutation.payload && typeof mutation.payload === "object"
        ? (mutation.payload as Record<string, unknown>)
        : {};
    const parentItemId =
      mutation.op === "create" && typeof variantPayload.itemId === "string"
        ? variantPayload.itemId
        : null;
    const itemType = parentItemId
      ? await resolveExistingItemType(tenantId, parentItemId)
      : await resolveVariantItemType(tenantId, mutation.entityId);
    if (itemType && !hasItemCapabilityForType(itemType, options)) {
      throw permissionDeniedError(
        getItemTypePermissionMessage(itemType),
        mutation.entity,
        mutation.entityId,
      );
    }
    return;
  }

  if (mutation.entity === "item_price") {
    const pricePayload =
      mutation.payload && typeof mutation.payload === "object"
        ? (mutation.payload as Record<string, unknown>)
        : {};
    const variantId =
      typeof pricePayload.variantId === "string" && pricePayload.variantId
        ? pricePayload.variantId
        : mutation.entityId;
    const itemType = await resolveVariantItemType(tenantId, variantId);
    if (itemType && !hasItemCapabilityForType(itemType, options)) {
      throw permissionDeniedError(
        getItemTypePermissionMessage(itemType),
        mutation.entity,
        mutation.entityId,
      );
    }
    return;
  }

  if (
    (mutation.entity === "item_category" ||
      mutation.entity === "item_collection" ||
      mutation.entity === "item_collection_item") &&
    !options.canManageProducts &&
    !options.canManageServices
  ) {
    throw permissionDeniedError(
      "Item management is not enabled for this store license",
      mutation.entity,
      mutation.entityId,
    );
  }
};

const toSyncOperation = (op) => {
  if (op === "CREATE") return "create";
  if (op === "UPDATE") return "update";
  if (op === "PURGE") return "purge";
  return "delete";
};

const normalizeSyncEntityState = (
  entity,
  op,
  data,
  serverTimestamp,
) => {
  const base =
    data && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>) }
      : {};

  const derivedIsActive = (() => {
    if (op === "delete") return false;
    if (typeof base.isActive === "boolean") return base.isActive;
    if (entity === "item" && Array.isArray(base.variants)) {
      const variantRows = base.variants.filter(
        (value) => typeof value === "object" && value !== null,
      ) as Array<Record<string, unknown>>;
      if (variantRows.length === 0) return true;
      return variantRows.some((variant) => variant.isActive !== false);
    }
    return true;
  })();

  return {
    ...base,
    isActive: derivedIsActive,
    deletedAt: op === "delete" ? serverTimestamp : null,
  };
};

const toDeletedAtValue = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const normalizeMetadataValue = (
  value: unknown,
  options: {
    entity: string;
    entityId: string;
    maxBytes: number;
  },
): Record<string, unknown> | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isPlainObject(value)) {
    throw validationError(
      "metadata must be a JSON object or null",
      options.entity,
      options.entityId,
      { field: "metadata" },
    );
  }

  let keyCount = 0;
  const normalizeNode = (node: unknown, path: string, depth: number): unknown => {
    if (depth > METADATA_MAX_DEPTH) {
      throw validationError(
        `metadata depth must be ${METADATA_MAX_DEPTH} or less`,
        options.entity,
        options.entityId,
        { field: "metadata", path },
      );
    }

    if (node === null || typeof node === "boolean") return node;
    if (typeof node === "number") {
      if (!Number.isFinite(node)) {
        throw validationError(
          "metadata numbers must be finite",
          options.entity,
          options.entityId,
          { field: "metadata", path },
        );
      }
      return node;
    }
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed.length > METADATA_MAX_STRING_LENGTH) {
        throw validationError(
          `metadata string values must be ${METADATA_MAX_STRING_LENGTH} characters or less`,
          options.entity,
          options.entityId,
          { field: "metadata", path },
        );
      }
      return trimmed;
    }
    if (Array.isArray(node)) {
      return node.map((entry) => normalizeNode(entry, path, depth + 1));
    }
    if (!isPlainObject(node)) {
      throw validationError(
        "metadata contains unsupported value types",
        options.entity,
        options.entityId,
        { field: "metadata", path },
      );
    }

    const normalizedObject: Record<string, unknown> = {};
    for (const [rawKey, rawValue] of Object.entries(node)) {
      const key = rawKey.trim();
      if (!METADATA_KEY_PATTERN.test(key)) {
        throw validationError(
          "metadata keys must start with a letter and use lowercase letters, numbers, dot, underscore, or hyphen",
          options.entity,
          options.entityId,
          { field: "metadata", key: rawKey, path },
        );
      }

      const fullPath = path ? `${path}.${key}` : key;
      if (fullPath.startsWith("sys.") || fullPath === "sys") {
        throw validationError(
          "metadata under sys.* is reserved",
          options.entity,
          options.entityId,
          { field: "metadata", path: fullPath },
        );
      }
      if (fullPath.startsWith("billing.") || fullPath === "billing") {
        throw validationError(
          "metadata under billing.* is reserved",
          options.entity,
          options.entityId,
          { field: "metadata", path: fullPath },
        );
      }
      if (!fullPath.startsWith("custom.") && fullPath !== "custom") {
        throw validationError(
          "metadata keys must live under custom.*",
          options.entity,
          options.entityId,
          { field: "metadata", path: fullPath },
        );
      }

      keyCount += 1;
      if (keyCount > METADATA_MAX_KEYS) {
        throw validationError(
          `metadata can contain at most ${METADATA_MAX_KEYS} keys`,
          options.entity,
          options.entityId,
          { field: "metadata" },
        );
      }

      normalizedObject[key] = normalizeNode(rawValue, fullPath, depth + 1);
    }

    return normalizedObject;
  };

  const normalized = normalizeNode(value, "", 1);
  if (!isPlainObject(normalized)) {
    throw validationError(
      "metadata must be a JSON object",
      options.entity,
      options.entityId,
      { field: "metadata" },
    );
  }

  const bytes = Buffer.byteLength(JSON.stringify(normalized), "utf8");
  if (bytes > options.maxBytes) {
    throw validationError(
      `metadata exceeds size limit of ${options.maxBytes} bytes`,
      options.entity,
      options.entityId,
      { field: "metadata", bytes, maxBytes: options.maxBytes },
    );
  }

  return normalized;
};

const sanitizeItemPayload = (payload) => {
  const normalized: ItemPayload = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!SUPPORTED_ITEM_FIELDS.has(key)) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
};

const sanitizeVariantPayload = (payload) => {
  const raw = (payload ?? {}) as VariantPayload;
  const normalized: VariantPayload = {};

  if (typeof raw.id === "string" && raw.id) {
    normalized.id = raw.id;
  }
  if (typeof raw.itemId === "string" && raw.itemId) {
    normalized.itemId = raw.itemId;
  }
  if (raw.name === null) {
    normalized.name = null;
  } else if (typeof raw.name === "string") {
    normalized.name = raw.name;
  }
  if (raw.barcode === null) {
    normalized.barcode = null;
  } else if (typeof raw.barcode === "string") {
    normalized.barcode = raw.barcode;
  }
  if (typeof raw.isDefault === "boolean") {
    normalized.isDefault = raw.isDefault;
  }
  if (typeof raw.isActive === "boolean") {
    normalized.isActive = raw.isActive;
  }

  const normalizedSku = normalizeSku(raw.sku);
  if (raw.sku === null) {
    normalized.sku = null;
  } else if (normalizedSku !== undefined) {
    normalized.sku = normalizedSku;
  }

  if (raw.optionValues && typeof raw.optionValues === "object") {
    const entries = Object.entries(raw.optionValues).filter(
      ([key, value]) =>
        typeof key === "string" &&
        key.trim().length > 0 &&
        typeof value === "string" &&
        value.trim().length > 0,
    );
    normalized.optionValues = Object.fromEntries(
      entries.map(([key, value]) => [key.trim(), String(value).trim()]),
    );
  }
  if (raw.metadata === null) {
    normalized.metadata = null;
  } else if (raw.metadata !== undefined) {
    normalized.metadata = raw.metadata;
  }
  if (raw.salesPrice !== undefined) {
    normalized.salesPrice = raw.salesPrice;
  }
  if (raw.purchasePrice !== undefined) {
    normalized.purchasePrice = raw.purchasePrice;
  }

  return normalized;
};

const normalizeSku = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeCategory = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeHsnSac = (
  value: unknown,
  itemType: "PRODUCT" | "SERVICE",
  options: { entity: string; entityId: string },
) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw validationError("hsnSac must be a string or null", options.entity, options.entityId, {
      field: "hsnSac",
    });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HSN_SAC_DIGITS_PATTERN.test(trimmed)) {
    throw validationError("hsnSac must contain digits only", options.entity, options.entityId, {
      field: "hsnSac",
    });
  }
  if (itemType === "SERVICE") {
    if (trimmed.length !== 6) {
      throw validationError(
        "SAC code must be exactly 6 digits for services",
        options.entity,
        options.entityId,
        { field: "hsnSac" },
      );
    }
    return trimmed;
  }
  if (trimmed.length < 4 || trimmed.length > 8) {
    throw validationError(
      "HSN code must be 4 to 8 digits for products",
      options.entity,
      options.entityId,
      { field: "hsnSac" },
    );
  }
  return trimmed;
};

const normalizePriceType = (
  value: unknown,
  options: { entity: string; entityId: string },
): PriceTypeValue => {
  if (value === undefined || value === null || value === "") return "SALES";
  if (typeof value !== "string") {
    throw validationError("priceType is invalid", options.entity, options.entityId, {
      field: "priceType",
    });
  }
  const normalized = value.trim().toUpperCase();
  if (!PRICE_TYPES.has(normalized)) {
    throw validationError("priceType must be SALES or PURCHASE", options.entity, options.entityId, {
      field: "priceType",
      value,
    });
  }
  return normalized as PriceTypeValue;
};

const normalizePriceTaxMode = (
  value: unknown,
  options: { entity: string; entityId: string },
): PriceTaxModeValue => {
  if (value === undefined || value === null || value === "") return "EXCLUSIVE";
  if (typeof value !== "string") {
    throw validationError("taxMode is invalid", options.entity, options.entityId, {
      field: "taxMode",
    });
  }
  const normalized = value.trim().toUpperCase();
  if (!PRICE_TAX_MODES.has(normalized)) {
    throw validationError(
      "taxMode must be EXCLUSIVE or INCLUSIVE",
      options.entity,
      options.entityId,
      {
        field: "taxMode",
        value,
      },
    );
  }
  return normalized as PriceTaxModeValue;
};

const normalizeGstSlab = (
  value: unknown,
  options: { entity: string; entityId: string },
) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw validationError("gstSlab is invalid", options.entity, options.entityId, {
      field: "gstSlab",
    });
  }
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!GST_SLAB_PATTERN.test(normalized)) {
    throw validationError(
      "gstSlab must use uppercase letters, numbers, percent, dot, underscore, slash, or hyphen",
      options.entity,
      options.entityId,
      { field: "gstSlab" },
    );
  }
  return normalized;
};

const normalizeOptionalPriceAmount = (
  value: unknown,
  options: { entity: string; entityId: string; field: "salesPrice" | "purchasePrice" },
) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw validationError(
      `${options.field} must be a non-negative number or null`,
      options.entity,
      options.entityId,
      { field: options.field },
    );
  }

  return Number(parsed.toFixed(2));
};

const ensureCategoryExists = async (tx, tenantId: string, category: string) => {
  const trimmed = category.trim();
  if (!trimmed) return;
  const existing = await tx.itemCategory.findFirst({
    where: {
      business_id: tenantId,
      name: trimmed,
    },
    select: {
      id: true,
      is_active: true,
      deleted_at: true,
    },
  });

  if (!existing) {
    await tx.itemCategory.create({
      data: {
        business_id: tenantId,
        name: trimmed,
      },
    });
    return;
  }

  if (!existing.is_active || existing.deleted_at) {
    await tx.itemCategory.update({
      where: { id: existing.id },
      data: {
        is_active: true,
        deleted_at: null,
      },
    });
  }
};

const assertUniqueActiveItemName = async (
  tx,
  tenantId: string,
  name: string,
  entity: string,
  entityId: string,
  excludeItemId?: string,
) => {
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await tx.item.findFirst({
    where: {
      business_id: tenantId,
      name: trimmed,
      is_active: true,
      deleted_at: null,
      ...(excludeItemId
        ? {
            id: {
              not: excludeItemId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw validationError("Item name already exists in this business.", entity, entityId, {
      field: "name",
      conflictingEntityId: existing.id,
    });
  }
};

const assertUniqueActivePartyName = async (
  tx,
  tenantId: string,
  name: string,
  entity: string,
  entityId: string,
  excludePartyId?: string,
) => {
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await tx.party.findFirst({
    where: {
      business_id: tenantId,
      name: trimmed,
      is_active: true,
      deleted_at: null,
      ...(excludePartyId
        ? {
            id: {
              not: excludePartyId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw validationError("Party name already exists in this business.", entity, entityId, {
      field: "name",
      conflictingEntityId: existing.id,
    });
  }
};

const assertUniqueActiveSku = async (
  tx,
  tenantId: string,
  sku: string | null | undefined,
  entity: string,
  entityId: string,
  excludeVariantId?: string,
) => {
  const normalizedSku = normalizeSku(sku);
  if (normalizedSku === undefined || normalizedSku === null) {
    return;
  }

  const existing = await tx.itemVariant.findFirst({
    where: {
      business_id: tenantId,
      sku: normalizedSku,
      is_active: true,
      deleted_at: null,
      ...(excludeVariantId
        ? {
            id: {
              not: excludeVariantId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw validationError("SKU already exists in this business.", entity, entityId, {
      field: "sku",
      conflictingEntityId: existing.id,
    });
  }
};

const assertUniqueSkusInItemPayload = (
  variants: Array<{ sku?: string | null }>,
  entity: string,
  entityId: string,
) => {
  const seen = new Set<string>();

  for (const variant of variants) {
    const normalizedSku = normalizeSku(variant.sku);
    if (normalizedSku === undefined || normalizedSku === null) {
      continue;
    }

    if (seen.has(normalizedSku)) {
      throw validationError("SKU must be unique within the item.", entity, entityId, {
        field: "sku",
        value: normalizedSku,
      });
    }

    seen.add(normalizedSku);
  }
};

const buildItemForCreate = (payload, options: { entity: string; entityId: string }) => {
  const normalized = sanitizeItemPayload(payload);
  const metadata = normalizeMetadataValue(normalized.metadata, {
    ...options,
    maxBytes: ITEM_METADATA_MAX_BYTES,
  });
  const itemType = normalized.itemType === "SERVICE" ? "SERVICE" : DEFAULT_ITEM_VALUES.itemType;
  const hsnSac = normalizeHsnSac(normalized.hsnSac, itemType, options);

  return {
    item: {
      name:
        typeof normalized.name === "string" && normalized.name.trim()
          ? normalized.name.trim()
          : DEFAULT_ITEM_VALUES.name,
      category: normalizeCategory(normalized.category) ?? null,
      unit:
        typeof normalized.unit === "string" ? normalized.unit : DEFAULT_ITEM_VALUES.unit,
      item_type: itemType,
      hsn_sac: hsnSac ?? null,
      metadata: metadata ?? null,
    },
    defaultVariant: {
      sku: normalizeSku(normalized.sku) ?? null,
      is_default: true,
      is_active: true,
    },
    variants: Array.isArray(normalized.variants)
      ? normalized.variants.map((variant) => sanitizeVariantPayload(variant))
      : [],
  };
};

const buildItemForUpdate = (
  payload,
  options: { entity: string; entityId: string },
) => {
  const normalized = sanitizeItemPayload(payload);
  const patch: ItemPayload & {
    item_type?: string;
    hsn_sac?: string | null;
  } = {};
  let sku: string | null | undefined = undefined;
  let category: string | null | undefined = undefined;
  let metadata: Record<string, unknown> | null | undefined = undefined;

  const normalizedSku = normalizeSku(normalized.sku);
  if (normalized.sku === null) {
    sku = null;
  } else if (normalizedSku !== undefined) {
    sku = normalizedSku;
  }
  if (typeof normalized.name === "string" && normalized.name.trim()) {
    patch.name = normalized.name.trim();
  }
  const normalizedCategory = normalizeCategory(normalized.category);
  if (normalized.category === null) {
    category = null;
  } else if (normalizedCategory !== undefined) {
    category = normalizedCategory;
  }
  if (typeof normalized.unit === "string") {
    patch.unit = normalized.unit;
  }
  if (normalized.itemType === "PRODUCT" || normalized.itemType === "SERVICE") {
    patch.item_type = normalized.itemType;
  }
  if (Object.hasOwn(normalized, "hsnSac")) {
    patch.hsnSac = normalized.hsnSac;
  }
  metadata = normalizeMetadataValue(normalized.metadata, {
    ...options,
    maxBytes: ITEM_METADATA_MAX_BYTES,
  });
  if (metadata !== undefined) {
    patch.metadata = metadata;
  }

  return {
    itemPatch: patch,
    category,
    sku,
  };
};

const toItemSnapshot = (item, defaultVariant) => {
  return {
    id: item.id,
    businessId: item.business_id,
    itemType: item.item_type,
    name: item.name,
    hsnSac: item.hsn_sac ?? null,
    category: item.category ?? null,
    unit: item.unit,
    sku: defaultVariant?.sku ?? null,
    defaultVariantId: defaultVariant?.id ?? null,
    metadata: item.metadata ?? null,
    isActive: item.is_active ?? true,
    deletedAt: toDeletedAtValue(item.deleted_at),
  };
};

const toVariantSnapshot = (
  variant,
  optionValues: Record<string, string> = {},
  usageCount = 0,
) => {
  const isLocked = usageCount > 0;
  return {
    id: variant.id,
    itemId: variant.item_id,
    businessId: variant.business_id,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    name: variant.name ?? null,
    metadata: variant.metadata ?? null,
    isDefault: variant.is_default,
    isActive: variant.is_active,
    deletedAt: toDeletedAtValue(variant.deleted_at),
    optionValues,
    usageCount,
    isLocked,
  };
};

const toItemCategorySnapshot = (category) => {
  return {
    id: category.id,
    businessId: category.business_id,
    name: category.name,
    isActive: category.is_active ?? true,
    deletedAt: toDeletedAtValue(category.deleted_at),
  };
};

const toItemCollectionSnapshot = (collection) => {
  return {
    id: collection.id,
    businessId: collection.business_id,
    name: collection.name,
    isActive: collection.is_active ?? true,
    deletedAt: toDeletedAtValue(collection.deleted_at),
  };
};

const toItemCollectionItemSnapshot = (membership) => {
  return {
    id: membership.id,
    businessId: membership.business_id,
    collectionId: membership.collection_id,
    variantId: membership.variant_id,
    isActive: membership.is_active ?? true,
    deletedAt: toDeletedAtValue(membership.deleted_at),
  };
};

const toStockAdjustmentSnapshot = (entry, stockLevelEntityId: string, quantityOnHand: number) => {
  return {
    id: entry.id,
    businessId: entry.business_id,
    variantId: entry.variant_id,
    quantity: Number(entry.quantity),
    reason: entry.reason,
    referenceId: entry.reference_id ?? null,
    stockLevelEntityId: stockLevelEntityId,
    quantityOnHand,
    createdAt: entry.created_at.toISOString(),
    isActive: entry.is_active ?? true,
    deletedAt: toDeletedAtValue(entry.deleted_at),
  };
};

const getNextServerVersion = async (txAny, tenantId, entity, entityId) => {
  const latestEntityChange = await txAny.syncChangeLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
    },
    orderBy: { server_version: "desc" },
    select: { server_version: true },
  });
  return (latestEntityChange?.server_version ?? 0) + 1;
};

const getCurrentEntityServerVersion = async (txAny, tenantId, entity, entityId) => {
  const latestEntityChange = await txAny.syncChangeLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
    },
    orderBy: { server_version: "desc" },
    select: { server_version: true },
  });
  return latestEntityChange?.server_version ?? 0;
};

const assertEntityBaseVersion = async (
  txAny,
  tenantId,
  entity,
  entityId,
  baseVersion?: number,
) => {
  if (baseVersion === undefined) return;
  const currentVersion = await getCurrentEntityServerVersion(
    txAny,
    tenantId,
    entity,
    entityId,
  );
  if (baseVersion !== currentVersion) {
    throw new SyncRejectionError({
      message: `Version conflict for ${entity}:${entityId}. Current version is ${currentVersion}, but mutation was based on ${baseVersion}.`,
      statusCode: 409,
      reasonCode: "VERSION_CONFLICT",
      entity,
      entityId,
      details: {
        currentVersion,
        baseVersion,
      },
    });
  }
};

const appendSyncChange = async (
  txAny,
  tenantId,
  entity,
  entityId,
  operation,
  data,
) => {
  const serverVersion = await getNextServerVersion(txAny, tenantId, entity, entityId);
  await txAny.syncChangeLog.create({
    data: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
      operation,
      data,
      server_version: serverVersion,
    },
  });
};

const getDefaultVariant = async (tx, tenantId, itemId) => {
  const txAny = tx as any;
  return txAny.itemVariant.findFirst({
    where: {
      item_id: itemId,
      business_id: tenantId,
      is_default: true,
      deleted_at: null,
    },
  });
};

const getVariantOptionValues = async (tx, variantId) => {
  const links = await tx.itemVariantOptionValue.findMany({
    where: { variant_id: variantId },
    include: {
      option_value: {
        include: {
          option: true,
        },
      },
    },
  });

  const optionValues: Record<string, string> = {};
  for (const link of links) {
    const optionName = link.option_value?.option?.name;
    const value = link.option_value?.value;
    if (optionName && value) {
      optionValues[optionName] = value;
    }
  }
  return optionValues;
};

const getVariantUsageSummary = async (tx, tenantId, variantId) => {
  const txAny = tx as any;
  const stockLedgerCountPromise = tx.stockLedger.count({
    where: {
      business_id: tenantId,
      variant_id: variantId,
    },
  });

  const activityDelegate = txAny.itemActivityProjection;
  const activityCountPromise =
    activityDelegate && typeof activityDelegate.count === "function"
      ? activityDelegate
          .count({
            where: {
              business_id: tenantId,
              variant_id: variantId,
            },
          })
          .catch(() => 0)
      : Promise.resolve(0);

  const [stockLedgerCount, activityCount] = await Promise.all([
    stockLedgerCountPromise,
    activityCountPromise,
  ]);

  return {
    stockLedgerCount,
    activityCount,
  };
};

const getVariantUsageCount = async (tx, tenantId, variantId) => {
  const usage = await getVariantUsageSummary(tx, tenantId, variantId);
  return usage.stockLedgerCount + usage.activityCount;
};

const getItemUsageSummary = async (tx, tenantId, itemId, variantIds: string[]) => {
  const txAny = tx as any;
  const lineItemCountPromise =
    txAny.lineItem && typeof txAny.lineItem.count === "function"
      ? txAny.lineItem.count({
          where: {
            item_id: itemId,
          },
        })
      : Promise.resolve(0);
  const activityDelegate = txAny.itemActivityProjection;
  const activityCountPromise =
    activityDelegate && typeof activityDelegate.count === "function"
      ? activityDelegate
          .count({
            where: {
              business_id: tenantId,
              item_id: itemId,
            },
          })
          .catch(() => 0)
      : Promise.resolve(0);
  const stockLedgerCountPromise =
    variantIds.length > 0
      ? tx.stockLedger.count({
          where: {
            business_id: tenantId,
            variant_id: {
              in: variantIds,
            },
          },
        })
      : Promise.resolve(0);

  const [lineItemCount, activityCount, stockLedgerCount] = await Promise.all([
    lineItemCountPromise,
    activityCountPromise,
    stockLedgerCountPromise,
  ]);

  return {
    lineItemCount,
    activityCount,
    stockLedgerCount,
  };
};

const formatUsageKinds = (usageKinds: string[]) => {
  const labels = usageKinds.map((kind) => {
    if (kind === "stock_history") return "stock history";
    if (kind === "item_activity") return "item activity";
    if (kind === "documents") return "documents";
    if (kind === "item_reference") return "item references";
    if (kind === "variant_count") return "remaining variant requirements";
    return kind.replace(/_/g, " ");
  });
  if (labels.length <= 1) return labels[0] ?? "usage";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const buildPriceChangeEntityId = (
  variantId: string,
  priceType: "SALES" | "PURCHASE",
) => `${variantId}:${priceType}`;

const deleteVariantCommercialRows = async (txAny: any, variantIds: string[]) => {
  if (variantIds.length === 0) return;

  await Promise.all([
    txAny.itemPrice.deleteMany({
      where: {
        variant_id: {
          in: variantIds,
        },
      },
    }),
    txAny.itemPriceEvent.deleteMany({
      where: {
        variant_id: {
          in: variantIds,
        },
      },
    }),
    txAny.discountRuleVariant?.deleteMany
      ? txAny.discountRuleVariant.deleteMany({
          where: {
            variant_id: {
              in: variantIds,
            },
          },
        })
      : Promise.resolve(),
  ]);
};

const toNullableTrimmedValue = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeCustomerPayload = (payload: unknown): CustomerPayload => {
  const raw = payload && typeof payload === "object" ? (payload as CustomerPayload) : {};
  return {
    name: typeof raw.name === "string" ? raw.name : undefined,
    phone:
      raw.phone === null || typeof raw.phone === "string" ? raw.phone : undefined,
    email:
      raw.email === null || typeof raw.email === "string" ? raw.email : undefined,
    address:
      raw.address === null || typeof raw.address === "string" ? raw.address : undefined,
    gstNo: raw.gstNo === null || typeof raw.gstNo === "string" ? raw.gstNo : undefined,
  };
};

const toCustomerSnapshot = (customer) => {
  return {
    id: customer.id,
    businessId: customer.business_id,
    name: customer.name,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    address: customer.address ?? null,
    gstNo: customer.tax_id ?? null,
    type: customer.type,
    isActive: customer.is_active ?? true,
    deletedAt: toDeletedAtValue(customer.deleted_at),
    createdAt: customer.created_at.toISOString(),
    updatedAt: customer.updated_at.toISOString(),
  };
};

const toSupplierSnapshot = (supplier) => {
  return {
    id: supplier.id,
    businessId: supplier.business_id,
    name: supplier.name,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    gstNo: supplier.tax_id ?? null,
    type: supplier.type,
    isActive: supplier.is_active ?? true,
    deletedAt: toDeletedAtValue(supplier.deleted_at),
    createdAt: supplier.created_at.toISOString(),
    updatedAt: supplier.updated_at.toISOString(),
  };
};

const normalizeOptionValuesForCompare = (value: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, optionValue]) => [key.trim(), optionValue.trim()])
      .filter(([key, optionValue]) => key.length > 0 && optionValue.length > 0)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
};

const variantImmutableFieldsChanged = (
  current,
  currentOptionValues: Record<string, string>,
  payload: VariantPayload,
) => {
  const currentSku = toNullableTrimmedValue(current.sku);
  const currentName = toNullableTrimmedValue(current.name);
  const currentBarcode = toNullableTrimmedValue(current.barcode);

  const requestedSku = toNullableTrimmedValue(payload.sku);
  if (requestedSku !== undefined && requestedSku !== currentSku) {
    return true;
  }

  const requestedName = toNullableTrimmedValue(payload.name);
  if (requestedName !== undefined && requestedName !== currentName) {
    return true;
  }

  const requestedBarcode = toNullableTrimmedValue(payload.barcode);
  if (requestedBarcode !== undefined && requestedBarcode !== currentBarcode) {
    return true;
  }

  if (payload.optionValues !== undefined) {
    const normalizedCurrent = normalizeOptionValuesForCompare(currentOptionValues);
    const normalizedRequested = normalizeOptionValuesForCompare(payload.optionValues);
    if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedRequested)) {
      return true;
    }
  }

  return false;
};

const attachOptionValuesToVariant = async (tx, itemId, variantId, optionValues?: Record<string, string>) => {
  if (!optionValues || Object.keys(optionValues).length === 0) {
    return;
  }

  for (const [optionName, value] of Object.entries(optionValues)) {
    const option = await tx.itemOption.upsert({
      where: {
        item_id_name: {
          item_id: itemId,
          name: optionName,
        },
      },
      update: {},
      create: {
        item_id: itemId,
        name: optionName,
      },
    });

    const optionValue = await tx.itemOptionValue.upsert({
      where: {
        option_id_value: {
          option_id: option.id,
          value,
        },
      },
      update: {},
      create: {
        option_id: option.id,
        value,
      },
    });

    await tx.itemVariantOptionValue.upsert({
      where: {
        variant_id_option_value_id: {
          variant_id: variantId,
          option_value_id: optionValue.id,
        },
      },
      update: {},
      create: {
        variant_id: variantId,
        option_value_id: optionValue.id,
      },
    });
  }
};

const ensureSingleDefaultVariant = async (tx, itemId, preferredVariantId?: string) => {
  const txAny = tx as any;
  const variants = await txAny.itemVariant.findMany({
    where: { item_id: itemId, deleted_at: null },
    orderBy: { id: "asc" },
    select: { id: true, is_default: true },
  });
  if (variants.length === 0) return;

  const desiredDefaultId =
    preferredVariantId ??
    variants.find((variant) => variant.is_default)?.id ??
    variants[0].id;

  await txAny.itemVariant.updateMany({
    where: { item_id: itemId, deleted_at: null, id: { not: desiredDefaultId } },
    data: { is_default: false },
  });
  await txAny.itemVariant.update({
    where: { id: desiredDefaultId },
    data: { is_default: true },
  });
};

const getItemSnapshot = async (tx, tenantId, itemId) => {
  const txAny = tx as any;
  const item = await txAny.item.findUnique({
    where: { id: itemId },
  });
  if (!item || item.business_id !== tenantId || item.deleted_at) {
    throw dependencyMissingError("Entity not found in business", "item", itemId);
  }

  const variants = await txAny.itemVariant.findMany({
    where: { item_id: itemId, business_id: tenantId, deleted_at: null },
  });

  const snapshotVariants = await Promise.all(
    variants.map(async (variant) => {
      const [optionValues, usageCount] = await Promise.all([
        getVariantOptionValues(tx, variant.id),
        getVariantUsageCount(tx, tenantId, variant.id),
      ]);
      return toVariantSnapshot(variant, optionValues, usageCount);
    }),
  );

  const defaultVariant =
    variants.find((variant) => variant.is_default) ??
    variants[0] ??
    null;

  return {
    ...toItemSnapshot(item, defaultVariant),
    variants: snapshotVariants,
    variantCount: snapshotVariants.length,
  };
};

const getTenantCursor = async (tenantId) => {
  const latestChange = await prismaAny.syncChangeLog.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { cursor: "desc" },
    select: { cursor: true },
  });

  return latestChange?.cursor?.toString() ?? "0";
};

const getStockLevelEntityId = (variantId: string) => variantId;

const getStockLevelSnapshot = async (
  tx,
  tenantId: string,
  variantId: string,
) => {
  const txAny = tx as any;
  const [variant, ledgerEntries] = await Promise.all([
    txAny.itemVariant.findUnique({
      where: { id: variantId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            unit: true,
            deleted_at: true,
          },
        },
      },
    }),
    txAny.stockLedger.findMany({
      where: {
        business_id: tenantId,
        variant_id: variantId,
        deleted_at: null,
      },
      select: {
        quantity: true,
      },
    }),
  ]);

  if (!variant || variant.business_id !== tenantId || variant.deleted_at || variant.item?.deleted_at) {
    throw dependencyMissingError("Variant not found in business", "item_variant", variantId);
  }

  const quantityOnHand = ledgerEntries.reduce(
    (total, entry) => total + Number(entry.quantity),
    0,
  );

  return {
    id: getStockLevelEntityId(variant.id),
    variantId: variant.id,
    itemId: variant.item_id,
    itemName: variant.item?.name ?? "",
    variantName: variant.name ?? null,
    sku: variant.sku ?? null,
    unit: variant.item?.unit ?? "PCS",
    quantityOnHand,
  };
};

const applyCustomerMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = sanitizeCustomerPayload(mutation.payload);

  if (mutation.op === "create") {
    const current = await txAny.party.findUnique({
      where: { id: mutation.entityId },
    });
    if (current && current.business_id === tenantId) {
      const promoteMutation = { ...mutation, op: "update" };
      return applyCustomerMutation(tx, tenantId, promoteMutation);
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      throw validationError("Customer name is required", mutation.entity, mutation.entityId);
    }
    await assertUniqueActivePartyName(tx, tenantId, name, mutation.entity, mutation.entityId);

    const created = await txAny.party.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name,
        phone: toNullableTrimmedValue(payload.phone),
        email: toNullableTrimmedValue(payload.email),
        address: toNullableTrimmedValue(payload.address),
        tax_id: toNullableTrimmedValue(payload.gstNo),
        type: "CUSTOMER",
        is_active: true,
        deleted_at: null,
      },
    });

    return toCustomerSnapshot(created);
  }

  const current = await txAny.party.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete") {
      return null;
    }
    throw dependencyMissingError("Customer not found in business", mutation.entity, mutation.entityId);
  }

  if (mutation.op === "delete") {
    if (current.type === "BOTH") {
      const demoted = await txAny.party.update({
        where: { id: mutation.entityId },
        data: {
          type: "SUPPLIER",
          is_active: true,
          deleted_at: null,
        },
      });
      return toSupplierSnapshot(demoted);
    }

    await txAny.party.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });
    return null;
  }

  const patch: Record<string, unknown> = {};
  let nextName = current.name;
  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!name) {
      throw validationError("Customer name is required", mutation.entity, mutation.entityId);
    }
    patch.name = name;
    nextName = name;
  }
  if (payload.phone !== undefined) {
    patch.phone = toNullableTrimmedValue(payload.phone);
  }
  if (payload.email !== undefined) {
    patch.email = toNullableTrimmedValue(payload.email);
  }
  if (payload.address !== undefined) {
    patch.address = toNullableTrimmedValue(payload.address);
  }
  if (payload.gstNo !== undefined) {
    patch.tax_id = toNullableTrimmedValue(payload.gstNo);
  }
  if (current.type === "SUPPLIER") {
    patch.type = "BOTH";
  } else if (current.type !== "BOTH") {
    patch.type = "CUSTOMER";
  }
  patch.is_active = true;
  patch.deleted_at = null;

  if (
    typeof nextName === "string" &&
    (patch.name !== undefined || current.deleted_at || current.is_active === false)
  ) {
    await assertUniqueActivePartyName(
      tx,
      tenantId,
      nextName,
      mutation.entity,
      mutation.entityId,
      current.id,
    );
  }

  const updated =
    Object.keys(patch).length > 0
      ? await txAny.party.update({
          where: { id: mutation.entityId },
          data: patch,
        })
      : current;

  return toCustomerSnapshot(updated);
};

const applySupplierMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = sanitizeCustomerPayload(mutation.payload);

  if (mutation.op === "create") {
    const current = await txAny.party.findUnique({
      where: { id: mutation.entityId },
    });
    if (current && current.business_id === tenantId) {
      const promoteMutation = { ...mutation, op: "update" };
      return applySupplierMutation(tx, tenantId, promoteMutation);
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      throw validationError("Supplier name is required", mutation.entity, mutation.entityId);
    }
    await assertUniqueActivePartyName(tx, tenantId, name, mutation.entity, mutation.entityId);

    const created = await txAny.party.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name,
        phone: toNullableTrimmedValue(payload.phone),
        email: toNullableTrimmedValue(payload.email),
        address: toNullableTrimmedValue(payload.address),
        tax_id: toNullableTrimmedValue(payload.gstNo),
        type: "SUPPLIER",
        is_active: true,
        deleted_at: null,
      },
    });

    return toSupplierSnapshot(created);
  }

  const current = await txAny.party.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete") {
      return null;
    }
    throw dependencyMissingError("Supplier not found in business", mutation.entity, mutation.entityId);
  }

  if (mutation.op === "delete") {
    if (current.type === "BOTH") {
      const demoted = await txAny.party.update({
        where: { id: mutation.entityId },
        data: {
          type: "CUSTOMER",
          is_active: true,
          deleted_at: null,
        },
      });
      return toCustomerSnapshot(demoted);
    }

    await txAny.party.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });
    return null;
  }

  const patch: Record<string, unknown> = {};
  let nextName = current.name;
  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!name) {
      throw validationError("Supplier name is required", mutation.entity, mutation.entityId);
    }
    patch.name = name;
    nextName = name;
  }
  if (payload.phone !== undefined) {
    patch.phone = toNullableTrimmedValue(payload.phone);
  }
  if (payload.email !== undefined) {
    patch.email = toNullableTrimmedValue(payload.email);
  }
  if (payload.address !== undefined) {
    patch.address = toNullableTrimmedValue(payload.address);
  }
  if (payload.gstNo !== undefined) {
    patch.tax_id = toNullableTrimmedValue(payload.gstNo);
  }
  if (current.type === "CUSTOMER") {
    patch.type = "BOTH";
  } else if (current.type !== "BOTH") {
    patch.type = "SUPPLIER";
  }
  patch.is_active = true;
  patch.deleted_at = null;

  if (
    typeof nextName === "string" &&
    (patch.name !== undefined || current.deleted_at || current.is_active === false)
  ) {
    await assertUniqueActivePartyName(
      tx,
      tenantId,
      nextName,
      mutation.entity,
      mutation.entityId,
      current.id,
    );
  }

  const updated =
    Object.keys(patch).length > 0
      ? await txAny.party.update({
          where: { id: mutation.entityId },
          data: patch,
        })
      : current;

  return toSupplierSnapshot(updated);
};

const applyItemMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const toItemPriceSyncEntityId = (variantId: string, priceType: "SALES" | "PURCHASE") =>
    `${variantId}:${priceType}`;
  if (mutation.op === "create") {
    const createData = buildItemForCreate(mutation.payload, {
      entity: mutation.entity,
      entityId: mutation.entityId,
    });
    await assertUniqueActiveItemName(
      tx,
      tenantId,
      createData.item.name,
      mutation.entity,
      mutation.entityId,
    );
    if (createData.item.category) {
      await ensureCategoryExists(tx, tenantId, createData.item.category);
    }
    const item = await txAny.item.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        is_active: true,
        deleted_at: null,
        ...createData.item,
      },
    });
    const variantInputs = createData.variants.filter(
      (variant) =>
        variant.sku !== undefined ||
        variant.name !== undefined ||
        variant.barcode !== undefined ||
        variant.metadata !== undefined ||
        variant.salesPrice !== undefined ||
        variant.purchasePrice !== undefined ||
        (variant.optionValues && Object.keys(variant.optionValues).length > 0),
    );
    const requestedVariants =
      variantInputs.length === 0 ? [createData.defaultVariant] : variantInputs;
    assertUniqueSkusInItemPayload(requestedVariants, mutation.entity, mutation.entityId);
    for (const variant of requestedVariants) {
      await assertUniqueActiveSku(
        tx,
        tenantId,
        variant.sku,
        mutation.entity,
        mutation.entityId,
      );
    }

    const createdVariantIds: string[] = [];
    const additionalChanges: Array<{
      entity: string;
      entityId: string;
      operation: "CREATE" | "UPDATE" | "DELETE" | "PURGE";
      data: Record<string, unknown>;
    }> = [];
    let preferredDefaultId: string | undefined;
    const hasPriceSeeds = variantInputs.some(
      (variant) => variant.salesPrice !== undefined || variant.purchasePrice !== undefined,
    );
    const pricingModules = hasPriceSeeds
      ? await getBusinessModulesFromLicense(tenantId, tx as any)
      : null;
    if (hasPriceSeeds && !pricingModules?.pricing) {
      throw permissionDeniedError(
        "Pricing module is not enabled for this store license",
        mutation.entity,
        mutation.entityId,
      );
    }

    if (variantInputs.length === 0) {
      const defaultVariant = await txAny.itemVariant.create({
        data: {
          business_id: tenantId,
          item_id: item.id,
          deleted_at: null,
          ...createData.defaultVariant,
        },
      });
      createdVariantIds.push(defaultVariant.id);
      preferredDefaultId = defaultVariant.id;
    } else {
      for (const variant of variantInputs) {
        const salesPrice = normalizeOptionalPriceAmount(variant.salesPrice, {
          entity: mutation.entity,
          entityId: mutation.entityId,
          field: "salesPrice",
        });
        const purchasePrice = normalizeOptionalPriceAmount(variant.purchasePrice, {
          entity: mutation.entity,
          entityId: mutation.entityId,
          field: "purchasePrice",
        });
        const createdVariant = await txAny.itemVariant.create({
          data: {
            ...(variant.id ? { id: variant.id } : {}),
            business_id: tenantId,
            item_id: item.id,
            sku: variant.sku ?? null,
            name: variant.name?.trim() || null,
            barcode: variant.barcode?.trim() || null,
            is_default: Boolean(variant.isDefault),
            is_active: variant.isActive ?? true,
            metadata: variant.metadata ?? null,
            deleted_at: null,
          },
        });
        createdVariantIds.push(createdVariant.id);
        if (!preferredDefaultId && variant.isDefault) {
          preferredDefaultId = createdVariant.id;
        }
        await attachOptionValuesToVariant(
          tx,
          item.id,
          createdVariant.id,
          variant.optionValues,
        );
        if (salesPrice !== undefined) {
          const salesSnapshot = await upsertItemPriceInTx(tx, tenantId, createdVariant.id, {
            amount: salesPrice,
            priceType: "SALES",
            actorUserId: mutation.userId,
          });
          additionalChanges.push({
            entity: "item_price",
            entityId: toItemPriceSyncEntityId(createdVariant.id, "SALES"),
            operation: "UPDATE",
            data: salesSnapshot,
          });
        }
        if (purchasePrice !== undefined) {
          const purchaseSnapshot = await upsertItemPriceInTx(tx, tenantId, createdVariant.id, {
            amount: purchasePrice,
            priceType: "PURCHASE",
            actorUserId: mutation.userId,
          });
          additionalChanges.push({
            entity: "item_price",
            entityId: toItemPriceSyncEntityId(createdVariant.id, "PURCHASE"),
            operation: "UPDATE",
            data: purchaseSnapshot,
          });
        }
      }
    }

    preferredDefaultId ??= createdVariantIds[0];
    await ensureSingleDefaultVariant(
      tx,
      item.id,
      preferredDefaultId,
    );

    return {
      snapshot: await getItemSnapshot(tx, tenantId, item.id),
      additionalChanges,
    };
  }

  const current = await txAny.item.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    throw dependencyMissingError("Entity not found in business", "item", mutation.entityId);
  }

  if (mutation.op === "purge") {
    const variants = await txAny.itemVariant.findMany({
      where: {
        business_id: tenantId,
        item_id: mutation.entityId,
      },
      select: {
        id: true,
      },
    });
    const variantIds = variants.map((variant) => String(variant.id));
    const usage = await getItemUsageSummary(tx, tenantId, mutation.entityId, variantIds);
    const usageKinds = [
      ...(usage.lineItemCount > 0 ? ["documents"] : []),
      ...(usage.activityCount > 0 ? ["item_activity"] : []),
      ...(usage.stockLedgerCount > 0 ? ["stock_history"] : []),
    ];
    if (usageKinds.length > 0) {
      throw entityInUseError(
        `Item cannot be purged because it is referenced in ${formatUsageKinds(usageKinds)}. Archive it instead.`,
        mutation.entity,
        mutation.entityId,
        usageKinds,
        {
          lineItemCount: usage.lineItemCount,
          activityCount: usage.activityCount,
          stockLedgerCount: usage.stockLedgerCount,
        },
      );
    }

    const membershipIds =
      variantIds.length === 0
        ? []
        : (
            await txAny.itemCollectionItem.findMany({
              where: {
                business_id: tenantId,
                variant_id: {
                  in: variantIds,
                },
              },
              select: {
                id: true,
              },
            })
          ).map((entry) => String(entry.id));

    await deleteVariantCommercialRows(txAny, variantIds);
    await txAny.discountRuleItem?.deleteMany?.({
      where: {
        item_id: mutation.entityId,
      },
    });
    await txAny.item.delete({
      where: { id: mutation.entityId },
    });

    return {
      snapshot: null,
      additionalChanges: [
        ...variantIds.flatMap((variantId) => [
          {
            entity: "item_price",
            entityId: buildPriceChangeEntityId(variantId, "SALES"),
            operation: "PURGE" as const,
            data: {},
          },
          {
            entity: "item_price",
            entityId: buildPriceChangeEntityId(variantId, "PURCHASE"),
            operation: "PURGE" as const,
            data: {},
          },
          {
            entity: "item_variant",
            entityId: variantId,
            operation: "PURGE" as const,
            data: {},
          },
        ]),
        ...membershipIds.map((membershipId) => ({
          entity: "item_collection_item",
          entityId: membershipId,
          operation: "PURGE" as const,
          data: {},
        })),
      ],
    };
  }

  if (mutation.op === "delete") {
    await txAny.item.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });
    return {
      snapshot: null,
      additionalChanges: [],
    };
  }

  const { itemPatch, category, sku } = buildItemForUpdate(mutation.payload, {
    entity: mutation.entity,
    entityId: mutation.entityId,
  });
  const resolvedNextItemType =
    itemPatch.item_type === "SERVICE" ? "SERVICE" : itemPatch.item_type === "PRODUCT" ? "PRODUCT" : current.item_type;
  if (Object.hasOwn(itemPatch, "hsnSac")) {
    const nextHsnSac = normalizeHsnSac(itemPatch.hsnSac, resolvedNextItemType, {
      entity: mutation.entity,
      entityId: mutation.entityId,
    });
    itemPatch.hsn_sac = nextHsnSac;
    delete itemPatch.hsnSac;
  } else if (itemPatch.item_type && itemPatch.item_type !== current.item_type) {
    normalizeHsnSac(current.hsn_sac, resolvedNextItemType, {
      entity: mutation.entity,
      entityId: mutation.entityId,
    });
  }
  const nextItemName = typeof itemPatch.name === "string" ? itemPatch.name : current.name;
  if (
    typeof nextItemName === "string" &&
    (itemPatch.name !== undefined || current.deleted_at || current.is_active === false)
  ) {
    await assertUniqueActiveItemName(
      tx,
      tenantId,
      nextItemName,
      mutation.entity,
      mutation.entityId,
      current.id,
    );
  }
  const itemPatchWithCategory =
    category !== undefined ? { ...itemPatch, category } : itemPatch;
  if (typeof category === "string" && category.trim()) {
    await ensureCategoryExists(tx, tenantId, category);
  }
  let nextItem = current;

  if (Object.keys(itemPatchWithCategory).length > 0) {
    nextItem = await txAny.item.update({
      where: { id: mutation.entityId },
      data: itemPatchWithCategory,
    });
  }
  nextItem =
    nextItem.deleted_at || nextItem.is_active === false
      ? await txAny.item.update({
          where: { id: mutation.entityId },
          data: {
            is_active: true,
            deleted_at: null,
          },
        })
      : nextItem;

  let defaultVariant = await getDefaultVariant(tx, tenantId, mutation.entityId);

  if (sku !== undefined) {
    const nextSku = normalizeSku(sku);
    await assertUniqueActiveSku(
      tx,
      tenantId,
      nextSku,
      mutation.entity,
      mutation.entityId,
      defaultVariant?.id,
    );
    if (defaultVariant) {
      const currentSku = toNullableTrimmedValue(defaultVariant.sku);
      if (nextSku !== currentSku) {
        const usageCount = await getVariantUsageCount(tx, tenantId, defaultVariant.id);
        if (usageCount > 0) {
          throw validationError(
            "Default variant SKU is locked after usage. Create a new variant for SKU changes.",
            mutation.entity,
            mutation.entityId,
          );
        }
      }
      defaultVariant = await txAny.itemVariant.update({
        where: { id: defaultVariant.id },
        data: { sku, is_active: true, deleted_at: null },
      });
    } else {
      defaultVariant = await txAny.itemVariant.create({
        data: {
          business_id: tenantId,
          item_id: mutation.entityId,
          sku,
          is_default: true,
          is_active: true,
          deleted_at: null,
        },
      });
    }
  }

  if (!defaultVariant) {
    defaultVariant = await txAny.itemVariant.create({
      data: {
        business_id: tenantId,
        item_id: mutation.entityId,
        sku: null,
        is_default: true,
        is_active: true,
        deleted_at: null,
      },
    });
  }

  const snapshot = await getItemSnapshot(tx, tenantId, nextItem.id);
  return {
    snapshot,
    additionalChanges: [],
  };
};

const applyItemVariantMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = sanitizeVariantPayload(mutation.payload);
  const metadata = normalizeMetadataValue(payload.metadata, {
    entity: mutation.entity,
    entityId: mutation.entityId,
    maxBytes: VARIANT_METADATA_MAX_BYTES,
  });

  if (mutation.op === "create") {
    if (!payload.itemId) {
      throw validationError("itemId is required for variant create", mutation.entity, mutation.entityId);
    }

    const parentItem = await txAny.item.findUnique({
      where: { id: payload.itemId },
    });
    if (!parentItem || parentItem.business_id !== tenantId || parentItem.deleted_at) {
      throw dependencyMissingError("Item not found in business", "item", payload.itemId);
    }

    await assertUniqueActiveSku(
      tx,
      tenantId,
      payload.sku,
      mutation.entity,
      mutation.entityId,
    );

    const variant = await txAny.itemVariant.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        item_id: payload.itemId,
        sku: payload.sku ?? null,
        barcode: payload.barcode?.trim() || null,
        name: payload.name?.trim() || null,
        is_default: Boolean(payload.isDefault),
        is_active: payload.isActive ?? true,
        metadata: metadata ?? null,
        deleted_at: null,
      },
    });

    await attachOptionValuesToVariant(tx, payload.itemId, variant.id, payload.optionValues);

    await ensureSingleDefaultVariant(
      tx,
      payload.itemId,
      payload.isDefault ? variant.id : undefined,
    );

    const optionValues = await getVariantOptionValues(tx, variant.id);
    const usageCount = await getVariantUsageCount(tx, tenantId, variant.id);
    return {
      snapshot: toVariantSnapshot(variant, optionValues, usageCount),
      additionalChanges: [],
    };
  }

  const current = await txAny.itemVariant.findUnique({
    where: { id: mutation.entityId },
  });

  if (mutation.op === "purge") {
    if (!current) {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    if (current.business_id !== tenantId) {
      throw dependencyMissingError("Variant not found in business", "item_variant", mutation.entityId);
    }
    const siblingCount = await txAny.itemVariant.count({
      where: {
        business_id: tenantId,
        item_id: current.item_id,
        deleted_at: null,
      },
    });
    if (siblingCount <= 1) {
      throw validationError(
        "The only remaining variant cannot be purged by itself. Purge the item instead.",
        mutation.entity,
        mutation.entityId,
      );
    }

    const usage = await getVariantUsageSummary(tx, tenantId, mutation.entityId);
    const usageKinds = [
      ...(usage.stockLedgerCount > 0 ? ["stock_history"] : []),
      ...(usage.activityCount > 0 ? ["item_activity"] : []),
    ];
    if (usageKinds.length > 0) {
      throw entityInUseError(
        `Variant cannot be purged because it is referenced in ${formatUsageKinds(usageKinds)}. Archive it instead.`,
        mutation.entity,
        mutation.entityId,
        usageKinds,
        usage,
      );
    }

    const membershipIds = (
      await txAny.itemCollectionItem.findMany({
        where: {
          business_id: tenantId,
          variant_id: mutation.entityId,
        },
        select: {
          id: true,
        },
      })
    ).map((entry) => String(entry.id));

    await deleteVariantCommercialRows(txAny, [mutation.entityId]);
    await txAny.itemVariant.delete({
      where: { id: mutation.entityId },
    });
    await ensureSingleDefaultVariant(tx, current.item_id);

    return {
      snapshot: null,
      additionalChanges: [
        {
          entity: "item_price",
          entityId: buildPriceChangeEntityId(mutation.entityId, "SALES"),
          operation: "PURGE" as const,
          data: {},
        },
        {
          entity: "item_price",
          entityId: buildPriceChangeEntityId(mutation.entityId, "PURCHASE"),
          operation: "PURGE" as const,
          data: {},
        },
        ...membershipIds.map((membershipId) => ({
          entity: "item_collection_item",
          entityId: membershipId,
          operation: "PURGE" as const,
          data: {},
        })),
      ],
    };
  }

  if (mutation.op === "delete") {
    if (!current) {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    if (current.business_id !== tenantId) {
      throw dependencyMissingError("Variant not found in business", "item_variant", mutation.entityId);
    }
    const usageCount = await getVariantUsageCount(tx, tenantId, mutation.entityId);
    if (usageCount > 0) {
      throw validationError(
        "Variant cannot be deleted because it has been used in transactions. Archive it instead.",
        mutation.entity,
        mutation.entityId,
      );
    }
    await txAny.itemVariant.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });
    await ensureSingleDefaultVariant(tx, current.item_id);
    return {
      snapshot: null,
      additionalChanges: [],
    };
  }

  if (!current || current.business_id !== tenantId) {
    throw dependencyMissingError("Variant not found in business", mutation.entity, mutation.entityId);
  }

  const patch: Record<string, unknown> = {};
  if (payload.sku !== undefined) patch.sku = payload.sku;
  if (payload.name !== undefined) patch.name = payload.name?.trim() || null;
  if (payload.barcode !== undefined) patch.barcode = payload.barcode?.trim() || null;
  if (payload.isActive !== undefined) patch.is_active = payload.isActive;
  if (payload.isDefault !== undefined) patch.is_default = payload.isDefault;
  if (metadata !== undefined) patch.metadata = metadata;

  const [currentOptionValues, usageCount] = await Promise.all([
    getVariantOptionValues(tx, mutation.entityId),
    getVariantUsageCount(tx, tenantId, mutation.entityId),
  ]);
  if (usageCount > 0 && variantImmutableFieldsChanged(current, currentOptionValues, payload)) {
    throw validationError(
      "Variant identity fields are locked after usage. Create a new variant for these changes.",
      mutation.entity,
      mutation.entityId,
    );
  }

  const nextVariantSku = payload.sku !== undefined ? payload.sku : current.sku;
  if (payload.sku !== undefined || current.deleted_at || current.is_active === false) {
    await assertUniqueActiveSku(
      tx,
      tenantId,
      nextVariantSku,
      mutation.entity,
      mutation.entityId,
      current.id,
    );
  }

  let variant =
    Object.keys(patch).length > 0
      ? await txAny.itemVariant.update({
          where: { id: mutation.entityId },
          data: patch,
        })
      : current;

  if (variant.deleted_at || variant.is_active === false) {
    variant = await txAny.itemVariant.update({
      where: { id: mutation.entityId },
      data: {
        is_active: payload.isActive ?? true,
        deleted_at: null,
      },
    });
  }

  if (payload.optionValues) {
    await tx.itemVariantOptionValue.deleteMany({
      where: { variant_id: mutation.entityId },
    });
    await attachOptionValuesToVariant(
      tx,
      variant.item_id,
      mutation.entityId,
      payload.optionValues,
    );
  }

  if (payload.isDefault) {
    await ensureSingleDefaultVariant(tx, variant.item_id, variant.id);
  } else {
    await ensureSingleDefaultVariant(tx, variant.item_id);
  }

  const optionValues = await getVariantOptionValues(tx, variant.id);
  const nextUsageCount = await getVariantUsageCount(tx, tenantId, variant.id);
  return {
    snapshot: toVariantSnapshot(variant, optionValues, nextUsageCount),
    additionalChanges: [],
  };
};

const applyItemCategoryMutation = async (tx, tenantId, mutation) => {
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const payloadName = typeof payload.name === "string" ? payload.name.trim() : "";

  if (mutation.op === "create") {
    if (!payloadName) {
      throw validationError("Category name is required", mutation.entity, mutation.entityId);
    }

    const existing = await tx.itemCategory.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        deleted_at: null,
      },
    });
    if (existing) {
      throw validationError("Category already exists", mutation.entity, mutation.entityId);
    }

    const created = await tx.itemCategory.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name: payloadName,
        is_active: true,
        deleted_at: null,
      },
    });
    return {
      snapshot: toItemCategorySnapshot(created),
      additionalChanges: [],
    };
  }

  const current = await tx.itemCategory.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete" || mutation.op === "purge") {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    throw dependencyMissingError("Category not found in business", mutation.entity, mutation.entityId);
  }

  if (mutation.op === "purge") {
    const referencingItemCount = await tx.item.count({
      where: {
        business_id: tenantId,
        category: current.name,
      },
    });
    if (referencingItemCount > 0) {
      throw entityInUseError(
        "Category cannot be purged because items still reference it. Remove those references or archive the category instead.",
        mutation.entity,
        mutation.entityId,
        ["item_reference"],
        { referencingItemCount },
      );
    }

    await (tx as any).itemCategory.delete({
      where: { id: mutation.entityId },
    });

    return {
      snapshot: null,
      additionalChanges: [],
    };
  }

  if (mutation.op === "delete") {
    const itemsWithCategory = await tx.item.findMany({
      where: {
        business_id: tenantId,
        category: current.name,
        deleted_at: null,
      },
      select: { id: true },
    });

    await tx.item.updateMany({
      where: {
        business_id: tenantId,
        category: current.name,
        deleted_at: null,
      },
      data: {
        category: null,
      },
    });

    await (tx as any).itemCategory.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });

    const additionalChanges = await Promise.all(
      itemsWithCategory.map(async (item) => ({
        entity: "item",
        entityId: item.id,
        operation: "UPDATE",
        data: await getItemSnapshot(tx, tenantId, item.id),
      })),
    );

    return {
      snapshot: null,
      additionalChanges,
    };
  }

  if (mutation.op === "update") {
    if (!payloadName) {
      throw validationError("Category name is required", mutation.entity, mutation.entityId);
    }

    const existing = await tx.itemCategory.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        deleted_at: null,
        id: {
          not: current.id,
        },
      },
    });
    if (existing) {
      throw validationError("Category already exists", mutation.entity, mutation.entityId);
    }

    const needsRename = payloadName !== current.name;
    const itemsWithCategory = needsRename
      ? await tx.item.findMany({
          where: {
            business_id: tenantId,
            category: current.name,
            deleted_at: null,
          },
          select: { id: true },
        })
      : [];

    if (needsRename) {
      await tx.item.updateMany({
        where: {
          business_id: tenantId,
          category: current.name,
          deleted_at: null,
        },
        data: {
          category: payloadName,
        },
      });
    }

    const updated = await tx.itemCategory.update({
      where: { id: mutation.entityId },
      data: {
        name: payloadName,
        is_active: true,
        deleted_at: null,
      },
    });

    const additionalChanges = needsRename
      ? await Promise.all(
          itemsWithCategory.map(async (item) => ({
            entity: "item",
            entityId: item.id,
            operation: "UPDATE",
            data: await getItemSnapshot(tx, tenantId, item.id),
          })),
        )
      : [];

    return {
      snapshot: toItemCategorySnapshot(updated),
      additionalChanges,
    };
  }

  throw validationError("Unsupported operation for item category", mutation.entity, mutation.entityId);
};

const applyItemCollectionMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const payloadName = typeof payload.name === "string" ? payload.name.trim() : "";

  if (mutation.op === "create") {
    if (!payloadName) {
      throw validationError("Collection name is required", mutation.entity, mutation.entityId);
    }

    const existing = await txAny.itemCollection.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        deleted_at: null,
      },
    });
    if (existing) {
      throw validationError("Collection already exists", mutation.entity, mutation.entityId);
    }

    const created = await txAny.itemCollection.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        name: payloadName,
        is_active: true,
        deleted_at: null,
      },
    });
    return {
      snapshot: toItemCollectionSnapshot(created),
      additionalChanges: [],
    };
  }

  const current = await txAny.itemCollection.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.business_id !== tenantId) {
    if (mutation.op === "delete" || mutation.op === "purge") {
      return {
        snapshot: null,
        additionalChanges: [],
      };
    }
    throw dependencyMissingError("Collection not found in business", mutation.entity, mutation.entityId);
  }

  if (mutation.op === "purge") {
    const memberships = await txAny.itemCollectionItem.findMany({
      where: {
        business_id: tenantId,
        collection_id: current.id,
      },
      select: { id: true },
    });

    await txAny.itemCollection.delete({
      where: { id: mutation.entityId },
    });

    return {
      snapshot: null,
      additionalChanges: memberships.map((membership) => ({
        entity: "item_collection_item",
        entityId: membership.id,
        operation: "PURGE" as const,
        data: {},
      })),
    };
  }

  if (mutation.op === "delete") {
    const memberships = await txAny.itemCollectionItem.findMany({
      where: {
        business_id: tenantId,
        collection_id: current.id,
        deleted_at: null,
      },
      select: { id: true },
    });

    await txAny.itemCollectionItem.updateMany({
      where: {
        business_id: tenantId,
        collection_id: current.id,
        deleted_at: null,
      },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });

    await txAny.itemCollection.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });

    const additionalChanges = memberships.map((membership) => ({
      entity: "item_collection_item",
      entityId: membership.id,
      operation: "DELETE" as const,
      data: {},
    }));

    return {
      snapshot: null,
      additionalChanges,
    };
  }

  if (mutation.op === "update") {
    if (!payloadName) {
      throw validationError("Collection name is required", mutation.entity, mutation.entityId);
    }

    const existing = await txAny.itemCollection.findFirst({
      where: {
        business_id: tenantId,
        name: payloadName,
        deleted_at: null,
        id: { not: current.id },
      },
    });
    if (existing) {
      throw validationError("Collection already exists", mutation.entity, mutation.entityId);
    }

    const updated = await txAny.itemCollection.update({
      where: { id: mutation.entityId },
      data: {
        name: payloadName,
        is_active: true,
        deleted_at: null,
      },
    });

    return {
      snapshot: toItemCollectionSnapshot(updated),
      additionalChanges: [],
    };
  }

  throw validationError("Unsupported operation for item collection", mutation.entity, mutation.entityId);
};

const applyItemCollectionItemMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const collectionId =
    typeof payload.collectionId === "string" ? payload.collectionId : "";
  const variantId =
    typeof payload.variantId === "string" ? payload.variantId : "";

  if (mutation.op === "create") {
    if (!collectionId || !variantId) {
      throw validationError("collectionId and variantId are required", mutation.entity, mutation.entityId);
    }

    const [collection, variant] = await Promise.all([
      txAny.itemCollection.findUnique({ where: { id: collectionId } }),
      txAny.itemVariant.findUnique({ where: { id: variantId } }),
    ]);
    if (!collection || collection.business_id !== tenantId || collection.deleted_at) {
      throw dependencyMissingError("Collection not found in business", "item_collection", collectionId);
    }
    if (!variant || variant.business_id !== tenantId || variant.deleted_at) {
      throw dependencyMissingError("Variant not found in business", "item_variant", variantId);
    }

    const existing = await txAny.itemCollectionItem.findFirst({
      where: {
        business_id: tenantId,
        collection_id: collectionId,
        variant_id: variantId,
        deleted_at: null,
      },
    });
    if (existing) {
      throw validationError("Variant is already in this collection", mutation.entity, mutation.entityId);
    }

    const created = await txAny.itemCollectionItem.create({
      data: {
        id: mutation.entityId,
        business_id: tenantId,
        collection_id: collectionId,
        variant_id: variantId,
        is_active: true,
        deleted_at: null,
      },
    });
    return toItemCollectionItemSnapshot(created);
  }

  if (mutation.op === "delete") {
    const current = await txAny.itemCollectionItem.findUnique({
      where: { id: mutation.entityId },
    });
    if (!current) return null;
    if (current.business_id !== tenantId) {
      throw dependencyMissingError(
        "Collection item link not found in business",
        mutation.entity,
        mutation.entityId,
      );
    }
    await txAny.itemCollectionItem.update({
      where: { id: mutation.entityId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });
    return null;
  }

  if (mutation.op === "purge") {
    const current = await txAny.itemCollectionItem.findUnique({
      where: { id: mutation.entityId },
    });
    if (!current) return null;
    if (current.business_id !== tenantId) {
      throw dependencyMissingError(
        "Collection item link not found in business",
        mutation.entity,
        mutation.entityId,
      );
    }
    await txAny.itemCollectionItem.delete({
      where: { id: mutation.entityId },
    });
    return null;
  }

  throw validationError("Unsupported operation for item collection item", mutation.entity, mutation.entityId);
};

const applyItemPriceMutation = async (tx, tenantId, mutation) => {
  const modules = await getBusinessModulesFromLicense(tenantId, tx);
  if (!modules.pricing) {
    throw permissionDeniedError(
      "Pricing module is not enabled for this store license",
      mutation.entity,
      mutation.entityId,
    );
  }

  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const variantId =
    typeof payload.variantId === "string" && payload.variantId
      ? payload.variantId
      : mutation.entityId;
  const rawAmount = (payload as Record<string, unknown>).amount;
  const amount =
    rawAmount === null
      ? null
      : typeof rawAmount === "number" && Number.isFinite(rawAmount) && rawAmount >= 0
        ? rawAmount
        : typeof rawAmount === "string" && rawAmount.trim()
          ? Number(rawAmount)
          : undefined;
  const currency = typeof payload.currency === "string" ? payload.currency : undefined;
  const priceType = normalizePriceType((payload as Record<string, unknown>).priceType, {
    entity: mutation.entity,
    entityId: mutation.entityId,
  });
  const taxMode = normalizePriceTaxMode((payload as Record<string, unknown>).taxMode, {
    entity: mutation.entity,
    entityId: mutation.entityId,
  });
  const gstSlab = normalizeGstSlab((payload as Record<string, unknown>).gstSlab, {
    entity: mutation.entity,
    entityId: mutation.entityId,
  });

  if (!variantId) {
    throw validationError("variantId is required for item price mutation", mutation.entity, mutation.entityId);
  }

  if (mutation.op === "delete") {
    return upsertItemPriceInTx(tx, tenantId, variantId, {
      amount: null,
      currency,
      priceType,
      taxMode,
      gstSlab,
      actorUserId: mutation.userId,
    });
  }

  if (
    amount === undefined ||
    (amount !== null && (!Number.isFinite(amount) || amount < 0))
  ) {
    throw validationError(
      "Price amount must be a non-negative number or null",
      mutation.entity,
      mutation.entityId,
    );
  }

  return upsertItemPriceInTx(tx, tenantId, variantId, {
    amount,
    currency,
    priceType,
    taxMode,
    gstSlab,
    actorUserId: mutation.userId,
  });
};

const applyStockAdjustmentMutation = async (tx, tenantId, mutation) => {
  const txAny = tx as any;
  if (mutation.op !== "create") {
    throw validationError(
      "Unsupported operation for stock adjustment",
      mutation.entity,
      mutation.entityId,
    );
  }

  const payload =
    mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const variantId =
    typeof payload.variantId === "string" && payload.variantId.trim()
      ? payload.variantId
      : "";
  const rawQuantity = (payload as Record<string, unknown>).quantity;
  const quantity =
    typeof rawQuantity === "number" && Number.isFinite(rawQuantity)
      ? rawQuantity
      : typeof rawQuantity === "string" && rawQuantity.trim()
        ? Number(rawQuantity)
        : undefined;
  const requestedReason =
    typeof payload.reason === "string" && payload.reason.trim()
      ? payload.reason.trim().toUpperCase()
      : "OPENING_BALANCE";

  if (!variantId) {
    throw validationError("variantId is required for stock adjustment", mutation.entity, mutation.entityId);
  }

  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) {
    throw validationError(
      "Stock quantity must be a positive number",
      mutation.entity,
      mutation.entityId,
    );
  }

  if (!STOCK_ADJUSTMENT_REASONS.has(requestedReason)) {
    throw validationError(
      "Stock adjustment reason is invalid",
      mutation.entity,
      mutation.entityId,
    );
  }

  const variant = await txAny.itemVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      business_id: true,
      deleted_at: true,
      item: {
        select: {
          deleted_at: true,
        },
      },
    },
  });

  if (
    !variant ||
    variant.business_id !== tenantId ||
    variant.deleted_at ||
    variant.item?.deleted_at
  ) {
    throw dependencyMissingError("Variant not found in business", "item_variant", variantId);
  }

  const existingStockLevel = await getStockLevelSnapshot(tx, tenantId, variantId);
  const ledgerQuantity =
    requestedReason === "ADJUSTMENT_DECREASE" ? -quantity : quantity;

  if (requestedReason === "ADJUSTMENT_DECREASE" && existingStockLevel.quantityOnHand < quantity) {
    throw validationError(
      "Stock adjustment would make on-hand quantity negative",
      mutation.entity,
      mutation.entityId,
      {
        currentQuantityOnHand: existingStockLevel.quantityOnHand,
        requestedDecrease: quantity,
      },
    );
  }

  const createdEntry = await txAny.stockLedger.create({
    data: {
      id: mutation.entityId,
      business_id: tenantId,
      variant_id: variantId,
      quantity: ledgerQuantity,
      reason: requestedReason,
      reference_id: mutation.mutationId,
      is_active: true,
      deleted_at: null,
    },
  });

  const prunedEntries = await txAny.stockLedger.findMany({
    where: {
      business_id: tenantId,
      variant_id: variantId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
    orderBy: [
      { created_at: "desc" },
      { id: "desc" },
    ],
    skip: RECENT_STOCK_ADJUSTMENT_LIMIT_PER_VARIANT,
  });

  if (prunedEntries.length > 0) {
    const prunedAt = new Date();
    await txAny.stockLedger.updateMany({
      where: {
        id: {
          in: prunedEntries.map((entry) => entry.id),
        },
      },
      data: {
        is_active: false,
        deleted_at: prunedAt,
      },
    });
  }

  const stockLevel = await getStockLevelSnapshot(tx, tenantId, variantId);

  return {
    snapshot: toStockAdjustmentSnapshot(
      createdEntry,
      String(stockLevel.id),
      Number(stockLevel.quantityOnHand),
    ),
    additionalChanges: [
      ...prunedEntries.map((entry) => ({
        entity: "stock_adjustment",
        entityId: entry.id,
        operation: "DELETE" as const,
        data: {},
      })),
      {
        entity: "stock_level",
        entityId: String(stockLevel.id),
        operation: "UPDATE" as const,
        data: stockLevel,
      },
    ],
  };
};

const applyMutation = async (
  tenantId,
  mutation,
): Promise<{ status: "applied"; outcome?: AppliedOutcome }> => {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const existing = await txAny.syncMutationLog.findUnique({
      where: { mutation_id: mutation.mutationId },
      select: {
        mutation_id: true,
        tenant_id: true,
        user_id: true,
        entity: true,
        entity_id: true,
        operation: true,
        result_status: true,
        result_summary: true,
        result_payload: true,
        processed_at: true,
      },
    });

    if (existing) {
      const existingResult = mapMutationLogToSyncResultRecord(existing);
      if (existingResult?.resultStatus === "rejected") {
        throw new SyncRejectionError({
          message: existingResult.summary,
          statusCode: 400,
          reasonCode: existingResult.rejection?.reasonCode ?? "VALIDATION_FAILED",
          entity: existing.entity,
          entityId: existing.entity_id,
          details: existingResult.rejection?.details,
        });
      }
      return {
        status: "applied",
        ...(existingResult?.resultStatus === "applied" && existingResult.outcome
          ? { outcome: existingResult.outcome }
          : {}),
      };
    }

    await assertEntityBaseVersion(
      txAny,
      tenantId,
      mutation.entity,
      mutation.entityId,
      mutation.baseVersion,
    );

    let snapshot = null;
    let additionalChanges: Array<{
      entity: string;
      entityId: string;
      operation: "CREATE" | "UPDATE" | "DELETE" | "PURGE";
      data: Record<string, unknown>;
    }> = [];
    if (mutation.entity === "customer") {
      snapshot = await applyCustomerMutation(tx, tenantId, mutation);
      if (mutation.op === "delete" && snapshot?.type === "SUPPLIER") {
        additionalChanges.push({
          entity: "supplier",
          entityId: mutation.entityId,
          operation: "UPDATE" as const,
          data: snapshot,
        });
      } else if (snapshot?.type === "BOTH") {
        additionalChanges.push({
          entity: "supplier",
          entityId: mutation.entityId,
          operation: "UPDATE" as const,
          data: snapshot,
        });
      }
    } else if (mutation.entity === "supplier") {
      snapshot = await applySupplierMutation(tx, tenantId, mutation);
      if (mutation.op === "delete" && snapshot?.type === "CUSTOMER") {
        additionalChanges.push({
          entity: "customer",
          entityId: mutation.entityId,
          operation: "UPDATE" as const,
          data: snapshot,
        });
      } else if (snapshot?.type === "BOTH") {
        additionalChanges.push({
          entity: "customer",
          entityId: mutation.entityId,
          operation: "UPDATE" as const,
          data: snapshot,
        });
      }
    } else if (mutation.entity === "item") {
      const itemResult = await applyItemMutation(tx, tenantId, mutation);
      snapshot = itemResult.snapshot;
      additionalChanges = itemResult.additionalChanges;
    } else if (mutation.entity === "item_variant") {
      const variantResult = await applyItemVariantMutation(tx, tenantId, mutation);
      snapshot = variantResult.snapshot;
      additionalChanges = variantResult.additionalChanges;
    } else if (mutation.entity === "item_category") {
      const categoryResult = await applyItemCategoryMutation(tx, tenantId, mutation);
      snapshot = categoryResult.snapshot;
      additionalChanges = categoryResult.additionalChanges;
    } else if (mutation.entity === "item_collection") {
      const collectionResult = await applyItemCollectionMutation(tx, tenantId, mutation);
      snapshot = collectionResult.snapshot;
      additionalChanges = collectionResult.additionalChanges;
    } else if (mutation.entity === "item_collection_item") {
      snapshot = await applyItemCollectionItemMutation(tx, tenantId, mutation);
    } else if (mutation.entity === "item_price") {
      snapshot = await applyItemPriceMutation(tx, tenantId, mutation);
    } else if (mutation.entity === "stock_adjustment") {
      const stockAdjustmentResult = await applyStockAdjustmentMutation(tx, tenantId, mutation);
      snapshot = stockAdjustmentResult.snapshot;
      additionalChanges = stockAdjustmentResult.additionalChanges;
    } else {
      throw validationError(`Unsupported entity '${mutation.entity}'`, mutation.entity, mutation.entityId);
    }

    const operation = toPrismaSyncOperation(mutation.op);
    const processedAt = new Date();
    const outcome = buildAppliedOutcome(mutation, additionalChanges);

    await txAny.syncMutationLog.create({
      data: {
        mutation_id: mutation.mutationId,
        tenant_id: tenantId,
        device_id: mutation.deviceId,
        user_id: mutation.userId,
        entity: mutation.entity,
        entity_id: mutation.entityId,
        operation,
        payload: mutation.payload,
        base_version: mutation.baseVersion,
        client_timestamp: new Date(mutation.clientTimestamp),
        result_status: "APPLIED",
        result_summary: outcome.summary,
        result_payload: outcome,
        processed_at: processedAt,
      },
    });

    await appendSyncChange(
      txAny,
      tenantId,
      mutation.entity,
      mutation.entityId,
      operation,
      snapshot ?? {},
    );

    for (const change of additionalChanges) {
      await appendSyncChange(
        txAny,
        tenantId,
        change.entity,
        change.entityId,
        change.operation,
        change.data,
      );
    }

    return { status: "applied" as const, outcome };
  });
};

const processMutations = async (
  tenantId,
  userId,
  mutations,
  options: {
    canManageCustomers?: boolean;
    canManageSuppliers?: boolean;
    canManageProducts?: boolean;
    canManageServices?: boolean;
  } = {},
) => {
  const acknowledgements: MutationAcknowledgement[] = [];

  for (const mutation of mutations) {
    if (!SUPPORTED_ENTITIES.has(mutation.entity)) {
      const rejection = toSyncRejection(
        mutation,
        new SyncRejectionError({
          message: `Unsupported entity '${mutation.entity}'`,
          statusCode: 400,
          reasonCode: "VALIDATION_FAILED",
          entity: mutation.entity,
          entityId: mutation.entityId,
        }),
      );
      acknowledgements.push(rejection);
      await persistRejectedMutationResult(tenantId, mutation, rejection);
      continue;
    }

    if (mutation.entity === "customer" && !options.canManageCustomers) {
      const rejection = toSyncRejection(
        mutation,
        new SyncRejectionError({
          message: "Customer management is not enabled for this store license",
          statusCode: 403,
          reasonCode: "PERMISSION_DENIED",
          entity: mutation.entity,
          entityId: mutation.entityId,
        }),
      );
      acknowledgements.push(rejection);
      await persistRejectedMutationResult(tenantId, mutation, rejection);
      continue;
    }

    if (mutation.entity === "supplier" && !options.canManageSuppliers) {
      const rejection = toSyncRejection(
        mutation,
        new SyncRejectionError({
          message: "Supplier management is not enabled for this store license",
          statusCode: 403,
          reasonCode: "PERMISSION_DENIED",
          entity: mutation.entity,
          entityId: mutation.entityId,
        }),
      );
      acknowledgements.push(rejection);
      await persistRejectedMutationResult(tenantId, mutation, rejection);
      continue;
    }

    if (
      mutation.entity === "item" ||
      mutation.entity === "item_variant" ||
      mutation.entity === "item_category" ||
      mutation.entity === "item_collection" ||
      mutation.entity === "item_collection_item" ||
      mutation.entity === "item_price"
    ) {
      try {
        await assertItemMutationCapability(tenantId, mutation, options);
      } catch (error) {
        const rejection = toSyncRejection(mutation, error);
        acknowledgements.push(rejection);
        await persistRejectedMutationResult(tenantId, mutation, rejection);
        continue;
      }
    }

    if (mutation.userId !== userId) {
      const rejection = toSyncRejection(
        mutation,
        new SyncRejectionError({
          message: "Mutation user does not match authenticated user",
          statusCode: 403,
          reasonCode: "PERMISSION_DENIED",
          entity: mutation.entity,
          entityId: mutation.entityId,
        }),
      );
      acknowledgements.push(rejection);
      await persistRejectedMutationResult(tenantId, mutation, rejection);
      continue;
    }

    try {
      const result = await applyMutation(tenantId, mutation);
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: result.status,
        ...(result.outcome ? { outcome: result.outcome } : {}),
      });
    } catch (error) {
      const rejection = toSyncRejection(mutation, error);
      acknowledgements.push(rejection);
      await persistRejectedMutationResult(tenantId, mutation, rejection);
    }
  }

  return {
    cursor: await getTenantCursor(tenantId),
    acknowledgements,
  };
};

const getSyncResults = async (
  tenantId: string,
  options: { page?: number; limit?: number } = {},
) => {
  const page = Number.isFinite(options.page) && (options.page ?? 0) > 0 ? Number(options.page) : 1;
  const limit =
    Number.isFinite(options.limit) && (options.limit ?? 0) > 0
      ? Math.min(Number(options.limit), 100)
      : 25;
  const skip = (page - 1) * limit;

  const [total, rows] = await prisma.$transaction([
    prismaAny.syncMutationLog.count({
      where: {
        tenant_id: tenantId,
        processed_at: { not: null },
      },
    }),
    prismaAny.syncMutationLog.findMany({
      where: {
        tenant_id: tenantId,
        processed_at: { not: null },
      },
      orderBy: [
        { processed_at: "desc" },
        { server_timestamp: "desc" },
      ],
      skip,
      take: limit,
    }),
  ]);

  return {
    page,
    limit,
    total,
    results: rows
      .map((entry) => mapMutationLogToSyncResultRecord(entry))
      .filter((entry): entry is SyncResultRecord => entry !== null),
  };
};

const getDeltasSinceCursor = async (tenantId, cursor, limit) => {
  const parsedCursor = BigInt(cursor);

  const changes = await prismaAny.syncChangeLog.findMany({
    where: {
      tenant_id: tenantId,
      cursor: { gt: parsedCursor },
    },
    orderBy: { cursor: "asc" },
    take: limit,
  });

  const deltas = changes.map((change) => ({
    cursor: change.cursor.toString(),
    entity: change.entity,
    entityId: change.entity_id,
    op: toSyncOperation(change.operation),
    data: normalizeSyncEntityState(
      change.entity,
      toSyncOperation(change.operation),
      change.data,
      change.server_timestamp.toISOString(),
    ),
    serverVersion: change.server_version,
    serverTimestamp: change.server_timestamp.toISOString(),
  }));

  return {
    nextCursor:
      changes.length > 0
        ? changes[changes.length - 1].cursor.toString()
        : cursor,
    deltas,
  };
};

const getOptionKeys = async (tenantId: string) => {
  const optionRows = await prisma.itemOption.findMany({
    where: {
      item: {
        business_id: tenantId,
      },
    },
    select: {
      name: true,
      values: {
        select: {
          value: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const valueSetsByKey = new Map<string, Set<string>>();
  for (const row of optionRows) {
    const key = row.name.trim();
    if (!key) continue;

    const values = valueSetsByKey.get(key) ?? new Set<string>();
    for (const optionValue of row.values) {
      const value = optionValue.value.trim();
      if (value) {
        values.add(value);
      }
    }
    valueSetsByKey.set(key, values);
  }

  const optionKeys = Array.from(valueSetsByKey.keys()).sort((a, b) => a.localeCompare(b));
  const optionValuesByKey = Object.fromEntries(
    optionKeys.map((key) => {
      const values = Array.from(valueSetsByKey.get(key) ?? []).sort((a, b) =>
        a.localeCompare(b),
      );
      return [key, values];
    }),
  );

  return {
    optionKeys,
    optionValuesByKey,
  };
};

const getItemCategories = async (tenantId: string, query?: string, limit = 30) => {
  const normalizedQuery = query?.trim();
  const rows = await prismaAny.itemCategory.findMany({
    where: {
      business_id: tenantId,
      deleted_at: null,
      name: normalizedQuery
        ? {
            contains: normalizedQuery,
            mode: "insensitive",
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
    take: limit,
  });

  return rows
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.name.length > 0);
};

const ensureDefaultPriceBook = async (
  txAny: any,
  tenantId: string,
  preferredCurrency?: string,
) => {
  const currency = (preferredCurrency?.trim().toUpperCase() || DEFAULT_PRICE_CURRENCY).slice(
    0,
    3,
  );
  const existingDefault = await txAny.priceBook.findFirst({
    where: {
      business_id: tenantId,
      is_default: true,
    },
    orderBy: {
      created_at: "asc",
    },
  });
  if (existingDefault) {
    return existingDefault;
  }

  const standardBook = await txAny.priceBook.findUnique({
    where: {
      business_id_code: {
        business_id: tenantId,
        code: DEFAULT_PRICE_BOOK_CODE,
      },
    },
  });
  if (standardBook) {
    return txAny.priceBook.update({
      where: { id: standardBook.id },
      data: { is_default: true },
    });
  }

  return txAny.priceBook.create({
    data: {
      business_id: tenantId,
      code: DEFAULT_PRICE_BOOK_CODE,
      name: DEFAULT_PRICE_BOOK_NAME,
      default_currency: currency,
      is_default: true,
      is_active: true,
      priority: 0,
    },
  });
};

const upsertItemPriceInTx = async (
  tx: any,
  tenantId: string,
  variantId: string,
  input: {
    amount: number | null;
    currency?: string;
    priceType?: PriceTypeValue;
    taxMode?: PriceTaxModeValue;
    gstSlab?: string | null;
    actorUserId?: string;
  },
) => {
  const txAny = tx as any;
  const variant = await txAny.itemVariant.findUnique({
    where: { id: variantId },
    include: {
      item: {
        select: {
          name: true,
          category: true,
          deleted_at: true,
        },
      },
    },
  });
  if (!variant || variant.business_id !== tenantId || (variant as any).deleted_at || (variant.item as any)?.deleted_at) {
    throw dependencyMissingError("Variant not found in business", "item_variant", variantId);
  }

  const defaultPriceBook = await ensureDefaultPriceBook(txAny, tenantId, input.currency);
  const normalizedCurrency = (
    input.currency?.trim().toUpperCase() ||
    defaultPriceBook.default_currency ||
    DEFAULT_PRICE_CURRENCY
  ).slice(0, 3);
  const normalizedPriceType = input.priceType ?? "SALES";
  const normalizedTaxMode = input.taxMode ?? "EXCLUSIVE";
  const normalizedGstSlab = input.gstSlab ?? null;
  const now = new Date();
  const eventScopeWhere = {
    business_id: tenantId,
    price_book_id: defaultPriceBook.id,
    variant_id: variantId,
    price_type: normalizedPriceType,
    customer_group_id: null,
    min_qty: 1,
    max_qty: null,
    ended_at: null,
  };
  await txAny.itemPriceEvent.updateMany({
    where: eventScopeWhere,
    data: {
      ended_at: now,
    },
  });

  if (input.amount === null) {
    await txAny.itemPriceEvent.create({
      data: {
        business_id: tenantId,
        price_book_id: defaultPriceBook.id,
        variant_id: variantId,
        customer_group_id: null,
        min_qty: 1,
        max_qty: null,
        amount: null,
        currency: normalizedCurrency,
        price_type: normalizedPriceType,
        tax_mode: normalizedTaxMode,
        gst_slab: normalizedGstSlab,
        event_type: "CLEARED",
        effective_at: now,
        created_by: input.actorUserId,
      },
    });
    await txAny.itemPrice.updateMany({
      where: {
        business_id: tenantId,
        price_book_id: defaultPriceBook.id,
        variant_id: variantId,
        price_type: normalizedPriceType,
        customer_group_id: null,
        min_qty: 1,
        max_qty: null,
        deleted_at: null,
      },
      data: {
        is_active: false,
        deleted_at: now,
      },
    });
    return {
      variantId,
      itemId: variant.item_id,
      itemName: variant.item?.name ?? "Untitled Item",
      itemCategory: variant.item?.category ?? "",
      variantName: variant.name ?? "",
      sku: variant.sku ?? "",
      isDefaultVariant: Boolean(variant.is_default),
      isActive: false,
      deletedAt: now.toISOString(),
      amount: null,
      currency: normalizedCurrency,
      priceType: normalizedPriceType,
      taxMode: normalizedTaxMode,
      gstSlab: normalizedGstSlab,
      updatedAt: null,
    };
  }

  const existing = await txAny.itemPrice.findFirst({
    where: {
      business_id: tenantId,
      price_book_id: defaultPriceBook.id,
      variant_id: variantId,
      price_type: normalizedPriceType,
      customer_group_id: null,
      min_qty: 1,
      max_qty: null,
      deleted_at: null,
    },
    orderBy: [{ priority: "desc" }, { updated_at: "desc" }],
  });

  const amountAsString = input.amount.toFixed(2);
  await txAny.itemPriceEvent.create({
    data: {
      business_id: tenantId,
      price_book_id: defaultPriceBook.id,
      variant_id: variantId,
      customer_group_id: null,
      min_qty: 1,
      max_qty: null,
      amount: amountAsString,
      currency: normalizedCurrency,
      price_type: normalizedPriceType,
      tax_mode: normalizedTaxMode,
      gst_slab: normalizedGstSlab,
      event_type: "SET",
      effective_at: now,
      created_by: input.actorUserId,
    },
  });
  const saved = existing
    ? await txAny.itemPrice.update({
        where: { id: existing.id },
        data: {
          amount: amountAsString,
          currency: normalizedCurrency,
          tax_mode: normalizedTaxMode,
          gst_slab: normalizedGstSlab,
          is_active: true,
          deleted_at: null,
          starts_at: null,
          ends_at: null,
          priority: 0,
        },
      })
    : await txAny.itemPrice.create({
        data: {
          business_id: tenantId,
          price_book_id: defaultPriceBook.id,
          variant_id: variantId,
          price_type: normalizedPriceType,
          customer_group_id: null,
          min_qty: 1,
          max_qty: null,
          amount: amountAsString,
          currency: normalizedCurrency,
          tax_mode: normalizedTaxMode,
          gst_slab: normalizedGstSlab,
          is_active: true,
          deleted_at: null,
          starts_at: null,
          ends_at: null,
          priority: 0,
        },
      });

  return {
    variantId,
    itemId: variant.item_id,
    itemName: variant.item?.name ?? "Untitled Item",
    itemCategory: variant.item?.category ?? "",
    variantName: variant.name ?? "",
    sku: variant.sku ?? "",
    isDefaultVariant: Boolean(variant.is_default),
    isActive: Boolean(variant.is_active),
    deletedAt: toDeletedAtValue((saved as any).deleted_at),
    amount: Number(saved.amount),
    currency: saved.currency,
    priceType: saved.price_type,
    taxMode: saved.tax_mode,
    gstSlab: saved.gst_slab ?? null,
    updatedAt: saved.updated_at.toISOString(),
  };
};

const getItemPrices = async (
  tenantId: string,
  params: {
    q?: string;
    includeInactive?: boolean;
    priceType?: PriceTypeValue;
    page?: number;
    limit?: number;
  } = {},
  options: {
    canManageProducts?: boolean;
    canManageServices?: boolean;
  } = {},
) => {
  const allowedItemTypes = [
    ...(options.canManageProducts ? (["PRODUCT"] as const) : []),
    ...(options.canManageServices ? (["SERVICE"] as const) : []),
  ];
  if (allowedItemTypes.length === 0) {
    throw permissionDeniedError(
      "Item management is not enabled for this store license",
      "item_price",
      tenantId,
    );
  }
  const query = params.q?.trim();
  const includeInactive = Boolean(params.includeInactive);
  const priceType = params.priceType ?? "SALES";
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50)));

  const [defaultPriceBook, total, variants] = await Promise.all([
    ensureDefaultPriceBook(prismaAny, tenantId),
    prismaAny.itemVariant.count({
      where: {
        business_id: tenantId,
        deleted_at: null,
        item: {
          deleted_at: null,
          item_type: {
            in: [...allowedItemTypes],
          },
        },
        ...(includeInactive ? {} : { is_active: true }),
        ...(query
          ? {
              OR: [
                { sku: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
                { item: { name: { contains: query, mode: "insensitive" } } },
                { item: { category: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
    }),
    prismaAny.itemVariant.findMany({
      where: {
        business_id: tenantId,
        deleted_at: null,
        item: {
          deleted_at: null,
          item_type: {
            in: [...allowedItemTypes],
          },
        },
        ...(includeInactive ? {} : { is_active: true }),
        ...(query
          ? {
              OR: [
                { sku: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
                { item: { name: { contains: query, mode: "insensitive" } } },
                { item: { category: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        item: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: [{ item: { name: "asc" } }, { is_default: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const variantIds = variants.map((variant) => variant.id);
  const prices = variantIds.length
    ? await prismaAny.itemPrice.findMany({
        where: {
          business_id: tenantId,
          price_book_id: defaultPriceBook.id,
          variant_id: {
            in: variantIds,
          },
          price_type: priceType,
          customer_group_id: null,
          min_qty: 1,
          max_qty: null,
          is_active: true,
          deleted_at: null,
        },
        orderBy: [{ priority: "desc" }, { updated_at: "desc" }],
      })
    : [];

  const priceByVariantId = new Map<string, any>();
  for (const price of prices) {
    if (!priceByVariantId.has(price.variant_id)) {
      priceByVariantId.set(price.variant_id, price);
    }
  }

  return {
    priceBook: {
      id: String(defaultPriceBook.id),
      name: String(defaultPriceBook.name),
      currency: String(defaultPriceBook.default_currency),
    },
    rows: variants.map((variant) => {
      const activePrice = priceByVariantId.get(variant.id);
      return {
        variantId: variant.id,
        itemId: variant.item_id,
        itemName: variant.item?.name ?? "Untitled Item",
        itemCategory: variant.item?.category ?? "",
        variantName: variant.name ?? "",
        sku: variant.sku ?? "",
        isDefaultVariant: Boolean(variant.is_default),
        isActive: Boolean(variant.is_active),
        amount: activePrice ? Number(activePrice.amount) : null,
        currency: activePrice?.currency ?? defaultPriceBook.default_currency,
        priceType: activePrice?.price_type ?? priceType,
        taxMode: activePrice?.tax_mode ?? "EXCLUSIVE",
        gstSlab: activePrice?.gst_slab ?? null,
        updatedAt: activePrice?.updated_at?.toISOString() ?? null,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const upsertItemPrice = async (
  tenantId: string,
  variantId: string,
  input: {
    amount: number | null;
    currency?: string;
    priceType?: PriceTypeValue;
    taxMode?: PriceTaxModeValue;
    gstSlab?: string | null;
    actorUserId?: string;
    baseVersion?: number;
  },
  options: {
    canManageProducts?: boolean;
    canManageServices?: boolean;
  } = {},
) => {
  const normalizedPriceType = normalizePriceType(input.priceType, {
    entity: "item_price",
    entityId: variantId,
  });
  const normalizedTaxMode = normalizePriceTaxMode(input.taxMode, {
    entity: "item_price",
    entityId: variantId,
  });
  const normalizedGstSlab = normalizeGstSlab(input.gstSlab, {
    entity: "item_price",
    entityId: variantId,
  });
  const itemType = await resolveVariantItemType(tenantId, variantId);
  if (itemType && !hasItemCapabilityForType(itemType, options)) {
    throw permissionDeniedError(
      getItemTypePermissionMessage(itemType),
      "item_price",
      variantId,
    );
  }
  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    await assertEntityBaseVersion(
      txAny,
      tenantId,
      "item_price",
      variantId,
      input.baseVersion,
    );
    return upsertItemPriceInTx(tx, tenantId, variantId, {
      ...input,
      priceType: normalizedPriceType,
      taxMode: normalizedTaxMode,
      gstSlab: normalizedGstSlab,
    });
  });
};

export default {
  processMutations,
  getDeltasSinceCursor,
  getSyncResults,
  getOptionKeys,
  getItemCategories,
  getItemPrices,
  upsertItemPrice,
};
