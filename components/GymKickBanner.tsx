"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

/**
 * Persistent banner shown to a member who was kicked from their gym.
 * Visible when gym_kick_notified === false AND gym_id IS NULL.
 * Dismisses by setting gym_kick_notified = true.
 */
export default function GymKickBanner({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (dismissed) return null;

  const dismiss = async () => {
    setDismissing(true);
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ gym_kick_notified: true })
        .eq("id", userId);
      setDismissed(true);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div
      role="alert"
      className="bg-[#e94560]/10 border border-[#e94560]/40 rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
    >
      <span className="text-xl flex-shrink-0 mt-0.5">🚫</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          {t("gym.kickedBannerTitle")}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {t("gym.kickedBannerDesc")}
        </p>
      </div>
      <button
        onClick={dismiss}
        disabled={dismissing}
        className="flex-shrink-0 text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-2 py-1 transition-colors disabled:opacity-50 mt-0.5"
        aria-label="Dismiss notification"
      >
        {dismissing ? "…" : t("gym.kickedBannerDismiss")}
      </button>
    </div>
  );
}
