"use client";

import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useLocale } from "@/lib/i18n";

/**
 * OfflineBanner
 * Renders a sticky amber banner at the top of the page when the device has no
 * network connectivity. Disappears automatically when the connection returns.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useLocale();

  if (isOnline) return null;

  return (
    <div
      className="sticky top-0 z-[60] w-full bg-amber-500 text-black text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2"
      role="alert"
      aria-live="assertive"
    >
      <span aria-hidden="true">⚠️</span>
      <span>{t("offline.banner")}</span>
    </div>
  );
}
