"use client";

/**
 * WeeklyReportCard — Pro feature: auto-generated weekly/monthly performance report.
 * Placed on /dashboard between StatusBar and AICoachCard.
 * Pro users see full KPI + trend + insights. Free users see blur teaser.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useWeeklyReport, type TrainingType } from "@/hooks/useWeeklyReport";
import { trackEvent } from "@/lib/analytics";
import { logClientError } from "@/lib/logger";
import Link from "next/link";

type Props = {
  userId: string;
  isPro: boolean;
};

type LogEntry = {
  date: string;
  type: string;
  duration_min: number | null;
};

const TYPE_COLORS: Record<TrainingType, string> = {
  gi: "bg-blue-500",
  nogi: "bg-orange-500",
  drilling: "bg-purple-500",
  competition: "bg-red-500",
  open_mat: "bg-green-500",
  recovery: "bg-teal-500",
};

const TYPE_ICONS: Record<TrainingType, string> = {
  gi: "🥋",
  nogi: "👕",
  drilling: "🎯",
  competition: "🏆",
  open_mat: "🤝",
  recovery: "🧘",
};

export default function WeeklyReportCard({ userId, isPro }: Props) {
  const { t, locale } = useLocale();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"week" | "month">("week");

  // Fetch 8 weeks (56 days) of training logs
  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      setLoading(true);
      const supabase = createClient();
      const daysBack = isPro ? 56 : 28; // Pro: 8 weeks, Free: 4 weeks
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("training_logs")
        .select("date, type, duration_min")
        .eq("user_id", userId)
        .gte("date", sinceStr)
        .order("date", { ascending: false });

      if (!cancelled) {
        if (!error && data) {
          setLogs(data as LogEntry[]);
        }
        setLoading(false);
      }
    }
    fetchLogs().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, isPro]);

  const report = useWeeklyReport(logs, t);

  // ── Loading skeleton — matches real content height to prevent layout shift ──
  if (loading) {
    return (
      <div className="bg-zinc-900/60 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl px-4 py-4 mb-5 animate-pulse">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-zinc-800 rounded w-32" />
          <div className="h-6 bg-zinc-800 rounded w-24" />
        </div>
        {/* KPI row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-zinc-800/40 rounded-xl px-3 py-2">
            <div className="h-2.5 bg-zinc-700 rounded w-12 mb-1.5" />
            <div className="h-5 bg-zinc-700 rounded w-8" />
          </div>
          <div className="flex-1 bg-zinc-800/40 rounded-xl px-3 py-2">
            <div className="h-2.5 bg-zinc-700 rounded w-12 mb-1.5" />
            <div className="h-5 bg-zinc-700 rounded w-10" />
          </div>
          <div className="flex-1 bg-zinc-800/40 rounded-xl px-3 py-2">
            <div className="h-2.5 bg-zinc-700 rounded w-12 mb-1.5" />
            <div className="h-5 bg-zinc-700 rounded w-8" />
          </div>
        </div>
        {/* Type distribution bar */}
        <div className="h-2.5 bg-zinc-800 rounded w-24 mb-1.5" />
        <div className="h-5 bg-zinc-800 rounded-lg mb-2" />
        {/* Trend chart placeholder */}
        <div className="h-2.5 bg-zinc-800 rounded w-20 mb-1.5" />
        <div className="flex items-end gap-1 h-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="h-2 bg-zinc-700 rounded w-3" />
              <div className="w-full bg-zinc-800 rounded-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state (not enough data) ──
  if (!report.hasEnoughData && isPro) {
    return (
      <div className="bg-zinc-900/60 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl px-4 py-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📊</span>
          <h3 className="text-sm font-semibold text-white">{t("report.title")}</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-3">{t("report.emptyState")}</p>
        <a
          href="/records"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          {t("report.logTraining")}
        </a>
      </div>
    );
  }

  // ── Free user: blur teaser ──
  if (!isPro) {
    return (
      <div className="relative bg-zinc-900/60 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl px-4 py-4 mb-5 overflow-hidden">
        {/* Blurred preview content */}
        <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-semibold text-white">{t("report.title")}</h3>
          </div>
          <div className="flex gap-3 mb-3">
            <KPIItem label={t("report.sessions")} value="5" delta="+2" positive />
            <KPIItem label={t("report.totalTime")} value="7.5h" />
            <KPIItem label={t("report.avgTime")} value="90min" />
          </div>
          <div className="h-6 flex gap-0.5 rounded overflow-hidden mb-2">
            <div className="bg-blue-500 flex-[3]" />
            <div className="bg-orange-500 flex-[2]" />
            <div className="bg-purple-500 flex-1" />
          </div>
        </div>
        {/* CTA overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40">
          <Link
            href="/profile#upgrade"
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-amber-500/20"
            onClick={() => trackEvent("pricing_upgrade_click", { feature: "weekly_report" })}
          >
            {t("report.upgradeCta")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Pro: Full report ──
  const totalTypeCount = Object.values(report.typeDistribution).reduce((a, b) => a + b, 0);

  // ── Share handler — §8 Viral ──
  const [sharing, setSharing] = useState(false);
  const handleShareReport = useCallback(async () => {
    setSharing(true);
    try {
      const count = tab === "week" ? report.currentWeekCount : report.currentMonthCount;
      const periodLabel = tab === "week" ? t("report.tabWeek") : t("report.tabMonth");
      const totalMin = tab === "week" ? report.currentWeekTotalMinutes : report.currentMonthTotalMinutes;
      const timeStr = totalMin > 0
        ? (totalMin >= 60
          ? `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? `${totalMin % 60}m` : ""}`
          : `${totalMin}m`)
        : "";
      const text = [
        `🥋 ${periodLabel}: ${count} ${t("report.sessions")}`,
        timeStr ? `⏱ ${timeStr}` : "",
        report.maxConsecutiveDays > 0 ? `🔥 ${t("report.streakValue", { n: report.maxConsecutiveDays })}` : "",
        "",
        "#BJJ #JiuJitsu #Training",
        "bjj-app.net",
      ].filter(Boolean).join("\n");

      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      trackEvent("monthly_share", { period: tab });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        logClientError("weekly_report.share_error", err);
      }
    } finally {
      setSharing(false);
    }
  }, [tab, report, t]);

  return (
    <div className="bg-zinc-900/60 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl px-4 py-4 mb-5">
      {/* Header with tab */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h3 className="text-sm font-semibold text-white">{t("report.title")}</h3>
        </div>
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          <button type="button"
            onClick={() => setTab("week")}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              tab === "week"
                ? "bg-zinc-700 text-white font-medium"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t("report.tabWeek")}
          </button>
          <button type="button"
            onClick={() => setTab("month")}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              tab === "month"
                ? "bg-zinc-700 text-white font-medium"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t("report.tabMonth")}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="flex gap-3 mb-4">
        <KPIItem
          label={t("report.sessions")}
          value={String(tab === "week" ? report.currentWeekCount : report.currentMonthCount)}
          delta={formatDelta(tab === "week" ? report.weekDelta : report.monthDelta)}
          positive={(tab === "week" ? report.weekDelta : report.monthDelta) > 0}
          negative={(tab === "week" ? report.weekDelta : report.monthDelta) < 0}
        />
        {(() => {
          const totalMin = tab === "week" ? report.currentWeekTotalMinutes : report.currentMonthTotalMinutes;
          if (totalMin <= 0) return null;
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          const display = h > 0 && m > 0 ? `${h}h${m}m` : h > 0 ? `${h}h` : `${m}m`;
          return <KPIItem label={t("report.totalTime")} value={display} />;
        })()}
        {report.avgMinutesPerSession > 0 && (
          <KPIItem
            label={t("report.avgTime")}
            value={`${report.avgMinutesPerSession}${t("report.minUnit")}`}
          />
        )}
        {report.maxConsecutiveDays > 0 && (
          <KPIItem
            label={t("report.maxStreak")}
            value={t("report.streakValue", { n: report.maxConsecutiveDays })}
          />
        )}
      </div>

      {/* Type distribution bar */}
      {totalTypeCount > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-1.5">{t("report.typeDistribution")}</p>
          <div className="h-5 flex gap-0.5 rounded-lg overflow-hidden mb-2">
            {(Object.entries(report.typeDistribution) as [TrainingType, number][])
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([typ, count]) => (
                <div
                  key={typ}
                  className={`${TYPE_COLORS[typ]} transition-all`}
                  style={{ flex: count }}
                  title={`${t(`training.${typ}`)} (${count})`}
                />
              ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(Object.entries(report.typeDistribution) as [TrainingType, number][])
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([typ, count]) => (
                <span key={typ} className="flex items-center gap-1 text-xs text-zinc-400">
                  <span>{TYPE_ICONS[typ]}</span>
                  <span className="whitespace-nowrap">{t(`training.${typ}`)} {count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Weekly trend mini chart */}
      {report.weeklyTrend.length >= 2 && (
        <div className="mb-3">
          <p className="text-xs text-zinc-500 mb-1.5">{t("report.weeklyTrend")}</p>
          <div className="flex items-end gap-1 h-12">
            {report.weeklyTrend.map((week) => {
              const maxCount = Math.max(...report.weeklyTrend.map((w) => w.count), 1);
              const height = Math.max((week.count / maxCount) * 100, 8);
              const isCurrentWeek = week.weekStart === getMonday(new Date().toISOString().slice(0, 10));
              return (
                <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-zinc-500 tabular-nums">{week.count}</span>
                  <div
                    className={`w-full rounded-sm transition-all ${
                      isCurrentWeek
                        ? "bg-emerald-500"
                        : "bg-zinc-700"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[9px] text-zinc-600 whitespace-nowrap">
                    {formatWeekLabel(week.weekStart, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights + Share */}
      <div className="flex items-start gap-2 mt-2">
        {report.insights.length > 0 && (
          <div className="bg-zinc-800/50 rounded-xl p-3 flex-1 min-w-0">
            {report.insights.map((insight, i) => (
              <p key={i} className="text-xs text-zinc-300 leading-relaxed">
                {i === 0 ? "💡 " : "• "}{insight}
              </p>
            ))}
          </div>
        )}
        {/* §8 Viral: Share report button */}
        <button type="button"
          onClick={handleShareReport}
          disabled={sharing}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-800/50 rounded-xl px-3 py-2.5 min-h-[36px] disabled:opacity-40"
          aria-label={t("report.share")}
        >
          {sharing ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
          <span className="hidden sm:inline">{t("report.share")}</span>
        </button>
      </div>
    </div>
  );
}

// ── Helper: KPI item ──
function KPIItem({
  label,
  value,
  delta,
  positive,
  negative,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex-1 bg-zinc-800/40 rounded-xl px-3 py-2">
      <p className="text-[10px] text-zinc-500 mb-0.5 whitespace-nowrap">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-white tabular-nums whitespace-nowrap">{value}</span>
        {delta && (
          <span
            className={`text-[10px] font-medium tabular-nums whitespace-nowrap ${
              positive
                ? "text-emerald-400"
                : negative
                  ? "text-red-400"
                  : "text-zinc-500"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Helper: format delta ──
function formatDelta(delta: number): string {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

// ── Helper: format week label (e.g. "4/6") ──
function formatWeekLabel(weekStart: string, locale: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${month}/${day}`;
}

// ── Helper: get Monday of ISO week ──
function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
