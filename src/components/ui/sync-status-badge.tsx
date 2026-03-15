"use client";

import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function SyncStatusBadge() {
  const { queueCount, isSyncing, syncNow } = usePhotoQueue();
  const { isOnline } = useNetworkStatus();

  if (queueCount === 0 && isOnline) return null;

  return (
    <button
      onClick={syncNow}
      disabled={isSyncing || !isOnline}
      className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-surface-100 touch-target"
      title={
        isSyncing
          ? "Syncing..."
          : !isOnline
          ? "Offline — will sync when connected"
          : `${queueCount} pending upload${queueCount > 1 ? "s" : ""}`
      }
    >
      {isSyncing ? (
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
      ) : !isOnline ? (
        <CloudOff className="w-4 h-4 text-amber-500" />
      ) : queueCount > 0 ? (
        <RefreshCw className="w-4 h-4 text-amber-500" />
      ) : (
        <Cloud className="w-4 h-4 text-green-500" />
      )}
      {queueCount > 0 && (
        <span className="text-amber-600">{queueCount}</span>
      )}
    </button>
  );
}
