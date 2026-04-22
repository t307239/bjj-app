"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useLocale } from "@/lib/i18n";

/**
 * OfflineBanner — Q-125 enhanced
 * Renders a sticky banner when offline + briefly shows "reconnected" when back online.
 * Auto-dismiss reconnected message after 3 seconds.
 */
const OfflineBanner = memo(function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useLocale();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      setShowReconnected(true);
      wasOfflineRef.current = false;
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`sticky top-0 z-[60] w-full text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2 transition-colors duration-300 ${
        isOnline
          ? "bg-emerald-600 text-white"
          : "bg-amber-500 text-black"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <span aria-hidden="true">{isOnline ? "✅" : "⚠️"}</span>
      <span>{isOnline ? t("offline.reconnected") : t("offline.banner")}</span>
    </div>
  );
});

export default OfflineBanner;
