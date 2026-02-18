"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { startSyncScheduler } from "@/features/sync/client";

type SyncBootstrapProps = {
  enabled?: boolean;
  intervalMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
};

export default function SyncBootstrap({
  enabled = true,
  intervalMs,
  initialBackoffMs,
  maxBackoffMs,
}: SyncBootstrapProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled || pathname === "/login" || pathname === "/store-selection") {
      return;
    }

    const stop = startSyncScheduler({
      intervalMs,
      initialBackoffMs,
      maxBackoffMs,
    });
    return stop;
  }, [enabled, initialBackoffMs, intervalMs, maxBackoffMs, pathname]);

  return null;
}
