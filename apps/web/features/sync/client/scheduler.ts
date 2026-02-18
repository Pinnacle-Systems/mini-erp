/// <reference lib="dom" />
import { syncOnce } from "./engine";

type SyncSchedulerOptions = {
  intervalMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
};

const DEFAULT_OPTIONS: Required<SyncSchedulerOptions> = {
  intervalMs: 15_000,
  initialBackoffMs: 2_000,
  maxBackoffMs: 120_000,
};

let stopActiveScheduler: (() => void) | null = null;

export const startSyncScheduler = (options: SyncSchedulerOptions = {}) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (stopActiveScheduler) {
    stopActiveScheduler();
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let failureCount = 0;
  let isStopped = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delayMs: number) => {
    clearTimer();
    if (isStopped) {
      return;
    }

    timer = setTimeout(() => {
      void runCycle();
    }, delayMs);
  };

  const runCycle = async () => {
    if (isStopped || inFlight) {
      return;
    }

    if (!window.navigator.onLine) {
      schedule(config.intervalMs);
      return;
    }

    inFlight = true;

    try {
      await syncOnce();
      failureCount = 0;
      schedule(config.intervalMs);
    } catch (error) {
      console.error("Sync cycle failed", error);
      failureCount += 1;
      const backoff = Math.min(
        config.initialBackoffMs * 2 ** (failureCount - 1),
        config.maxBackoffMs,
      );
      schedule(backoff);
    } finally {
      inFlight = false;
    }
  };

  const handleOnline = () => {
    void runCycle();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void runCycle();
    }
  };

  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  schedule(0);

  const stop = () => {
    isStopped = true;
    clearTimer();
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (stopActiveScheduler === stop) {
      stopActiveScheduler = null;
    }
  };

  stopActiveScheduler = stop;
  return stop;
};
