"use client";

import { useEffect } from "react";
import { startSyncScheduler } from "@/features/sync/client";

type SyncBootstrapProps = {
  intervalMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
};

export default function SyncBootstrap({
  intervalMs,
  initialBackoffMs,
  maxBackoffMs,
}: SyncBootstrapProps) {
  useEffect(() => {
    const stop = startSyncScheduler({
      intervalMs,
      initialBackoffMs,
      maxBackoffMs,
    });
    return stop;
  }, [intervalMs, initialBackoffMs, maxBackoffMs]);

  return null;
}
