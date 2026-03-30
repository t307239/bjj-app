"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { subscribePush, unsubscribePush } from "@/lib/webpush";

/**
 * Push Notification opt-in toggle.
 * Returns null when Web Push is unsupported (no VAPID key, no ServiceWorker, no PushManager).
 * Displays an amber warning when the user has blocked notifications.
 */
export default function PushNotificationSection() {
  const { t } = useLocale();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  // null = loading, true = subscribed, false = not subscribed, "blocked" = denied, "unsupported" = N/A
  const [subState, setSubState] = useState<null | boolean | "blocked" | "unsupported">(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!vapidKey) { setSubState("unsupported"); return; }
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSubState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setSubState("blocked");
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription()
    ).then((sub) => {
      setSubState(sub !== null);
    }).catch(() => setSubState(false));
  }, [vapidKey]);

  if (subState === "unsupported") return null;

  const handleToggle = async () => {
    if (toggling || subState === null) return;
    setToggling(true);
    if (subState === false) {
      const ok = await subscribePush();
      setSubState(ok ? true : Notification.permission === "denied" ? "blocked" : false);
    } else if (subState === true) {
      await unsubscribePush();
      setSubState(false);
    }
    setToggling(false);
  };

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-gray-300 text-xs font-semibold mb-0.5">🔔 {t("profile.pushNotifications")}</p>
          <p className="text-gray-500 text-xs leading-relaxed">{t("profile.pushNotificationsDesc")}</p>
          {subState === "blocked" && (
            <p className="text-amber-400 text-xs mt-1">{t("profile.pushBlocked")}</p>
          )}
        </div>
        {subState !== "blocked" && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling || subState === null}
            aria-label={t("profile.ariaPushToggle")}
            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              subState === true ? "bg-[#10B981]" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                subState === true ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
