"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const stop = startSyncScheduler({
      intervalMs,
      initialBackoffMs,
      maxBackoffMs,
    });
    return stop;
  }, [initialBackoffMs, intervalMs, maxBackoffMs, pathname]);

  return null;
}
