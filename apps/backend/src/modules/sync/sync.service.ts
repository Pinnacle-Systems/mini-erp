import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../shared/utils/errors.js";

const SUPPORTED_ENTITIES = new Set(["product"]);
const SUPPORTED_PRODUCT_FIELDS = new Set(["sku", "name", "description", "unit"]);
type ProductPayload = {
  sku?: string;
  name?: string;
  description?: string;
  unit?: string;
};
const DEFAULT_PRODUCT_VALUES = {
  sku: "TEMP-SKU",
  name: "Untitled Product",
  description: "",
  unit: "PCS",
};
const prismaAny = prisma as any;

const toPrismaSyncOperation = (op) => {
  if (op === "create") return "CREATE";
  if (op === "update") return "UPDATE";
  return "DELETE";
};

const toSyncOperation = (op) => {
  if (op === "CREATE") return "create";
  if (op === "UPDATE") return "update";
  return "delete";
};

const sanitizeProductPayload = (payload) => {
  const normalized: ProductPayload = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!SUPPORTED_PRODUCT_FIELDS.has(key)) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
};

const buildProductForCreate = (payload) => {
  const normalized = sanitizeProductPayload(payload);

  return {
    sku:
      typeof normalized.sku === "string" && normalized.sku.trim()
        ? normalized.sku.trim()
        : DEFAULT_PRODUCT_VALUES.sku,
    name:
      typeof normalized.name === "string" && normalized.name.trim()
        ? normalized.name.trim()
        : DEFAULT_PRODUCT_VALUES.name,
    description:
      typeof normalized.description === "string"
        ? normalized.description
        : DEFAULT_PRODUCT_VALUES.description,
    unit:
      typeof normalized.unit === "string" ? normalized.unit : DEFAULT_PRODUCT_VALUES.unit,
  };
};

const buildProductForUpdate = (payload) => {
  const normalized = sanitizeProductPayload(payload);
  const patch: ProductPayload = {};

  if (typeof normalized.sku === "string" && normalized.sku.trim()) {
    patch.sku = normalized.sku.trim();
  }
  if (typeof normalized.name === "string" && normalized.name.trim()) {
    patch.name = normalized.name.trim();
  }
  if (typeof normalized.description === "string") {
    patch.description = normalized.description;
  }
  if (typeof normalized.unit === "string") {
    patch.unit = normalized.unit;
  }

  return patch;
};

const getTenantCursor = async (tenantId) => {
  const latestChange = await prismaAny.syncChangeLog.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { cursor: "desc" },
    select: { cursor: true },
  });

  return latestChange?.cursor?.toString() ?? "0";
};

const applyProductMutation = async (tx, tenantId, mutation) => {
  if (mutation.op === "create") {
    const product = await tx.product.create({
      data: {
        id: mutation.entityId,
        store_id: tenantId,
        ...buildProductForCreate(mutation.payload),
      },
    });
    return product;
  }

  const current = await tx.product.findUnique({
    where: { id: mutation.entityId },
  });

  if (!current || current.store_id !== tenantId) {
    throw new AppError("Entity not found in store", 404);
  }

  if (mutation.op === "delete") {
    await tx.product.delete({
      where: { id: mutation.entityId },
    });
    return null;
  }

  const patch = buildProductForUpdate(mutation.payload);
  if (Object.keys(patch).length === 0) {
    return current;
  }

  const product = await tx.product.update({
    where: { id: mutation.entityId },
    data: patch,
  });
  return product;
};

const applyMutation = async (tenantId, mutation) => {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const existing = await txAny.syncMutationLog.findUnique({
      where: { mutation_id: mutation.mutationId },
      select: { id: true },
    });

    if (existing) {
      return { status: "applied" };
    }

    let snapshot = null;
    if (mutation.entity === "product") {
      snapshot = await applyProductMutation(tx, tenantId, mutation);
    } else {
      throw new AppError(`Unsupported entity '${mutation.entity}'`, 400);
    }

    const latestEntityChange = await txAny.syncChangeLog.findFirst({
      where: {
        tenant_id: tenantId,
        entity: mutation.entity,
        entity_id: mutation.entityId,
      },
      orderBy: { server_version: "desc" },
      select: { server_version: true },
    });
    const serverVersion = (latestEntityChange?.server_version ?? 0) + 1;

    const operation = toPrismaSyncOperation(mutation.op);

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
      },
    });

    await txAny.syncChangeLog.create({
      data: {
        tenant_id: tenantId,
        entity: mutation.entity,
        entity_id: mutation.entityId,
        operation,
        data: snapshot ?? {},
        server_version: serverVersion,
      },
    });

    return { status: "applied" };
  });
};

const processMutations = async (tenantId, userId, mutations) => {
  const acknowledgements = [];

  for (const mutation of mutations) {
    if (!SUPPORTED_ENTITIES.has(mutation.entity)) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: `Unsupported entity '${mutation.entity}'`,
      });
      continue;
    }

    if (mutation.userId !== userId) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: "Mutation user does not match authenticated user",
      });
      continue;
    }

    try {
      const result = await applyMutation(tenantId, mutation);
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: result.status,
      });
    } catch (error) {
      acknowledgements.push({
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: error instanceof Error ? error.message : "Mutation failed",
      });
    }
  }

  return {
    cursor: await getTenantCursor(tenantId),
    acknowledgements,
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
    data:
      change.data && typeof change.data === "object" && !Array.isArray(change.data)
        ? change.data
        : {},
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

export default {
  processMutations,
  getDeltasSinceCursor,
};
