"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type MonthData = {
  month: string;
  label: string;
  count: number;
  minutes: number;
};

type LogEntry = {
  date: string;
  type: string;
  duration_min: number;
};

type Props = {
  userId: string;
};

const TYPE_LABELS: Record<string, string> = {
  gi: "道衣",
  nogi: "ノーギ",
  drilling: "ドリル",
  competition: "試合",
  open_mat: "オープンマット",
};

const TYPE_COLORS: Record<string, string> = {
  gi: "bg-blue-500/70",
  nogi: "bg-orange-500/70",
  drilling: "bg-purple-500/70",
  competition: "bg-red-500/70",
  open_mat: "bg-green-500/70",
};

export default function TrainingBarChart({ userId }: Props) {
  const [data6, setData6] = useState<MonthData[]>([]);
  const [data12, setData12] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"count" | "minutes">("count");
  const [range, setRange] = useState<6 | 12>(6);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<LogEntry[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: logs } = await supabase
        .from("training_logs")
        .select("date, duration_min")
        .eq("user_id", userId)
        .gte("date", sinceStr);

      if (logs) {
        const buildBuckets = (months: number): MonthData[] => {
          const buckets: Record<string, { count: number; minutes: number }> = {};
          for (let i = months - 1; i >= 0; i--) {
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
          return Object.entries(buckets).map(([month, val]) => {
            const m = month.split("-")[1];
            return { month, label: `${parseInt(m)}月`, ...val };
          });
        };

        setData6(buildBuckets(6));
        setData12(buildBuckets(12));
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedLogs([]);
      return;
    }
    const fetchMonth = async () => {
      setSelectedLoading(true);
      const from = `${selectedMonth}-01`;
      const year = parseInt(selectedMonth.split("-")[0]);
      const month = parseInt(selectedMonth.split("-")[1]);
      const nextMonth = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const { data } = await supabase
        .from("training_logs")
        .select("date, type, duration_min")
        .eq("user_id", userId)
        .gte("date", from)
        .lt("date", nextMonth)
        .order("date", { ascending: false });

      setSelectedLogs(data ?? []);
      setSelectedLoading(false);
    };
    fetchMonth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, userId]);

  if (loading) return null;

  const data = range === 6 ? data6 : data12;

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

  const jstNow = new Date(Date.now() + 9 * 3600000);
  const currentMonthKey = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;

  const activeBars = data.filter((d) => (view === "count" ? d.count : d.minutes) > 0);
  const avgVal = activeBars.length > 0
    ? activeBars.reduce((s, d) => s + (view === "count" ? d.count : d.minutes), 0) / activeBars.length
    : 0;
  const avgPct = maxVal > 0 ? (avgVal / maxVal) * 100 : 0;

  const selectedMonthLabel = selectedMonth
    ? (() => {
        const [y, m] = selectedMonth.split("-");
        return `${y}年${parseInt(m)}月`;
      })()
    : null;

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-300">月別練習グラフ</h4>
          <p className="text-[10px] text-gray-600 mt-0.5">
            過去{range}ヶ月: 計{totalCount}回 · {formatMinutes(totalMinutes)}
          </p>
        </div>
        <div className="flex gap-1">
          <div className="flex rounded-lg overflow-hidden border border-gray-700 mr-1">
            <button
              onClick={() => setRange(6)}
              className={`text-[11px] px-2 py-1 transition-colors ${range === 6 ? "bg-[#e94560] text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              6月
            </button>
            <button
              onClick={() => setRange(12)}
              className={`text-[11px] px-2 py-1 transition-colors ${range === 12 ? "bg-[#e94560] text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              12月
            </button>
          </div>
          <button
            onClick={() => setView("count")}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              view === "count"
                ? "bg-[#e94560] text-white"
                : "bg-gray-700/50 text-gray-400 hover:text-white"
            }`}
          >
            回数
          </button>
          <button
            onClick={() => setView("minutes")}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              view === "minutes"
                ? "bg-[#e94560] text-white"
                : "bg-gray-700/50 text-gray-400 hover:text-white"
            }`}
          >
            時間
          </button>
        </div>
      </div>

      <div className="relative" style={{ height: "120px" }}>
        {avgPct > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-gray-500/50 pointer-events-none"
            style={{ bottom: `${avgPct}%` }}
            title={`平均: ${view === "count" ? `${Math.round(avgVal)}回` : formatMinutes(Math.round(avgVal))}`}
          />
        )}
        <div className="flex items-end gap-1 h-full">
          {data.map((d) => {
            const val = view === "count" ? d.count : d.minutes;
            const pct = val > 0 ? Math.max((val / maxVal) * 100, 5) : 0;
            const label = view === "count" ? `${val}回` : formatMinutes(val);
            const isCurrentMonth = d.month === currentMonthKey;
            const isSelected = d.month === selectedMonth;

            return (
              <div
                key={d.month}
                className={`flex-1 flex flex-col items-center justify-end gap-1 h-full cursor-pointer group`}
                onClick={() => setSelectedMonth(isSelected ? null : d.month)}
                title={d.count > 0 ? `${d.label}: クリックして詳細を表示` : undefined}
              >
                <span
                  className={`leading-none transition-opacity ${range === 12 ? "text-[8px]" : "text-[9px]"} ${
                    val > 0 && (range === 6 || isCurrentMonth) ? "opacity-100" : "opacity-0"
                  } ${isCurrentMonth ? "text-[#e94560]" : "text-gray-500"}`}
                >
                  {label}
                </span>
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isSelected
                      ? "bg-yellow-400"
                      : isCurrentMonth
                      ? "bg-[#e94560]"
                      : val > 0
                      ? "bg-[#e94560]/50 group-hover:bg-[#e94560]/70"
                      : "bg-gray-800"
                  }`}
                  style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0px" }}
                />
                <span
                  className={`leading-none ${range === 12 ? "text-[8px]" : "text-[10px]"} ${
                    isSelected
                      ? "text-yellow-400 font-semibold"
                      : isCurrentMonth
                      ? "text-white font-semibold"
                      : "text-gray-500"
                  }`}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {avgPct > 0 && (
        <div className="text-[10px] text-gray-600 text-right mt-1">
          平均 {view === "count" ? `${Math.round(avgVal)}回/月` : `${formatMinutes(Math.round(avgVal))}/月`}
        </div>
      )}

      {/* 月別ドリルダウン詳細パネル */}
      {selectedMonth && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-400">
              📅 {selectedMonthLabel}の練習記録
            </span>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              ✕ 閉じる
            </button>
          </div>
          {selectedLoading ? (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-700/50 rounded flex-1 animate-pulse" />
              ))}
            </div>
          ) : selectedLogs.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-2">記録なし</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedLogs.map((log, idx) => {
                const typeLabel = TYPE_LABELS[log.type] ?? log.type;
                const typeColor = TYPE_COLORS[log.type] ?? "bg-gray-500/70";
                return (
                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                    <span className="text-gray-500 w-16 flex-shrink-0">{log.date.substring(5).replace("-", "/")}</span>
                    <span className={`${typeColor} text-white px-1.5 py-0.5 rounded text-[10px] flex-shrink-0`}>
                      {typeLabel}
                    </span>
                    <span className="text-gray-400">
                      {log.duration_min > 0 ? formatMinutes(log.duration_min) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedLogs.length > 0 && (
            <div className="mt-2 pt-1 border-t border-gray-700/30 flex gap-4 text-[10px] text-gray-500">
              <span>{selectedLogs.length}回</span>
              <span>合計 {formatMinutes(selectedLogs.reduce((s, l) => s + (l.duration_min || 0), 0))}</span>
              <span>平均 {selectedLogs.length > 0 ? formatMinutes(Math.round(selectedLogs.reduce((s, l) => s + (l.duration_min || 0), 0) / selectedLogs.length)) : "-"}/回</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
