"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
};

type LogEntry = { date: string; type: string };

// ローカル日付文字列ヘルパー
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  gi:          { label: "道衣", color: "bg-blue-500/20 text-blue-300" },
  nogi:        { label: "ノーギ", color: "bg-orange-500/20 text-orange-300" },
  drilling:    { label: "ドリル", color: "bg-purple-500/20 text-purple-300" },
  competition: { label: "試合", color: "bg-red-500/20 text-red-300" },
  open_mat:    { label: "オープン", color: "bg-green-500/20 text-green-300" },
};

export default function WeeklyStrip({ userId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevWeekCount, setPrevWeekCount] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const { data } = await supabase
        .from("training_logs")
        .select("date, type")
        .eq("user_id", userId)
        .gte("date", toLocalDateStr(prevMonday))
        .lte("date", toLocalDateStr(sunday));

      if (data) {
        const mondayStr = toLocalDateStr(monday);
        const prevMondayStr = toLocalDateStr(prevMonday);
        setLogs(data.filter((l) => l.date >= mondayStr));
        const prevDates = new Set(data.filter((l) => l.date >= prevMondayStr && l.date < mondayStr).map((l) => l.date));
        setPrevWeekCount(prevDates.size);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);

  const trainedDates = new Set(logs.map((l) => l.date));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dateStr: toLocalDateStr(d),
      label: DAY_LABELS[i],
      isToday: toLocalDateStr(d) === toLocalDateStr(now),
      isPast: d <= now,
    };
  });

  const trainedThisWeek = weekDays.filter((d) => trainedDates.has(d.dateStr)).length;
  const totalPastDays = weekDays.filter((d) => d.isPast).length;

  // 今週のタイプ内訳集計
  const typeCounts: Record<string, number> = {};
  logs.forEach((l) => {
    typeCounts[l.type] = (typeCounts[l.type] ?? 0) + 1;
  });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-[#16213e] rounded-xl px-4 py-3 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-gray-400">今週の練習状況</h4>
        <span className="text-[10px] text-gray-600">
          {trainedThisWeek}/{totalPastDays}日{prevWeekCount !== null && ` / 先週${prevWeekCount}日`}
        </span>
      </div>
      <div className="flex gap-1.5 mb-3">
        {weekDays.map((day) => {
          const trained = trainedDates.has(day.dateStr);
          const isFuture = !day.isPast && !day.isToday;
          return (
            <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  trained
                    ? "bg-[#e94560] shadow-sm shadow-[#e94560]/30"
                    : day.isToday
                    ? "border-2 border-[#e94560]/50 bg-transparent"
                    : isFuture
                    ? "bg-gray-800/40"
                    : "bg-gray-700/50"
                }`}
              >
                {trained && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className={`text-[10px] leading-none ${
                  day.isToday ? "text-[#e94560] font-semibold" : trained ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* タイプ内訳ピル */}
      {typeEntries.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-700/50">
          {typeEntries.map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] ?? { label: type, color: "bg-gray-500/20 text-gray-300" };
            return (
              <span key={type} className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.color}`}>
                {cfg.label} {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
