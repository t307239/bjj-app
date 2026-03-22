"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string };

type Bests = {
  totalSessions: number;
  totalMinutes: number;
  maxSessionMin: number;
  longestStreak: number;
  bestMonthCount: number;
  bestMonthKey: string;
  bestWeekCount: number;
  avgSessionMin: number;
  avgMonthly: number;
  thisMonthCount: number;
  lastMonthCount: number;
  dowCounts: number[]; // [月, 火, 水, 木, 金, 土, 日]
  monthlyIntensity: { ym: string; avgSessionMin: number }[]; // Last 6 months
};

function fmtTime(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function IntensitySparkline({ data }: { data: { ym: string; avgSessionMin: number }[] }) {
  if (data.length === 0) return null;

  // Find max for scaling
  const maxIntensity = Math.max(...data.map((d) => d.avgSessionMin), 90);
  const minIntensity = Math.min(...data.map((d) => d.avgSessionMin), 30);

  // SVG dimensions
  const width = 96;
  const height = 20;
  const padding = 2;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Points for polyline
  const points = data
    .map((d, i) => {
      const x = padding + (i / Math.max(1, data.length - 1)) * graphWidth;
      const ratio = (d.avgSessionMin - minIntensity) / Math.max(1, maxIntensity - minIntensity);
      const y = padding + graphHeight - ratio * graphHeight;
      return `${x},${y}`;
    })
    .join(" ");

  // Current month is last
  const currentMonth = data[data.length - 1];

  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-5 flex-shrink-0">
        {/* Grid line at middle */}
        <line x1={padding} y1={padding + graphHeight / 2} x2={width - padding} y2={padding + graphHeight / 2} stroke="#4b5563" strokeWidth="0.5" opacity="0.3" />
        {/* Sparkline */}
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Current month dot */}
        {data.length > 0 && (
          <circle cx={width - padding} cy={padding + graphHeight - ((currentMonth.avgSessionMin - minIntensity) / Math.max(1, maxIntensity - minIntensity)) * graphHeight} r="1.5" fill="#3b82f6" />
        )}
      </svg>
      <span className="text-[10px] text-gray-500 flex-shrink-0">{fmtTime(currentMonth.avgSessionMin)}</span>
    </div>
  );
}

