"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNetworkStatus } from "./use-network-status";
import { getQueueCount, syncPhotos } from "@/lib/offline/photo-queue";
import { toast } from "sonner";

export function usePhotoQueue() {
  const { isOnline } = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOffline = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueueCount(count);
    } catch {
      // IndexedDB not available (SSR)
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncPhotos();
      if (result.synced > 0) {
        toast.success(`${result.synced} photo${result.synced > 1 ? "s" : ""} synced successfully`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} photo${result.failed > 1 ? "s" : ""} failed to sync`);
      }
      await refreshCount();
    } catch {
      toast.error("Failed to sync photos");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  // Refresh count periodically
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 10000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Auto-sync when coming back online
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
