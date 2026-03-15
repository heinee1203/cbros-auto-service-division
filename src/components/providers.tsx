"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { NetworkStatusProvider } from "@/hooks/use-network-status";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallBanner } from "@/components/pwa/install-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NetworkStatusProvider>
        <OfflineBanner />
        {children}
        <InstallBanner />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-dm-sans)",
            },
          }}
        />
      </NetworkStatusProvider>
    </SessionProvider>
  );
}
