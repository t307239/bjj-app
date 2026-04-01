"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import QuickWeightLog from "@/components/QuickWeightLog";
import WeightChart from "@/components/WeightChart";
import BodyHeatmap from "@/components/BodyHeatmap";
import InjuryCareAlert from "@/components/InjuryCareAlert";

interface Props {
  userId: string;
}

export default function BodyManagementSection({ userId }: Props) {
  const { t } = useLocale();
  const supabase = createClient();

  const [isPro, setIsPro] = useState(false);
  const [bodyStatus, setBodyStatus] = useState<Record<string, string> | null>(null);
  const [bodyStatusDates, setBodyStatusDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Incrementing this key triggers a WeightChart re-fetch after QuickWeightLog saves
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_pro, body_status, body_status_dates")
        .eq("id", userId)
        .single();

      setIsPro(data?.is_pro ?? false);
      setBodyStatus(data?.body_status ?? null);
      setBodyStatusDates((data?.body_status_dates as Record<string, string>) ?? {});
    } catch {
      // Network/auth error — show free tier gracefully
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Quick Weight Log (always visible — free users can log, just can't see chart) ── */}
      <QuickWeightLog
        userId={userId}
        onLogged={() => setChartRefreshKey((k) => k + 1)}
      />

      {/* ── Weight Chart + Body Heatmap: Pro-gated ── */}
      <div className={`space-y-4 ${!isPro ? "relative" : ""}`}>

        {/* Paywall overlay for free users */}
        {!isPro && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-zinc-950/85 backdrop-blur-sm px-6 text-center">
            <span className="text-3xl">🔒</span>
            <p className="text-sm font-semibold text-zinc-100 leading-snug">
              {t("body.paywallTitle")}
            </p>
            <p className="text-xs text-zinc-400">{t("body.paywallDesc")}</p>
            {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ? (
              <a
                href={`${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}?client_reference_id=${userId}`}
                className="mt-1 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20"
              >
                {t("body.paywallCta")}
              </a>
            ) : (
              <span className="mt-1 inline-block bg-zinc-700 text-gray-500 text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed">
                {t("body.paywallCta")}
              </span>
            )}
          </div>
        )}

        {/* Chart — blurred behind paywall */}
        <div className={!isPro ? "pointer-events-none select-none blur-sm opacity-40" : ""}>
          <WeightChart userId={userId} refreshKey={chartRefreshKey} />
        </div>

        {/* Injury care alert with 7-day snooze (shown when sore/injured parts exist) */}
        {isPro && (
          <InjuryCareAlert bodyStatus={bodyStatus} bodyStatusDates={bodyStatusDates} />
        )}

        {/* Body heatmap — blurred behind paywall */}
        <div className={!isPro ? "pointer-events-none select-none blur-sm opacity-40" : ""}>
          <BodyHeatmap userId={userId} initialStatus={bodyStatus} initialDates={bodyStatusDates} />
        </div>
      </div>
    </div>
  );
}
