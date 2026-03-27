"use client";

import { useState, useEffect } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type DayData = {
  date: string;
  count: number;
};

type MonthData = {
  ym: string;      // "2026-03"
  label: string;   // "3月"
  count: number;
  minutes: number;
};

type Props = {
  userId: string;
  isPro?: boolean;
};

// ローカル日付文字列ヘルパー（UTC変換しない）
function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 過去84日（12週）のヒートマップ + 月別棒グラフ
export default function TrainingChart({ userId, isPro = false }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<DayData[]>([]);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"heatmap" | "monthly">("heatmap");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      try {
        // 過去12ヶ月分を取得（ヒートマップ + 月別チャート両方に対応）
        const since = new Date();
        since.setDate(since.getDate() - 83);
        const sinceStr = toLocalStr(since);

        // 月別チャート用: 過去12ヶ月の開始日
        const monthSince = new Date();
        monthSince.setMonth(monthSince.getMonth() - 11);
        monthSince.setDate(1);
        const monthSinceStr = toLocalStr(monthSince);

        const { data: logs } = await supabase
          .from("training_logs")
          .select("date, duration_min")
          .eq("user_id", userId)
          .gte("date", monthSinceStr)
          .order("date", { ascending: true });

        if (logs) {
          // --- ヒートマップ用 ---
          const counts: Record<string, number> = {};
          logs.forEach((l: { date: string; duration_min: number }) => {
            if (l.date >= sinceStr) {
              counts[l.date] = (counts[l.date] || 0) + 1;
            }
          });
          const days: DayData[] = [];
          for (let i = 83; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = toLocalStr(d);
            days.push({ date: dateStr, count: counts[dateStr] || 0 });
          }
          setData(days);

          // --- 月別チャート用（過去6ヶ月） ---
          const mCounts: Record<string, { count: number; minutes: number }> = {};
          logs.forEach((l: { date: string; duration_min: number }) => {
            const ym = l.date.slice(0, 7);
            if (!mCounts[ym]) mCounts[ym] = { count: 0, minutes: 0 };
            mCounts[ym].count++;
            mCounts[ym].minutes += l.duration_min ?? 0;
          });

          // 過去6ヶ月のラベル生成
          const months: MonthData[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = new Intl.DateTimeFormat("en", { month: "short" }).format(d);
            const info = mCounts[ym] || { count: 0, minutes: 0 };
            months.push({ ym, label, count: info.count, minutes: info.minutes });
          }
          setMonthData(months);
        }
      } catch {
        // Network/auth error — show empty heatmap gracefully
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <Skeleton height={120} rounded="xl" className="mb-4" />;

  // ── Pro paywall: データがある非Proはblur + upgrade CTA ──────────────────
  if (!isPro && data.some((d) => d.count > 0)) {
    return (
      <div className="relative bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4 overflow-hidden">
        <h4 className="text-sm font-medium text-gray-300 mb-3">{t("chart.activity")}</h4>
        <div className="blur-sm opacity-40 pointer-events-none select-none">
          <div className="flex gap-1">
            {Array.from({ length: 12 }, (_, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {Array.from({ length: 7 }, (_, di) => {
                  const v = (wi * 7 + di * 3 + wi + di) % 4;
                  const cls = v === 0 ? "bg-zinc-900/50" : v === 1 ? "bg-green-700/60" : v === 2 ? "bg-green-500/80" : "bg-green-400";
                  return <div key={di} className={`w-3 h-3 rounded-sm ${cls}`} />;
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
          <span className="text-2xl mb-2">🔒</span>
          <p className="text-sm font-semibold text-zinc-100">{t("chart.proOnly")}</p>
          {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ? (
            <a
              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
              className="mt-3 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-4 py-2 rounded-lg transition-all"
            >
              {t("chart.upgradeToProBtn")}
            </a>
          ) : (
            <span className="mt-3 inline-block bg-zinc-700 text-gray-500 text-xs font-semibold px-4 py-2 rounded-lg cursor-not-allowed">
              {t("chart.upgradeToProBtn")}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Empty state teaser (#4): blurred dummy chart + CTA overlay ──────────
  const isEmpty = data.every((d) => d.count === 0);
  if (isEmpty) {
    // Generate deterministic dummy heatmap data for visual effect
    const dummyWeeks = Array.from({ length: 12 }, (_, wi) =>
      Array.from({ length: 7 }, (_, di) => {
        const pseudo = (wi * 7 + di * 3 + wi + di) % 5;
        return pseudo;
      })
    );
    return (
      <div className="relative bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4 overflow-hidden">
        {/* Blurred dummy heatmap background */}
        <div className="blur-sm opacity-40 pointer-events-none select-none">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">{t("chart.activity")}</span>
            <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
              <span className="text-xs px-3 py-1 rounded-lg bg-zinc-600 text-white">84 days</span>
              <span className="text-xs px-3 py-1 text-gray-400">Monthly</span>
            </div>
          </div>
          <div className="flex gap-1">
            <div className="flex flex-col gap-0.5 mr-1">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="text-xs text-gray-500 h-3 flex items-center">{d}</div>
              ))}
            </div>
            {dummyWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((val, di) => (
                  <div
                    key={di}
                    className={`w-3 h-3 rounded-sm ${
                      val === 0 ? "bg-zinc-900/50"
                      : val === 1 ? "bg-green-700/60"
                      : val === 2 ? "bg-green-500/80"
                      : val === 3 ? "bg-green-400"
                      : "bg-zinc-900/50"
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Overlay CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
          <p className="text-white font-semibold text-sm text-center leading-snug">
            {t("chart.emptyHeading")}
          </p>
          <p className="text-gray-400 text-xs text-center">{t("chart.emptySubtitle")}</p>
          <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-xs font-semibold px-5 py-2 rounded-full transition-all shadow-lg shadow-[#10B981]/25"
            >
              {t("chart.emptyButton")}
            </button>
        </div>
      </div>
    );
  }

  const getColor = (count: number) => {
    if (count === 0) return "bg-zinc-900/50";
    if (count === 1) return "bg-green-700/60";
    if (count === 2) return "bg-green-500/80";
    return "bg-green-400";
  };

  // Fixed English day abbreviations (Sun=0 ... Sat=6) — never translate via locale
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // 2024-01-07 is Sun
    return new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(d);
  });

  // GitHub-style Sunday-aligned weeks: pad front so data[0] aligns to its actual weekday
  // data[0] = today-83; determine its day-of-week (0=Sun) and prepend that many nulls
  const firstDayOfWeek = data.length > 0
    ? new Date(data[0].date + "T00:00:00").getDay() // 0=Sun
    : 0;
  const paddedData: (DayData | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...data,
  ];
  // Split into columns of 7 (each column = one week, Sun→Sat)
  const weeks: (DayData | null)[][] = [];
  for (let i = 0; i < paddedData.length; i += 7) {
    const col = paddedData.slice(i, i + 7);
    // Pad last column to 7 if needed
    while (col.length < 7) col.push(null);
    weeks.push(col);
  }
  const totalDays = data.filter((d) => d.count > 0).length;

  // Month labels per week column: show abbrev only at the first column of each new month
  const monthLabels: string[] = weeks.map((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return "";
    const dt = new Date(firstDay.date + "T00:00:00");
    const monthAbbrev = new Intl.DateTimeFormat("en", { month: "short" }).format(dt);
    if (wi === 0) return monthAbbrev;
    const prevWeek = weeks[wi - 1];
    const prevFirst = prevWeek.find((d) => d !== null);
    if (!prevFirst) return monthAbbrev;
    const prevMonth = new Date(prevFirst.date + "T00:00:00").getMonth();
    return dt.getMonth() !== prevMonth ? monthAbbrev : "";
  });

  // 月別棒グラフ最大値
  const maxMonthCount = Math.max(...monthData.map((m) => m.count), 1);

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">{t("chart.activity")}</h4>
        {/* iOS-style segment control (#59) */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("heatmap")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "heatmap"
                ? "bg-zinc-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("chart.days84")}
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "monthly"
                ? "bg-zinc-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("chart.monthly")}
          </button>
        </div>
      </div>

      {viewMode === "heatmap" ? (
        <>
          <div className="flex flex-col gap-0.5">
            {/* Month label row */}
            <div className="flex gap-1 ml-5 mb-0.5">
              {monthLabels.map((label, wi) => (
                <div key={wi} className="w-3 overflow-visible flex-shrink-0">
                  <span className="text-xs text-gray-500 whitespace-nowrap leading-none">{label}</span>
                </div>
              ))}
            </div>
            {/* Weekday labels + grid */}
            <div className="flex gap-1">
              {/* 曜日ラベル */}
              <div className="flex flex-col gap-0.5 mr-1">
                {dayLabels.map((d, i) => (
                  <div key={i} className="text-xs text-gray-500 h-3 flex items-center">
                    {d}
                  </div>
                ))}
              </div>
              {/* ヒートマップグリッド */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) =>
                    day ? (
                      <div key={di} className="relative group w-3 h-3">
                        <div className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors cursor-default`} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-800 border border-white/10 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(day.date + "T00:00:00"))}: {day.count} {day.count === 1 ? "session" : "sessions"}
                        </div>
                      </div>
                    ) : (
                      <div key={di} className="w-3 h-3" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{t("chart.less")}</span>
              <div className="w-3 h-3 rounded-sm bg-zinc-900/50" />
              <div className="w-3 h-3 rounded-sm bg-green-700/60" />
              <div className="w-3 h-3 rounded-sm bg-green-500/80" />
              <div className="w-3 h-3 rounded-sm bg-green-400" />
              <span>{t("chart.more")}</span>
            </div>
            <span className="text-xs text-gray-500">{t("chart.past84Days", { n: totalDays })}</span>
          </div>
        </>
      ) : (
        /* 月別棒グラフ */
        <>
          <div className="flex items-end gap-1.5 h-24 mb-1">
            {monthData.map((m) => {
              const heightPct = maxMonthCount > 0 ? (m.count / maxMonthCount) * 100 : 0;
              return (
                <div key={m.ym} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="text-xs text-gray-500 mb-0.5">
                    {m.count > 0 ? m.count : ""}
                  </div>
                  <div
                    className="w-full rounded-t-sm bg-green-600/80 hover:bg-green-500 transition-colors"
                    style={{ height: `${Math.max(heightPct, m.count > 0 ? 4 : 0)}%` }}
                    title={`${m.ym}: ${t("chart.sessionsFmt", { n: m.count })} / ${
                      m.minutes >= 60
                        ? `${Math.floor(m.minutes / 60)}h${m.minutes % 60 > 0 ? `${m.minutes % 60}m` : ""}`
                        : `${m.minutes}m`
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {monthData.map((m) => (
              <div key={m.ym} className="flex-1 text-center text-xs text-gray-500">
                {m.label}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 text-right mt-1">
            {t("chart.past6Months")}: {t("chart.sessionsFmt", { n: monthData.reduce((s, m) => s + m.count, 0) })}
          </div>
        </>
      )}
    </div>
  );
}
