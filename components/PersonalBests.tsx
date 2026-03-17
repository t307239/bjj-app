"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string };

type Bests = {
  totalSessions: number;
  totalMinutes: number;
  maxSessionMin: number;
  longestStreak: number;
  bestMonthCount: number;
  bestMonthLabel: string;
  avgSessionMin: number;
  avgMonthly: number;
};

function fmtTime(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export default function PersonalBests({ userId }: Props) {
  const [bests, setBests] = useState<Bests | null>(null);
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

      const monthCounts: Record<string, number> = {};
      logs.forEach((l: { date: string }) => {
        const ym = l.date.slice(0, 7);
        monthCounts[ym] = (monthCounts[ym] ?? 0) + 1;
      });
      const bestMonthCount = Object.values(monthCounts).length > 0
        ? Math.max(...Object.values(monthCounts))
        : totalSessions;
      const bestMonthKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const bestMonthLabel = bestMonthKey
        ? bestMonthKey.slice(0, 4) + "年" + String(parseInt(bestMonthKey.slice(5, 7))) + "月"
        : "";

      const avgSessionMin = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
      const monthKeys = Object.keys(monthCounts);
      const avgMonthly = monthKeys.length > 0
        ? Math.round(totalSessions / monthKeys.length)
        : totalSessions;

      setBests({ totalSessions, totalMinutes, maxSessionMin, longestStreak: maxStreak, bestMonthCount, bestMonthLabel, avgSessionMin, avgMonthly });
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!bests) return null;

  const items = [
    { icon: "🏋️", label: "総練習回数", value: `${bests.totalSessions}回` },
    { icon: "⏱️", label: "総練習時間", value: fmtTime(bests.totalMinutes) },
    { icon: "🔥", label: "最長連続日", value: `${bests.longestStreak}日` },
    { icon: "📅", label: "月間最多", value: `${bests.bestMonthCount}回`, sub: bests.bestMonthLabel },
    { icon: "⌛", label: "平均時間/回", value: fmtTime(bests.avgSessionMin) },
    { icon: "📈", label: "月平均", value: `${bests.avgMonthly}回` },
  ];

  const buildShareText = () => {
    const lines = [
      `🥋 BJJ練習記録`,
      `📊 総練習回数: ${bests.totalSessions}回`,
      `⏱️ 総練習時間: ${fmtTime(bests.totalMinutes)}`,
      `🔥 最長連続日: ${bests.longestStreak}日`,
      `📅 月間最多: ${bests.bestMonthCount}回`,
      ``,
      `#BJJ #柔術 #BJJApp`,
    ];
    return lines.join("\n");
  };

  const handleShare = () => {
    const text = buildShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">📊 累計記録</h4>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded-lg transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          シェア
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="bg-gray-800/40 rounded-xl p-3 text-center">
            <div className="text-lg mb-0.5">{item.icon}</div>
            <div className="text-base font-bold text-white">{item.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{item.label}</div>
            {"sub" in item && (item as {sub?: string}).sub && (
              <div className="text-[9px] text-green-500/70 mt-0.5">⭐ {(item as {sub?: string}).sub}</div>
            )}
          </div>
        ))}
      </div>
      {bests.maxSessionMin > 0 && (
        <div className="mt-2 text-center text-[10px] text-gray-600">
          最長セッション: {fmtTime(bests.maxSessionMin)} · 最多月: {bests.bestMonthCount}回
        </div>
      )}
    </div>
  );
}
