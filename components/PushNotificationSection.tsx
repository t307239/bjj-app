"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/lib/i18n";
import { subscribePush, unsubscribePush } from "@/lib/webpush";

type NotifPrefs = {
  reengagement: boolean;
  weekly_goal: boolean;
  milestone: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  reengagement: true,
  weekly_goal: true,
  milestone: true,
};

/**
 * Push Notification opt-in toggle with per-channel preferences.
 * Returns null when Web Push is unsupported (no VAPID key, no ServiceWorker, no PushManager).
 * Displays an amber warning when the user has blocked notifications.
 */
export default function PushNotificationSection() {
  const { t } = useLocale();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  // null = loading, true = subscribed, false = not subscribed, "blocked" = denied, "unsupported" = N/A
  const [subState, setSubState] = useState<null | boolean | "blocked" | "unsupported">(null);
  const [toggling, setToggling] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [savingPref, setSavingPref] = useState(false);

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

  // Fetch preferences when subscribed
  useEffect(() => {
    if (subState !== true) return;
    fetch("/api/push/preferences")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.preferences) {
          setPrefs({
            reengagement: json.preferences.reengagement ?? true,
            weekly_goal: json.preferences.weekly_goal ?? true,
            milestone: json.preferences.milestone ?? true,
          });
        }
      })
      .catch((err) => { console.error("Failed to fetch push preferences", err); });
  }, [subState]);

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

  const updatePref = useCallback(async (key: keyof NotifPrefs, value: boolean) => {
    setSavingPref(true);
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // Revert on failure
      setPrefs(prefs);
    }
    setSavingPref(false);
  }, [prefs]);

  if (subState === "unsupported") return null;

  const channels: { key: keyof NotifPrefs; label: string; icon: string }[] = [
    { key: "reengagement", label: t("profile.pushPrefReengagement"), icon: "🔥" },
    { key: "weekly_goal", label: t("profile.pushPrefWeeklyGoal"), icon: "🎯" },
    { key: "milestone", label: t("profile.pushPrefMilestone"), icon: "🏆" },
  ];

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-zinc-300 text-xs font-semibold mb-0.5">🔔 {t("profile.pushNotifications")}</p>
          <p className="text-zinc-400 text-xs leading-relaxed">{t("profile.pushNotificationsDesc")}</p>
          {subState === "blocked" && (
            <p className="text-amber-400 text-xs mt-1">{t("profile.pushBlocked")}</p>
          )}
        </div>
        {subState !== "blocked" && (
          <div className="shrink-0 flex items-center gap-2">
            {toggling && (
              <span className="text-zinc-500 text-xs whitespace-nowrap animate-pulse">
                {subState === false ? t("profile.pushEnabling") : t("profile.pushDisabling")}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling || subState === null}
              aria-label={t("profile.ariaPushToggle")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                toggling
                  ? "bg-zinc-600 animate-pulse"
                  : subState === true
                  ? "bg-[#10B981]"
                  : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
                  subState === true ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Per-channel toggles — only show when subscribed */}
      {subState === true && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-1">
            {t("profile.pushPrefTitle")}
          </p>
          {channels.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-zinc-400 text-xs">
                {icon} {label}
              </span>
              <button
                type="button"
                onClick={() => updatePref(key, !prefs[key])}
                disabled={savingPref}
                aria-label={`${label} ${prefs[key] ? "off" : "on"}`}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  savingPref
                    ? "bg-zinc-600 animate-pulse"
                    : prefs[key]
                    ? "bg-emerald-600"
                    : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300 ${
                    prefs[key] ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
