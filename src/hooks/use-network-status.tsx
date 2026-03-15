"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

interface NetworkStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastOnlineAt: Date | null;
}

const NetworkStatusContext = createContext<NetworkStatus>({
  isOnline: true,
  isServerReachable: true,
  lastOnlineAt: null,
});

export function useNetworkStatus() {
  return useContext(NetworkStatusContext);
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const updateOnlineStatus = useCallback((online: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsOnline(online);
      if (online) setLastOnlineAt(new Date());
    }, 500);
  }, []);

  const checkServer = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("/api/health", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      setIsServerReachable(res.ok);
      if (res.ok) {
        setIsOnline(true);
        setLastOnlineAt(new Date());
      }
    } catch {
      setIsServerReachable(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial state
    setIsOnline(navigator.onLine);
    if (navigator.onLine) setLastOnlineAt(new Date());

    const handleOnline = () => updateOnlineStatus(true);
    const handleOffline = () => updateOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Heartbeat every 30 seconds
    const interval = setInterval(checkServer, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [updateOnlineStatus, checkServer]);

  return (
    <NetworkStatusContext.Provider value={{ isOnline, isServerReachable, lastOnlineAt }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
