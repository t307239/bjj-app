"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
};

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export default function WeeklyStrip({ userId }: Props) {
  const [trainedDates, setTrainedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const mondayStr = toLocalDateStr(monday);
      const sundayStr = toLocalDateStr(sunday);

      const { data: logs } = await supabase
        .from("training_logs")
        .select("date")
        .eq("user_id", userId)
        .gte("date", mondayStr)
        .lte("date", sundayStr);

      if (logs) {
        setTrainedDates(new Set(logs.map((l: { date: string }) => l.date)));
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

  return (
    <div className="bg-[#16213e] rounded-xl px-4 py-3 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-gray-400">今週の練習状況</h4>
        <span className="text-[10px] text-gray-600">
          {trainedThisWeek}/{totalPastDays}日
        </span>
      </div>
      <div className="flex gap-1.5">
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
                  day.isToday
                    ? "text-[#e94560] font-semibold"
                    : trained
                    ? "text-gray-300"
                    : "text-gray-600"
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
