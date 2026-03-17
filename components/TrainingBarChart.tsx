"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type MonthData = {
  month: string;
  label: string;
  count: number;
  minutes: number;
};

type Props = {
  userId: string;
};

export default function TrainingBarChart({ userId }: Props) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"count" | "minutes">("count");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: logs } = await supabase
        .from("training_logs")
        .select("date, duration_min")
        .eq("user_id", userId)
        .gte("date", sinceStr);

      if (logs) {
        const buckets: Record<string, { count: number; minutes: number }> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          buckets[key] = { count: 0, minutes: 0 };
        }

        logs.forEach((l: { date: string; duration_min: number }) => {
          const key = l.date.substring(0, 7);
          if (buckets[key]) {
            buckets[key].count++;
            buckets[key].minutes += l.duration_min || 0;
          }
        });

        const result: MonthData[] = Object.entries(buckets).map(([month, val]) => {
          const m = month.split("-")[1];
          return { month, label: `${parseInt(m)}月`, ...val };
        });
        setData(result);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;
  if (data.every((d) => d.count === 0)) return null;

  const maxVal = Math.max(...data.map((d) => (view === "count" ? d.count : d.minutes)), 1);

  const formatMinutes = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-300">月別練習グラフ</h4>
          <p className="text-[10px] text-gray-600 mt-0.5">
            過去6ヶ月: 計{totalCount}回 · {formatMinutes(totalMinutes)}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("count")}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              view === "count" ? "bg-[#e94560] text-white" : "bg-gray-700/50 text-gray-400 hover:text-white"
            }`}
          >
            回数
          </button>
          <button
            onClick={() => setView("minutes")}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              view === "minutes" ? "bg-[#e94560] text-white" : "bg-gray-700/50 text-gray-400 hover:text-white"
            }`}
          >
            時間
          </button>
        </div>
      </div>

      <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
        {data.map((d) => {
          const val = view === "count" ? d.count : d.minutes;
          const pct = val > 0 ? Math.max((val / maxVal) * 100, 5) : 0;
          const label = view === "count" ? `${val}回` : formatMinutes(val);
          const isCurrentMonth = d.month === new Date().toISOString().substring(0, 7);

          return (
            <div key={d.month} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className={`text-[9px] leading-none transition-opacity ${val > 0 ? "opacity-100" : "opacity-0"} ${isCurrentMonth ? "text-[#e94560]" : "text-gray-500"}`}>
                {label}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  isCurrentMonth ? "bg-[#e94560]" : val > 0 ? "bg-[#e94560]/50" : "bg-gray-800"
                }`}
                style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0px" }}
              />
              <span className={`text-[10px] leading-none ${isCurrentMonth ? "text-white font-semibold" : "text-gray-500"}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
