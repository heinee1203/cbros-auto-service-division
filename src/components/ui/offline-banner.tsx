"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Defer rendering until after hydration — network status depends on browser APIs
  if (!mounted || isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You&apos;re offline — changes will sync when reconnected</span>
    </div>
  );
}
