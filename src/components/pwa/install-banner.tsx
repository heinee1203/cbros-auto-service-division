"use client";

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

const DISMISS_KEY = "pwa-dismiss-time";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function InstallBanner() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isInstalled) return;

    // Check if recently dismissed
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_DURATION) return;

    // Show after 30 seconds
    const timer = setTimeout(() => {
      if (canInstall || isIOS()) {
        setVisible(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    if (isIOS()) {
      setShowIOSGuide(true);
      return;
    }
    const accepted = await promptInstall();
    if (accepted) setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-primary text-white rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-4">
      {showIOSGuide ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Install on iOS</span>
            <button onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-white/80 space-y-2">
            <p className="flex items-center gap-2">
              <span className="bg-white/20 rounded px-1.5 py-0.5">1</span>
              Tap the <Share className="w-3 h-3 inline" /> Share button in Safari
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-white/20 rounded px-1.5 py-0.5">2</span>
              Scroll down and tap &quot;Add to Home Screen&quot;
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-white/20 rounded px-1.5 py-0.5">3</span>
              Tap &quot;Add&quot; to confirm
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-full py-2 text-xs text-white/60 hover:text-white/80 transition-colors"
          >
            Got it
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Install AutoServ Pro</p>
            <p className="text-xs text-white/70">Faster access from your home screen</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-accent text-primary text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Not now"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
