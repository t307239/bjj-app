"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { getLocalDateString } from "@/lib/timezone";

type Props = {
  userId: string;
  streak: number;
};

// getLocalDateString() from lib/timezone replaces the old JST-hardcoded helper

export default function StreakProtect({ userId, streak }: Props) {
  const { t } = useLocale();
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (streak < 1) {
      setTrainedToday(true);
      return;
    }
    const today = getLocalDateString();
    const check = async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("training_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("date", today);
      setTrainedToday((count ?? 0) > 0);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, streak]);

  if (trainedToday === null || trainedToday || dismissed || streak < 1) return null;

  const urgencyText = streak === 1
    ? t("streak.protect1")
    : t("streak.protect", { n: streak });

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3">
      <span className="text-base flex-shrink-0">⚠️</span>
      <p className="flex-1 text-yellow-300 text-sm font-medium leading-snug truncate">
        {urgencyText}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-500/40 hover:text-yellow-400 transition-colors flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
        aria-label={t("common.close")}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
