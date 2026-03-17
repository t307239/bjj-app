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

      setBests({ totalSessions, totalMinutes, maxSessionMin, longestStreak: maxStreak, bestMonthCount });
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!bests) return null;

  const items = [
    { icon: "🏋️", label: "総練習回数", value: `${bests.totalSessions}回` },
    { icon: "⏱️", label: "総練習時間", value: fmtTime(bests.totalMinutes) },
    { icon: "🔥", label: "最長連続日", value: `${bests.longestStreak}日` },
    { icon: "📅", label: "月間最多", value: `${bests.bestMonthCount}回` },
  ];

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <h4 className="text-sm font-medium text-gray-300 mb-3">📊 累計記録</h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="bg-gray-800/40 rounded-xl p-3 text-center">
            <div className="text-lg mb-0.5">{item.icon}</div>
            <div className="text-base font-bold text-white">{item.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
      {bests.maxSessionMin > 0 && (
        <div className="mt-2 text-center text-[10px] text-gray-600">
          最長セッション: {fmtTime(bests.maxSessionMin)}
        </div>
      )}
    </div>
  );
}
