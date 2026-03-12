import type { PrismaClient } from "../../../generated/prisma/client.js";
import { DocumentStatus as PrismaDocumentStatus } from "../../../generated/prisma/enums.js";
import {
  SYSTEM_HISTORY_ACTOR,
  recordDocumentHistory,
} from "./document-history.service.js";

type ExpirySweepOptions = {
  batchSize: number;
  now?: Date;
};

type ExpirySweepResult = {
  expiredCount: number;
  processedBatches: number;
  cutoffDate: string;
};

const getUtcStartOfToday = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const expireSalesEstimates = async (
  db: PrismaClient,
  options: ExpirySweepOptions,
): Promise<ExpirySweepResult> => {
  const now = options.now ?? new Date();
  const cutoff = getUtcStartOfToday(now);
  let expiredCount = 0;
  let processedBatches = 0;

  for (;;) {
    const candidates = await db.document.findMany({
      where: {
        type: "SALES_ESTIMATE",
        status: "OPEN",
        deleted_at: null,
        valid_until: {
          lt: cutoff,
        },
      },
      orderBy: [
        {
          valid_until: "asc",
        },
        {
          created_at: "asc",
        },
      ],
      take: options.batchSize,
      select: {
        id: true,
        business_id: true,
        status: true,
        valid_until: true,
      },
    });

    if (candidates.length === 0) {
      break;
    }

    processedBatches += 1;

    for (const candidate of candidates) {
      const updated = await db.$transaction(async (tx) => {
        const result = await tx.document.updateMany({
          where: {
            id: candidate.id,
            business_id: candidate.business_id,
            type: "SALES_ESTIMATE",
            status: "OPEN",
            deleted_at: null,
            valid_until: {
              lt: cutoff,
            },
          },
          data: {
            status: PrismaDocumentStatus.EXPIRED,
          },
        });

        if (result.count === 0) {
          return false;
        }

        await recordDocumentHistory(tx, {
          tenantId: candidate.business_id,
          documentId: candidate.id,
          eventType: "STATUS_CHANGED",
          actor: SYSTEM_HISTORY_ACTOR,
          fromStatus: candidate.status,
          toStatus: PrismaDocumentStatus.EXPIRED,
          metadata: {
            reason: "EXPIRED",
            validUntil: candidate.valid_until?.toISOString().slice(0, 10) ?? null,
            expiredAt: now.toISOString(),
            expiryBasis: "UTC_DATE",
          },
        });

        return true;
      });

      if (updated) {
        expiredCount += 1;
      }
    }

    if (candidates.length < options.batchSize) {
      break;
    }
  }

  return {
    expiredCount,
    processedBatches,
    cutoffDate: cutoff.toISOString().slice(0, 10),
  };
};
