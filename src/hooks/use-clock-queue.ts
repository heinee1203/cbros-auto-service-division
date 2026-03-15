"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNetworkStatus } from "./use-network-status";
import { getClockQueueCount, syncClockActions } from "@/lib/offline/clock-queue";
import { toast } from "sonner";

export function useClockQueue() {
  const { isOnline } = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOffline = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getClockQueueCount();
      setQueueCount(count);
    } catch {
      // IndexedDB not available
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncClockActions();
      if (result.synced > 0) {
        toast.success(`${result.synced} clock punch${result.synced > 1 ? "es" : ""} synced`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} punch${result.failed > 1 ? "es" : ""} failed to sync`);
      }
      await refreshCount();
    } catch {
      toast.error("Failed to sync clock punches");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 10000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current && queueCount > 0) {
      wasOffline.current = false;
      syncNow();
    }
  }, [isOnline, queueCount, syncNow]);

  return { queueCount, isSyncing, syncNow, refreshCount };
}