export default function PersonalBests({ userId }: Props) {
  const { t } = useLocale();
  const [bests, setBests] = useState<Bests | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: logs } = await supabase
        .from("training_logs")
        .select("date, duration_min")
        .eq("user_id", userId)
        .order("date", { ascending: true });

      if (!logs || logs.length === 0) return;

      const totalSessions = logs.length;
      const totalMinutes = logs.reduce((s, l) => s + (l.duration_min ?? 0), 0);
      const maxSessionMin = Math.max(...logs.map((l) => l.duration_min ?? 0));

      // 最長連続日数
      const uniqueDates = [...new Set(logs.map((l: { date: string }) => l.date))].sort();
      let maxStreak = uniqueDates.length > 0 ? 1 : 0;
      let curStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1] as string);
        const curr = new Date(uniqueDates[i] as string);
        const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diff === 1) {
          curStreak++;
          if (curStreak > maxStreak) maxStreak = curStreak;
        } else {
          curStreak = 1;
        }
      }

      // 月間最多
      const monthCounts: Record<string, number> = {};
      logs.forEach((l: { date: string }) => {
        const ym = l.date.slice(0, 7);
        monthCounts[ym] = (monthCounts[ym] ?? 0) + 1;
      });
      const bestMonthCount = Object.values(monthCounts).length > 0
        ? Math.max(...Object.values(monthCounts))
        : totalSessions;
      const bestMonthKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      // 週間最多（月曜日起点）
      const weekCounts: Record<string, number> = {};
      logs.forEach((l: { date: string }) => {
        const d = new Date(l.date + "T00:00:00Z"); // UTC parsing avoids DST issues
        const dow = d.getUTCDay();
        const daysToMon = dow === 0 ? 6 : dow - 1;
        const monMs = d.getTime() - daysToMon * 86400000;
        const mon = new Date(monMs);
        const weekKey = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, "0")}-${String(mon.getUTCDate()).padStart(2, "0")}`;
        weekCounts[weekKey] = (weekCounts[weekKey] ?? 0) + 1;
      });
      const bestWeekCount = Object.values(weekCounts).length > 0
        ? Math.max(...Object.values(weekCounts))
        : 0;

      const avgSessionMin = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
      const monthKeys = Object.keys(monthCounts);
      const avgMonthly = monthKeys.length > 0
        ? Math.round(totalSessions / monthKeys.length)
        : totalSessions;

      // 曜日別練習頻度（月=0, 火=1, 水=2, 木=3, 金=4, 土=5, 日=6）
      const dowArr = [0, 0, 0, 0, 0, 0, 0];
      logs.forEach((l: { date: string }) => {
        const d = new Date(l.date + "T00:00:00");
        const dow = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
        const idx = dow === 0 ? 6 : dow - 1; // Mon=0 ... Sun=6
        dowArr[idx]++;
      });

      // 今月vs先月
      const jstNow = new Date(Date.now() + 9 * 3600000);
      const thisYM = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
      const lastDate = new Date(jstNow);
      lastDate.setUTCMonth(lastDate.getUTCMonth() - 1);
      const lastYM = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const thisMonthCount = monthCounts[thisYM] ?? 0;
      const lastMonthCount = monthCounts[lastYM] ?? 0;

      // 過去6ヶ月の月別intensity（平均時間/回）
      const monthlyIntensity: { ym: string; avgSessionMin: number }[] = [];
      const sortedMonths = Object.keys(monthCounts).sort();
      const last6Months = sortedMonths.slice(Math.max(0, sortedMonths.length - 6));
      last6Months.forEach((ym) => {
        const monthLogs = logs.filter((l: { date: string }) => l.date.startsWith(ym));
        const monthMins = monthLogs.reduce((s: number, l: { duration_min: number }) => s + (l.duration_min ?? 0), 0);
        const avgMin = monthLogs.length > 0 ? Math.round(monthMins / monthLogs.length) : 0;
        monthlyIntensity.push({ ym, avgSessionMin: avgMin });
      });

      setBests({ totalSessions, totalMinutes, maxSessionMin, longestStreak: maxStreak, bestMonthCount, bestMonthKey, bestWeekCount, avgSessionMin, avgMonthly, thisMonthCount, lastMonthCount, dowCounts: dowArr, monthlyIntensity });
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!bests) return null;

  const bestMonthLabel = bests.bestMonthKey
    ? (() => {
        const [y, m] = bests.bestMonthKey.split("-");
        return `${y}年${parseInt(m)}月`;
      })()
    : "";

  const items = [
    { icon: "🏋️", label: t("stats.totalSessions"), value: `${bests.totalSessions}回`, sub: "" },
    { icon: "⏱️", label: t("stats.totalMinutes"), value: fmtTime(bests.totalMinutes), sub: "" },
    { icon: "🔥", label: t("stats.longestStreak"), value: `${bests.longestStreak}日`, sub: "" },
    { icon: "📅", label: t("stats.bestMonth"), value: `${bests.bestMonthCount}回`, sub: bestMonthLabel },
    { icon: "⌛", label: t("stats.avgPerSession"), value: fmtTime(bests.avgSessionMin), sub: "" },
    { icon: "📈", label: t("stats.monthlyAvg"), value: `${bests.avgMonthly}回`, sub: "" },
    { icon: "🗓️", label: t("stats.bestWeek"), value: `${bests.bestWeekCount}回`, sub: "" },
  ];

  // Xシェア用テキスト生成
  const buildShareText = () => {
    const lines = [
      `🥋 ${t("stats.BJJRecordTitle")}`,
      `📊 ${t("stats.totalSessions")}: ${bests.totalSessions}回`,
      `⏱️ ${t("stats.totalMinutes")}: ${fmtTime(bests.totalMinutes)}`,
      `🔥 ${t("stats.longestStreak")}: ${bests.longestStreak}日`,
      `📅 ${t("stats.bestMonth")}: ${bests.bestMonthCount}回`,
      ``,
      `#BJJ #${t("stats.BJJHashtag")} #BJJApp`,
    ];
    return lines.join("\n");
  };

  const handleShare = () => {
    const text = buildShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mb-4">
      {/* アコーディオンヘッダー */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-900 hover:bg-white/5 rounded-xl px-4 py-3 border border-white/10 transition-colors active:scale-95 transform"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">📊 {t("stats.personalBests")}</span>
          {!isOpen && (
            <span className="text-xs text-gray-500 font-normal">
              {bests.totalSessions}回 · {bests.longestStreak}{t("stats.dayStreak")}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展開コンテンツ */}
      {isOpen && (
      <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-300">📊 {t("stats.personalBests")}</h4>
          {bests.lastMonthCount > 0 && (() => {
            const diff = bests.thisMonthCount - bests.lastMonthCount;
            const pct = Math.round(Math.abs(diff) / bests.lastMonthCount * 100);
            if (diff > 0) return (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-300 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded-full mt-0.5">
                ▲ +{diff}回 · +{pct}% {t("stats.lastMonthCompare")}
              </span>
            );
            if (diff < 0) return (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-300 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full mt-0.5">
                ▼ {diff}回 · -{pct}% {t("stats.lastMonthCompare")}
              </span>
            );
            return <span className="text-[10px] text-gray-500 mt-0.5">= {t("stats.samePaceLast")}</span>;
          })()}
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/10 px-2.5 py-1 rounded-lg transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {t("stats.share")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl p-3 text-center ${
              item.sub ? "bg-yellow-500/10 border border-yellow-500/25" : "bg-white/5"
            }`}
          >
            <div className="text-lg mb-0.5">{item.icon}</div>
            <div className="text-base font-bold text-white">{item.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{item.label}</div>
            {item.sub && (
              <div className="text-[9px] text-yellow-400/80 mt-0.5 leading-none">⭐ {item.sub}</div>
            )}
          </div>
        ))}
      </div>
      {bests.maxSessionMin > 0 && (
        <div className="mt-2 text-center text-[10px] text-gray-600">
          {t("stats.longestSession")}: {fmtTime(bests.maxSessionMin)} · {t("stats.monthlyAvg")}: {bests.avgMonthly}回
        </div>
      )}
      {/* 曜日別練習頻度ミニグラフ */}
      {bests.totalSessions >= 5 && (() => {
        const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
        const maxDow = Math.max(...bests.dowCounts, 1);
        const bestDowIdx = bests.dowCounts.indexOf(Math.max(...bests.dowCounts));
        return (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-end justify-between gap-1 h-10">
              {bests.dowCounts.map((count, i) => {
                const pct = count / maxDow;
                const isBest = i === bestDowIdx && count > 0;
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max(pct * 32, count > 0 ? 4 : 1)}px`,
                        background: isBest ? "#e94560" : count > 0 ? "#374151" : "#1f2937",
                      }}
                    />
                    <span className={`text-[9px] leading-none ${isBest ? "text-[#e94560] font-bold" : "text-gray-600"}`}>
                      {DOW_LABELS[i]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-gray-600 text-center mt-1">
              {t("stats.bestDayLabel")}: <span className="text-[#e94560] font-medium">{DOW_LABELS[bestDowIdx]}{t("stats.dayOfWeek")}</span>（{bests.dowCounts[bestDowIdx]}回）
            </p>
          </div>
        );
      })()}
      {/* 6ヶ月の月別強度推移 */}
      {bests.monthlyIntensity.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-[10px] text-gray-400 mb-2">📈 {t("stats.last6MonthsAvg")}</p>
          <IntensitySparkline data={bests.monthlyIntensity} />
        </div>
      )}
      </div>
      )}
    </div>
  );
}
