import type { Prisma } from "../../../generated/prisma/client.js";
import type { DocumentStatus as PrismaDocumentStatus } from "../../../generated/prisma/enums.js";

export type SalesDocumentStatus =
  (typeof PrismaDocumentStatus)[keyof typeof PrismaDocumentStatus];

export type DocumentHistoryActor = {
  userId: string | null;
  name: string | null;
};

export type DocumentHistoryMetadata = Record<string, unknown>;

type DocumentHistoryWriteClient = Prisma.TransactionClient;

export const SYSTEM_HISTORY_ACTOR: DocumentHistoryActor = {
  userId: null,
  name: "System",
};

export const recordDocumentHistory = async (
  tx: DocumentHistoryWriteClient,
  input: {
    tenantId: string;
    documentId: string;
    eventType: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "CONVERSION_LINKED";
    actor: DocumentHistoryActor;
    fromStatus?: SalesDocumentStatus | null;
    toStatus?: SalesDocumentStatus | null;
    metadata?: DocumentHistoryMetadata;
  },
) =>
  tx.documentHistory.create({
    data: {
      business_id: input.tenantId,
      document_id: input.documentId,
      event_type: input.eventType,
      actor_user_id: input.actor.userId,
      actor_name_snapshot: input.actor.name?.trim() || null,
      from_status: (input.fromStatus ?? null) as SalesDocumentStatus | null,
      to_status: (input.toStatus ?? null) as SalesDocumentStatus | null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? null,
    },
  });

export const mapDocumentHistoryEntries = (
  entries: Array<{
    id: string;
    event_type: string;
    actor_user_id: string | null;
    actor_name_snapshot: string | null;
    from_status: string | null;
    to_status: string | null;
    metadata: unknown;
    created_at: Date;
  }>,
) =>
  entries.map((entry) => ({
    id: entry.id,
    eventType: entry.event_type,
    actorUserId: entry.actor_user_id,
    actorName: entry.actor_name_snapshot,
    fromStatus: entry.from_status,
    toStatus: entry.to_status,
    metadata:
      entry.metadata && typeof entry.metadata === "object" ? entry.metadata : null,
    createdAt: entry.created_at.toISOString(),
  }));
