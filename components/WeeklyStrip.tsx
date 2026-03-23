"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

type Props = {
  userId: string;
};

// ローカル日付文字列ヘルパー
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMins(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyStrip({ userId }: Props) {
  const { t } = useLocale();
  const [trainedDates, setTrainedDates] = useState<Set<string>>(new Set());
  const [weekTotalMins, setWeekTotalMins] = useState(0);
  const [lastWeekCount, setLastWeekCount] = useState<number | null>(null);
  const [lastWeekMins, setLastWeekMins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // 今週月曜日〜日曜日の日付を計算
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      // 先週月曜〜日曜
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      const lastSunday = new Date(monday);
      lastSunday.setDate(monday.getDate() - 1);

      const mondayStr = toLocalDateStr(monday);
      const sundayStr = toLocalDateStr(sunday);
      const lastMondayStr = toLocalDateStr(lastMonday);
      const lastSundayStr = toLocalDateStr(lastSunday);

      const [{ data: logs }, { data: lastWeekLogs }] = await Promise.all([
        supabase
          .from("training_logs")
          .select("date, duration_min")
          .eq("user_id", userId)
          .gte("date", mondayStr)
          .lte("date", sundayStr),
        supabase
          .from("training_logs")
          .select("date, duration_min")
          .eq("user_id", userId)
          .gte("date", lastMondayStr)
          .lte("date", lastSundayStr),
      ]);

      if (logs) {
        setTrainedDates(new Set(logs.map((l: { date: string; duration_min: number }) => l.date)));
        setWeekTotalMins(logs.reduce((sum: number, l: { date: string; duration_min: number }) => sum + (l.duration_min ?? 0), 0));
      }
      if (lastWeekLogs) {
        setLastWeekCount(lastWeekLogs.length);
        setLastWeekMins(lastWeekLogs.reduce((sum: number, l: { date: string; duration_min: number }) => sum + (l.duration_min ?? 0), 0));
      } else {
        setLastWeekCount(0);
        setLastWeekMins(0);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;

  // 今週の月〜日の日付を生成
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
    <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 mb-4 shadow-lg shadow-black/40">
      <div className="flex items-center justify-end mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">
            {trainedThisWeek}/{totalPastDays}d
          </span>
          {weekTotalMins > 0 && (
            <span className="text-[10px] text-gray-500">· {fmtMins(weekTotalMins)}</span>
          )}
          {lastWeekCount !== null && lastWeekCount > 0 && (
            <span className={`text-[10px] font-medium ${
              trainedThisWeek > lastWeekCount
                ? "text-green-400"
                : trainedThisWeek < lastWeekCount
                ? "text-red-400"
                : "text-gray-500"
            }`}>
              {trainedThisWeek > lastWeekCount
                ? `▲${trainedThisWeek - lastWeekCount}`
                : trainedThisWeek < lastWeekCount
                ? `▼${lastWeekCount - trainedThisWeek}`
                : t("weeklyStrip.same")} {t("weeklyStrip.vsLastWeek")}
            </span>
          )}
          {lastWeekMins !== null && lastWeekMins > 0 && weekTotalMins > 0 && (
            <span className={`text-[10px] font-medium ${
              weekTotalMins > lastWeekMins
                ? "text-green-400"
                : weekTotalMins < lastWeekMins
                ? "text-red-400"
                : "text-gray-500"
            }`}>
              {weekTotalMins > lastWeekMins
                ? `▲${fmtMins(weekTotalMins - lastWeekMins)}`
                : weekTotalMins < lastWeekMins
                ? `▼${fmtMins(lastWeekMins - weekTotalMins)}`
                : t("weeklyStrip.same")}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        {weekDays.map((day) => {
          const trained = trainedDates.has(day.dateStr);
          const isFuture = !day.isPast && !day.isToday;
          return (
            <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
              {/* ドット */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  trained
                    ? "bg-[#10B981] shadow-sm shadow-[#10B981]/30"
                    : day.isToday
                    ? "border-2 border-[#10B981]/50 bg-transparent"
                    : isFuture
                    ? "bg-white/5"
                    : "bg-white/10"
                }`}
              >
                {trained && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginTop: "1px", marginLeft: "-1px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {/* 曜日ラベル */}
              <span
                className={`text-[10px] leading-none ${
                  day.isToday
                    ? "text-[#10B981] font-semibold"
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
