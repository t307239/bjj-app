"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import QuickWeightLog from "@/components/QuickWeightLog";
import WeightChart from "@/components/WeightChart";
import BodyHeatmap from "@/components/BodyHeatmap";
import InjuryCareAlert from "@/components/InjuryCareAlert";
import WeightCutPlanner from "@/components/WeightCutPlanner";

interface Props {
  userId: string;
  isPro?: boolean;
}

export default function BodyManagementSection({ userId, isPro: isProProp = false }: Props) {
  const { t } = useLocale();
  const supabase = createClient();

  const [isPro, setIsPro] = useState(isProProp);
  const [bodyStatus, setBodyStatus] = useState<Record<string, string> | null>(null);
  const [bodyStatusDates, setBodyStatusDates] = useState<Record<string, string>>({});
  const [bodyNotes, setBodyNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Incrementing this key triggers a WeightChart re-fetch after QuickWeightLog saves
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  // T-31: Target weight state
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<string>("");
  const [targetWeightInput, setTargetWeightInput] = useState("");
  const [targetDateInput, setTargetDateInput] = useState("");
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetSaved, setTargetSaved] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const targetSavedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (targetSavedTimerRef.current) clearTimeout(targetSavedTimerRef.current);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const [coreRes, bodyRes, weightRes] = await Promise.all([
        // Core profile fields (guaranteed columns)
        supabase
          .from("profiles")
          .select("is_pro, target_weight, target_weight_date")
          .eq("id", userId)
          .single(),
        // Body status fields (JSONB — may not exist on older schemas)
        supabase
          .from("profiles")
          .select("body_status, body_status_dates, body_notes")
          .eq("id", userId)
          .single(),
        supabase
          .from("weight_logs")
          .select("weight")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(1),
      ]);

      if (coreRes.error) console.error("BodyManagementSection:core", coreRes.error);
      if (bodyRes.error) console.error("BodyManagementSection:body", bodyRes.error);

      if (weightRes.data && weightRes.data.length > 0) {
        setLatestWeight(Number(weightRes.data[0].weight));
      }

      // Core fields (isPro, target weight)
      if (coreRes.data) {
        setIsPro(coreRes.data.is_pro ?? isProProp);
        if (coreRes.data.target_weight != null) {
          setTargetWeight(Number(coreRes.data.target_weight));
          setTargetWeightInput(String(coreRes.data.target_weight));
        }
        if (coreRes.data.target_weight_date) {
          setTargetDate(coreRes.data.target_weight_date as string);
          setTargetDateInput(coreRes.data.target_weight_date as string);
        }
      }

      // Body status fields (independent — failure doesn't block core)
      if (bodyRes.data) {
        setBodyStatus(bodyRes.data?.body_status ?? null);
        setBodyStatusDates((bodyRes.data?.body_status_dates as Record<string, string>) ?? {});
        setBodyNotes((bodyRes.data?.body_notes as Record<string, string>) ?? {});
      }
    } catch {
      // Network/auth error — show free tier gracefully
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSaveTarget = async () => {
    const val = parseFloat(targetWeightInput);
    if (isNaN(val) || val <= 0) return;
    setTargetSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({
          target_weight: val,
          target_weight_date: targetDateInput || null,
        })
        .eq("id", userId);
      setTargetWeight(val);
      setTargetDate(targetDateInput);
      setTargetSaved(true);
      setShowTargetForm(false);
      targetSavedTimerRef.current = setTimeout(() => setTargetSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setTargetSaving(false);
    }
  };

  const handleClearTarget = async () => {
    setTargetSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ target_weight: null, target_weight_date: null })
        .eq("id", userId);
      setTargetWeight(null);
      setTargetDate("");
      setTargetWeightInput("");
      setTargetDateInput("");
      setShowTargetForm(false);
    } catch {
      // ignore
    } finally {
      setTargetSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Compute days remaining to target date
  const daysRemaining = targetDate
    ? Math.ceil((new Date(targetDate + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

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
              <span className="mt-1 inline-block bg-zinc-700 text-zinc-400 text-xs font-bold px-5 py-2.5 rounded-xl cursor-not-allowed">
                {t("body.paywallCta")}
              </span>
            )}
          </div>
        )}

        {/* T-31: Target weight section (Pro only) */}
        {isPro && (
          <div className="bg-zinc-900 rounded-xl ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">
                🎯 {t("body.targetWeightTitle")}
              </p>
              <button type="button"
                onClick={() => { setShowTargetForm(!showTargetForm); setTargetWeightInput(String(targetWeight ?? "")); setTargetDateInput(targetDate); }}
                className="text-xs text-zinc-400 hover:text-white transition-colors active:scale-95 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700"
              >
                {targetWeight != null ? t("body.targetWeightEdit") : t("body.targetWeightSet")}
              </button>
            </div>

            {/* Current goal display */}
            {targetWeight != null && !showTargetForm && (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-bold text-amber-400 tabular-nums">
                  {targetWeight}
                  <span className="text-sm font-normal text-zinc-400 ml-1">{t("body.weightUnit")}</span>
                </span>
                {daysRemaining != null && daysRemaining > 0 && (
                  <span className="text-xs text-zinc-400">
                    {t("body.targetDaysLeft").replace("{n}", String(daysRemaining))}
                  </span>
                )}
                {daysRemaining != null && daysRemaining <= 0 && targetDate && (
                  <span className="text-xs text-emerald-400 font-semibold">
                    🎉 {t("body.targetDateReached")}
                  </span>
                )}
                {targetSaved && (
                  <span className="text-xs text-emerald-400 font-semibold">{t("body.targetSaved")}</span>
                )}
              </div>
            )}

            {/* No goal set */}
            {targetWeight == null && !showTargetForm && (
              <p className="text-xs text-zinc-500">{t("body.targetWeightNone")}</p>
            )}

            {/* Edit form */}
            {showTargetForm && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">{t("body.weightKg")}</label>
                    <input
                      type="number"
                      min="20"
                      max="300"
                      step="0.1"
                      value={targetWeightInput}
                      onChange={(e) => setTargetWeightInput(e.target.value)}
                      placeholder="70.0"
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">{t("body.targetDate")}</label>
                    <input
                      type="date"
                      value={targetDateInput}
                      onChange={(e) => setTargetDateInput(e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={handleSaveTarget}
                    disabled={targetSaving || !targetWeightInput}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-bold py-2 rounded-lg transition-colors active:scale-95"
                  >
                    {targetSaving ? t("body.saving") : t("body.targetSaveBtn")}
                  </button>
                  {targetWeight != null && (
                    <button type="button"
                      onClick={handleClearTarget}
                      disabled={targetSaving}
                      className="px-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm py-2 rounded-lg transition-colors active:scale-95"
                    >
                      {t("body.targetClear")}
                    </button>
                  )}
                  <button type="button"
                    onClick={() => setShowTargetForm(false)}
                    className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm py-2 rounded-lg transition-colors active:scale-95"
                  >
                    {t("training.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weight Cut Planner — Pro only, shown when target + date are set */}
        {isPro && targetWeight != null && targetDate && latestWeight != null && (
          <WeightCutPlanner
            currentWeight={latestWeight}
            targetWeight={targetWeight}
            targetDate={targetDate}
          />
        )}

        {/* Chart — blurred behind paywall */}
        <div className={!isPro ? "pointer-events-none select-none blur-sm opacity-40" : ""}>
          <WeightChart userId={userId} refreshKey={chartRefreshKey} targetWeight={targetWeight} targetDate={targetDate || null} />
        </div>

        {/* Injury care alert with 7-day snooze (shown when sore/injured parts exist) */}
        {isPro && (
          <InjuryCareAlert bodyStatus={bodyStatus} bodyStatusDates={bodyStatusDates} />
        )}

        {/* Body heatmap — blurred behind paywall */}
        <div className={!isPro ? "pointer-events-none select-none blur-sm opacity-40" : ""}>
          <BodyHeatmap userId={userId} initialStatus={bodyStatus} initialDates={bodyStatusDates} initialNotes={bodyNotes} />
        </div>
      </div>
    </div>
  );
}
