import { apiFetch } from "../lib/api";
import { isNativeApp } from "./capacitor";

const DEFAULT_MIN_QUOTA_MB = 100;
const BYTES_PER_MB = 1024 * 1024;

type StorageEstimateWithPersist = StorageManager & {
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimate>;
};

const getQuotaThresholdBytes = () => {
  const configured = Number(import.meta.env.VITE_STORAGE_DIAGNOSTICS_MIN_QUOTA_MB);
  const thresholdMb =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MIN_QUOTA_MB;
  return thresholdMb * BYTES_PER_MB;
};

const postDiagnostic = async (payload: {
  category: "storage";
  level: "warning" | "info";
  event: string;
  details: Record<string, unknown>;
}) => {
  if (!navigator.onLine) {
    return;
  }

  await apiFetch(
    "/api/system/client-diagnostics",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { auth: false, retryOnUnauthorized: false },
  ).catch(() => null);
};

export const runStorageDiagnostics = async () => {
  if (typeof navigator === "undefined" || !("storage" in navigator)) {
    return;
  }

  const storage = navigator.storage as StorageEstimateWithPersist;
  const persist = storage.persist?.bind(storage);
  const estimate = storage.estimate?.bind(storage);

  if (!persist && !estimate) {
    return;
  }

  let persistenceGranted: boolean | null = null;

  if (persist) {
    try {
      persistenceGranted = await persist();
    } catch {
      persistenceGranted = null;
    }
  }

  let quota: number | null = null;
  let usage: number | null = null;

  if (estimate) {
    try {
      const result = await estimate();
      quota = typeof result.quota === "number" ? result.quota : null;
      usage = typeof result.usage === "number" ? result.usage : null;
    } catch {
      quota = null;
      usage = null;
    }
  }

  const details = {
    persistenceGranted,
    quotaBytes: quota,
    usageBytes: usage,
    platform: isNativeApp() ? "native" : "web",
    userAgent: typeof navigator.userAgent === "string" ? navigator.userAgent : "unknown",
  };

  if (persistenceGranted === false) {
    await postDiagnostic({
      category: "storage",
      level: "warning",
      event: "storage-persist-denied",
      details,
    });
  }

  if (quota !== null && quota < getQuotaThresholdBytes()) {
    await postDiagnostic({
      category: "storage",
      level: "warning",
      event: "storage-quota-low",
      details,
    });
  }
};
