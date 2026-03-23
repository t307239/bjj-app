"use client";

import { useState, useEffect } from "react";
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
};

// ローカル日付文字列ヘルパー（UTC変換しない）
function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 過去84日（12週）のヒートマップ + 月別棒グラフ
export default function TrainingChart({ userId }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<DayData[]>([]);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"heatmap" | "monthly">("heatmap");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
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
          const label = new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
          const info = mCounts[ym] || { count: 0, minutes: 0 };
          months.push({ ym, label, count: info.count, minutes: info.minutes });
        }
        setMonthData(months);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;
  if (data.every((d) => d.count === 0)) return null;

  const getColor = (count: number) => {
    if (count === 0) return "bg-zinc-900/50";
    if (count === 1) return "bg-green-700/60";
    if (count === 2) return "bg-green-500/80";
    return "bg-green-400";
  };

  // 12週分（7日×12列）
  const weeks: DayData[][] = [];
  for (let i = 0; i < 12; i++) {
    weeks.push(data.slice(i * 7, i * 7 + 7));
  }

  // Fixed English day abbreviations (Sun=0 ... Sat=6) — never translate via locale
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // 2024-01-07 is Sun
    return new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(d);
  });
  const totalDays = data.filter((d) => d.count > 0).length;

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
            className={`text-[11px] px-3 py-1 rounded-md transition-all ${
              viewMode === "heatmap"
                ? "bg-zinc-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t("chart.days84")}
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`text-[11px] px-3 py-1 rounded-md transition-all ${
              viewMode === "monthly"
                ? "bg-zinc-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t("chart.monthly")}
          </button>
        </div>
      </div>

      {viewMode === "heatmap" ? (
        <>
          <div className="flex gap-1">
            {/* 曜日ラベル */}
            <div className="flex flex-col gap-0.5 mr-1">
              {dayLabels.map((d, i) => (
                <div key={i} className="text-[9px] text-gray-600 h-3 flex items-center">
                  {d}
                </div>
              ))}
            </div>
            {/* ヒートマップグリッド */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
                    title={`${day.date}: ${t("chart.sessionsFmt", { n: day.count })}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-600">
              <span>{t("chart.less")}</span>
              <div className="w-3 h-3 rounded-sm bg-zinc-900/50" />
              <div className="w-3 h-3 rounded-sm bg-green-700/60" />
              <div className="w-3 h-3 rounded-sm bg-green-500/80" />
              <div className="w-3 h-3 rounded-sm bg-green-400" />
              <span>{t("chart.more")}</span>
            </div>
            <span className="text-[10px] text-gray-500">{t("chart.past84Days", { n: totalDays })}</span>
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
                  <div className="text-[9px] text-gray-500 mb-0.5">
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
              <div key={m.ym} className="flex-1 text-center text-[9px] text-gray-500">
                {m.label}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 text-right mt-1">
            {t("chart.past6Months")}: {t("chart.sessionsFmt", { n: monthData.reduce((s, m) => s + m.count, 0) })}
          </div>
        </>
      )}
    </div>
  );
}
