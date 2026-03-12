import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { expireSalesEstimates } from "../modules/sales/document-expiry.service.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;
const LOCK_NAMESPACE = 41203;
const LOCK_KEY = 1;

const intervalMs = Number(process.env.DOCUMENT_EXPIRY_INTERVAL_MS || DEFAULT_INTERVAL_MS);
const batchSize = Number(process.env.DOCUMENT_EXPIRY_BATCH_SIZE || DEFAULT_BATCH_SIZE);

let shuttingDown = false;
let activeTimer: NodeJS.Timeout | null = null;
let runInProgress = false;

const log = (message: string, details?: Record<string, unknown>) => {
  if (details) {
    console.log(`[document-expiry-worker] ${message}`, details);
    return;
  }

  console.log(`[document-expiry-worker] ${message}`);
};

const acquireLock = async () => {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${LOCK_NAMESPACE}, ${LOCK_KEY}) AS locked
  `;
  return rows[0]?.locked === true;
};

const releaseLock = async () => {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${LOCK_NAMESPACE}, ${LOCK_KEY})
  `;
};

const scheduleNextRun = () => {
  if (shuttingDown) {
    return;
  }

  activeTimer = setTimeout(() => {
    void runSweep();
  }, intervalMs);
};

const runSweep = async () => {
  if (runInProgress || shuttingDown) {
    return;
  }

  runInProgress = true;
  let lockAcquired = false;

  try {
    lockAcquired = await acquireLock();
    if (!lockAcquired) {
      log("Skipped run because another worker holds the advisory lock.");
      return;
    }

    const result = await expireSalesEstimates(prisma, {
      batchSize,
    });
    log("Expiry sweep completed.", result);
  } catch (error) {
    log("Expiry sweep failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    if (lockAcquired) {
      await releaseLock().catch(() => undefined);
    }
    runInProgress = false;
    scheduleNextRun();
  }
};

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (activeTimer) {
    clearTimeout(activeTimer);
  }
  log(`Received ${signal}. Shutting down worker.`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

log("Starting document expiry worker.", {
  intervalMs,
  batchSize,
  expiryBasis: "UTC_DATE",
});
void runSweep();
