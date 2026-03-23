"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getMonthStartDate } from "@/lib/timezone";

type TypeBreakdown = Record<string, number>;

type MonthData = {
  month: string;
  label: string;
  count: number;
  minutes: number;
  typeBreakdown: TypeBreakdown;
};

type LogEntry = {
  date: string;
  type: string;
  duration_min: number;
};

type Props = {
  userId: string;
  isPro?: boolean;
};

// Locale-aware month label from YYYY-MM string
function getMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
}

const TYPE_COLORS: Record<string, string> = {
  gi: "bg-blue-500/70",
  nogi: "bg-orange-500/70",
  drilling: "bg-purple-500/70",
  competition: "bg-red-500/70",
  open_mat: "bg-green-500/70",
};

// Inline style colors for stacked segments
const TYPE_HEX: Record<string, string> = {
  gi: "#3b82f6",
  nogi: "#f97316",
  drilling: "#a855f7",
  competition: "#e94560",
  open_mat: "#22c55e",
};

const TYPE_ORDER = ["gi", "nogi", "drilling", "competition", "open_mat"];

export default function TrainingBarChart({ userId, isPro = false }: Props) {
  const { t } = useLocale();
  const TYPE_LABELS: Record<string, string> = {
    gi: t("training.gi"),
    nogi: t("training.nogi"),
    drilling: t("training.drilling"),
    competition: t("training.competition"),
    open_mat: t("training.open_mat"),
  };
  const timesUnit = t("chart.timesUnit");
  const [data6, setData6] = useState<MonthData[]>([]);
  const [data12, setData12] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"count" | "minutes">("count");
  const [range, setRange] = useState<6 | 12>(6);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<LogEntry[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: logs } = await supabase
        .from("training_logs")
        .select("date, duration_min, type")
        .eq("user_id", userId)
        .gte("date", sinceStr);

      if (logs) {
        const buildBuckets = (months: number): MonthData[] => {
          const buckets: Record<string, { count: number; minutes: number; typeBreakdown: TypeBreakdown }> = {};
          for (let i = months - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            buckets[key] = { count: 0, minutes: 0, typeBreakdown: {} };
          }
          logs.forEach((l: { date: string; duration_min: number; type: string }) => {
            const key = l.date.substring(0, 7);
            if (buckets[key]) {
              buckets[key].count++;
              buckets[key].minutes += l.duration_min || 0;
              const t = l.type || "gi";
              buckets[key].typeBreakdown[t] = (buckets[key].typeBreakdown[t] ?? 0) + 1;
            }
          });
          return Object.entries(buckets).map(([month, val]) => {
            const m = month.split("-")[1];
            return { month, label: getMonthLabel(month), ...val };
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
    if (h === 0) return `${m}${t("chart.minutes")}`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);

  const currentMonthKey = getMonthStartDate().slice(0, 7);

  const activeBars = data.filter((d) => (view === "count" ? d.count : d.minutes) > 0);
  const avgVal = activeBars.length > 0
    ? activeBars.reduce((s, d) => s + (view === "count" ? d.count : d.minutes), 0) / activeBars.length
    : 0;
  const avgPct = maxVal > 0 ? (avgVal / maxVal) * 100 : 0;

  const selectedMonthLabel = selectedMonth
    ? (() => {
        const [y, m] = selectedMonth.split("-");
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }).format(d);
      })()
    : null;

  // Compute type legend for currently visible data (only types that appear)
  const allTypes = new Set<string>();
  data.forEach((d) => Object.keys(d.typeBreakdown).forEach((t) => allTypes.add(t)));
  const visibleTypes = TYPE_ORDER.filter((t) => allTypes.has(t));

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div>
          <h4 className="text-sm font-medium text-zinc-300">📊 {t("chart.monthlyGraph")}</h4>
          {!isOpen && totalCount > 0 && (
            <p className="text-[10px] text-gray-500 mt-0.5">{t("chart.totalLabel")}{totalCount}{timesUnit} · {formatMinutes(totalMinutes)}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (<div className="p-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-zinc-300">{t("chart.monthlyGraph")}</h4>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {t("chart.pastMonths", { n: range })}: {t("chart.totalLabel")}{totalCount}{timesUnit} · {formatMinutes(totalMinutes)}
          </p>
        </div>
        <div className="flex gap-1">
          <div className="flex bg-zinc-800 rounded-lg p-0.5 mr-1">
            <button
              onClick={() => { setRange(6); setSelectedMonth(null); }}
              className={`text-[11px] px-2 py-1 rounded-md transition-all ${range === 6 ? "bg-zinc-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"}`}
            >
              6{t("chart.months")}
            </button>
            <button
              onClick={() => { setRange(12); setSelectedMonth(null); }}
              className={`text-[11px] px-2 py-1 rounded-md transition-all ${range === 12 ? "bg-zinc-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"}`}
            >
              12{t("chart.months")}
            </button>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setView("count")}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                view === "count"
                  ? "bg-zinc-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t("chart.count")}
            </button>
            <button
              onClick={() => setView("minutes")}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                view === "minutes"
                  ? "bg-zinc-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t("chart.duration")}
            </button>
          </div>
        </div>
      </div>

      {range === 12 && !isPro ? (
        <div className="relative" style={{ height: "120px" }}>
          <div className="filter blur-sm pointer-events-none opacity-50">
            <div className="flex items-end gap-1 h-full">
              {data.map((d) => {
                const val = view === "count" ? d.count : d.minutes;
                const pct = val > 0 ? Math.max((val / maxVal) * 100, 5) : 0;
                const isCurrentMonth = d.month === currentMonthKey;
                return (
                  <div
                    key={d.month}
                    className={`flex-1 rounded-t-sm`}
                    style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0px", background: isCurrentMonth ? "#e94560" : "#e945604d" }}
                  />
                );
              })}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 rounded-xl">
            <span className="text-2xl mb-2">🔒</span>
            <p className="text-sm font-semibold text-zinc-100">{t("chart.proOnly")}</p>
            <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#"} className="mt-3 bg-[#e94560] hover:bg-[#c73652] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {t("chart.upgradeToProBtn")}
            </a>
          </div>
        </div>
      ) : (
        <div className="relative" style={{ height: "120px" }}>
          {avgPct > 0 && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-white/10 pointer-events-none"
              style={{ bottom: `${avgPct}%` }}
              title={`${t("chart.average")}: ${view === "count" ? `${Math.round(avgVal)}${timesUnit}` : formatMinutes(Math.round(avgVal))}`}
            />
          )}
          <div className="flex items-end gap-1 h-full">
            {data.map((d) => {
              const val = view === "count" ? d.count : d.minutes;
              const pct = val > 0 ? Math.max((val / maxVal) * 100, 5) : 0;
              const label = view === "count" ? `${val}${timesUnit}` : formatMinutes(val);
              const isCurrentMonth = d.month === currentMonthKey;
              const isSelected = d.month === selectedMonth;

              return (
                <div
                  key={d.month}
                  className={`flex-1 flex flex-col items-center justify-end gap-1 h-full cursor-pointer group relative`}
                  onClick={() => setSelectedMonth(isSelected ? null : d.month)}
                  onMouseEnter={() => val > 0 && setHoveredMonth(d.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  {/* Hover tooltip */}
                  {hoveredMonth === d.month && val > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-zinc-950 border border-white/10 rounded-lg px-2 py-1.5 text-center pointer-events-none z-20 whitespace-nowrap shadow-lg">
                      <div className="text-[11px] font-semibold text-white">{d.label}</div>
                      <div className="text-[10px] text-zinc-300 mt-0.5">{d.count}{timesUnit} · {formatMinutes(d.minutes)}</div>
                      {/* Type breakdown in tooltip */}
                      {view === "count" && Object.keys(d.typeBreakdown).length > 1 && (
                        <div className="flex gap-1 mt-1 justify-center flex-wrap">
                          {TYPE_ORDER.filter((t) => d.typeBreakdown[t] > 0).map((t) => (
                            <span key={t} className="text-[9px] px-1 py-0.5 rounded" style={{ background: TYPE_HEX[t] + "30", color: TYPE_HEX[t] }}>
                              {TYPE_LABELS[t] ?? t}×{d.typeBreakdown[t]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <span
                    className={`leading-none transition-opacity ${range === 12 ? "text-[8px]" : "text-[9px]"} ${
                      val > 0 && (range === 6 || isCurrentMonth) ? "opacity-100" : "opacity-0"
                    } ${isCurrentMonth ? "text-[#e94560]" : "text-gray-500"}`}
                  >
                    {label}
                  </span>
                  {/* Stacked bar (count mode) or single bar (minutes mode) */}
                  {view === "count" && val > 0 && !isSelected ? (
                    <div
                      className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                      style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0px" }}
                    >
                      {TYPE_ORDER.filter((t) => (d.typeBreakdown[t] ?? 0) > 0).map((t) => {
                        const segPct = ((d.typeBreakdown[t] ?? 0) / d.count) * 100;
                        return (
                          <div
                            key={t}
                            style={{ height: `${segPct}%`, background: TYPE_HEX[t] + (isCurrentMonth ? "cc" : "80"), minHeight: "2px" }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isSelected
                          ? "bg-yellow-400"
                          : isCurrentMonth
                          ? "bg-[#e94560]"
                          : val > 0
                          ? "bg-[#e94560]/50 group-hover:bg-[#e94560]/70"
                          : "bg-zinc-900/50"
                      }`}
                      style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0px" }}
                    />
                  )}
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
      )}
      {avgPct > 0 && (
        <div className="text-[10px] text-gray-600 text-right mt-1">
          {t("chart.average")} {view === "count" ? `${Math.round(avgVal)}${timesUnit}/${t("chart.month")}` : `${formatMinutes(Math.round(avgVal))}/${t("chart.month")}`}
        </div>
      )}

      {/* Type legend (count view only) */}
      {view === "count" && visibleTypes.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-white/10">
          {visibleTypes.map((t) => (
            <span key={t} className="flex items-center gap-1 text-[9px] text-gray-400">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: TYPE_HEX[t] }} />
              {TYPE_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      )}

      {/* 月別ドリルダウン詳細パネル */}
      {selectedMonth && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-400">
              📅 {selectedMonthLabel}{t("chart.trainingLog")}
            </span>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-[10px] text-gray-500 hover:text-zinc-300 transition-colors"
            >
              ✕ {t("chart.close")}
            </button>
          </div>
          {selectedLoading ? (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-white/10 rounded flex-1 animate-pulse" />
              ))}
            </div>
          ) : selectedLogs.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-2">{t("chart.noRecords")}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedLogs.map((log, idx) => {
                const typeLabel = TYPE_LABELS[log.type] ?? log.type;
                const typeColor = TYPE_COLORS[log.type] ?? "bg-zinc-500/70";
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
            <div className="mt-2 pt-1 border-t border-white/10 flex gap-4 text-[10px] text-gray-500">
              <span>{selectedLogs.length}{timesUnit}</span>
              <span>{t("chart.totalLabel")}{formatMinutes(selectedLogs.reduce((s, l) => s + (l.duration_min || 0), 0))}</span>
              <span>{t("chart.avgLabel")}{selectedLogs.length > 0 ? formatMinutes(Math.round(selectedLogs.reduce((s, l) => s + (l.duration_min || 0), 0) / selectedLogs.length)) : "-"}</span>
            </div>
          )}
        </div>
      )}
      </div>)}
    </div>
  );
}
