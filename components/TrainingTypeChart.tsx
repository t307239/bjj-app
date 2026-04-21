"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Skeleton from "@/components/ui/Skeleton";
import { clientLogger } from "@/lib/clientLogger";

type TypeCount = {
  value: string;
  label: string;
  count: number;
  totalMins: number;
  color: string;
  bg: string;
};

const TYPE_DEFS_BASE = [
  { value: "gi",          color: "#3b82f6", bg: "bg-blue-500" },
  { value: "nogi",        color: "#f97316", bg: "bg-orange-500" },
  { value: "drilling",    color: "#a855f7", bg: "bg-purple-500" },
  { value: "competition", color: "#e94560", bg: "bg-red-500" },
  { value: "open_mat",    color: "#22c55e", bg: "bg-green-500" },
] as const;

type Period = "all" | "month" | "week";

type Props = { userId: string; isPro?: boolean };

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPeriodStart(period: Period): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "month") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  return toLocalDateStr(monday);
}

function fmtMins(mins: number): string {
  if (mins <= 0) return "";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function DonutChart({ data, mode, timesUnit, sessionsLabel, totalTimeLabel }: {
  data: TypeCount[];
  mode: "time" | "count";
  timesUnit: string;
  sessionsLabel: string;
  totalTimeLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const getValue = (d: TypeCount) => mode === "time" ? d.totalMins : d.count;
  const total = data.reduce((s, d) => s + getValue(d), 0);
  if (total === 0) return null;

  const cx = 60;
  const cy = 60;
  const R = 50;
  const r = 30;
  let cumAngle = -Math.PI / 2;

  const slices = data
    .filter((d) => getValue(d) > 0)
    .map((d) => {
      const val = getValue(d);
      const angle = (val / total) * 2 * Math.PI;
      const start = cumAngle;
      const end = cumAngle + angle;
      cumAngle = end;

      const x1 = cx + R * Math.cos(start);
      const y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end);
      const y2 = cy + R * Math.sin(end);
      const ix1 = cx + r * Math.cos(end);
      const iy1 = cy + r * Math.sin(end);
      const ix2 = cx + r * Math.cos(start);
      const iy2 = cy + r * Math.sin(start);

      const large = angle > Math.PI ? 1 : 0;
      const path = [
        `M ${x1} ${y1}`,
        `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      return { ...d, path, pct: Math.round((val / total) * 100) };
    });

  const hoveredSlice = hovered ? slices.find((s) => s.value === hovered) : null;

  return (
    <svg
      viewBox="0 0 120 120"
      className="w-28 h-28 flex-shrink-0"
      onMouseLeave={() => setHovered(null)}
    >
      {slices.map((s) => (
        <path
          key={s.value}
          d={s.path}
          fill={s.color}
          opacity={hovered ? (hovered === s.value ? 1 : 0.35) : 0.85}
          className="cursor-pointer transition-opacity duration-150"
          onMouseEnter={() => setHovered(s.value)}
        />
      ))}

      {hoveredSlice ? (
        <>
          <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize="7" fontWeight="600">
            {hoveredSlice.label}
          </text>
          <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
            {mode === "time" ? fmtMins(hoveredSlice.totalMins) : `${hoveredSlice.count}${timesUnit}`}
          </text>
          <text x={cx} y={cy + 13} textAnchor="middle" fill={hoveredSlice.color} fontSize="8" fontWeight="600">
            {hoveredSlice.pct}%
          </text>
          {mode !== "time" && hoveredSlice.totalMins > 0 && (
            <text x={cx} y={cy + 23} textAnchor="middle" fill="#9ca3af" fontSize="7">
              {fmtMins(hoveredSlice.totalMins)}
            </text>
          )}
        </>
      ) : (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            {mode === "time" ? fmtMins(total) : String(total)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="7">
            {mode === "time" ? totalTimeLabel : sessionsLabel}
          </text>
        </>
      )}
    </svg>
  );
}

function MiniSparkline({ logs, typeValue, color }: {
  logs: { date: string; type: string }[];
  typeValue: string;
  color: string;
}) {
  const now = new Date();
  const months: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const count = logs.filter((l) => l.type === typeValue && l.date.startsWith(key)).length;
    months.push(count);
  }
  const maxVal = Math.max(...months, 1);
  const W = 48;
  const H = 16;
  const pts = months.map((v, i) => {
    const x = (i / (months.length - 1)) * W;
    const y = H - (v / maxVal) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0 opacity-70">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {months.map((v, i) => (
        <circle
          key={i}
          cx={(i / (months.length - 1)) * W}
          cy={H - (v / maxVal) * H}
          r={i === 5 ? 2 : 1}
          fill={i === 5 ? color : "transparent"}
        />
      ))}
    </svg>
  );
}

function MonthlyTrend({ logs, typeValue, typeLabel, color, trendSubtitle }: {
  logs: { date: string; type: string }[];
  typeValue: string;
  typeLabel: string;
  color: string;
  trendSubtitle: string;
}) {
  const now = new Date();
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // locale-aware short month label via Intl
    const label = new Intl.DateTimeFormat("en", { month: "short" }).format(d);
    months.push({ key, label, count: 0 });
  }
  logs.forEach((l) => {
    if (l.type !== typeValue) return;
    const mk = l.date.substring(0, 7);
    const m = months.find((x) => x.key === mk);
    if (m) m.count++;
  });

  const maxCount = Math.max(...months.map((m) => m.count), 1);

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <p className="text-xs text-zinc-400 mb-2">
        <span style={{ color }} className="font-semibold">{typeLabel}</span>{trendSubtitle}
      </p>
      <div className="flex items-end gap-1.5 h-12">
        {months.map((m) => {
          const pct = m.count > 0 ? Math.max((m.count / maxCount) * 100, 8) : 0;
          const isCurrentMonth = m.key === months[5].key;
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <span className="text-xs text-zinc-400 leading-none">
                {m.count > 0 ? m.count : ""}
              </span>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${pct}%`,
                  minHeight: m.count > 0 ? "3px" : "0",
                  backgroundColor: isCurrentMonth ? color : `${color}66`,
                }}
              />
              <span className={`text-xs leading-none ${isCurrentMonth ? "text-white font-semibold" : "text-zinc-400"}`}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingTypeChart({ userId, isPro = false }: Props) {
  const { t } = useLocale();
  const [allLogs, setAllLogs] = useState<{ date: string; type: string; duration_min: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Locale-aware training type labels
  const TYPE_DEFS: Omit<TypeCount, "count" | "totalMins">[] = TYPE_DEFS_BASE.map((d) => ({
    ...d,
    label: t(`training.${d.value}`),
  }));

  useEffect(() => {
    const load = async () => {
      try {
        const { data: logs , error } = await supabase
          .from("training_logs")
          .select("date, type, duration_min")
          .eq("user_id", userId);
        if (error) clientLogger.error("trainingtypechart.query", {}, error);

        if (logs) {
          setAllLogs(logs as { date: string; type: string; duration_min: number | null }[]);
        }
      } catch {
        // Network/auth error — show empty state gracefully
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, supabase]);

  if (loading) return <Skeleton height={48} rounded="xl" className="mb-4" />;

  const periodStart = getPeriodStart(period);
  const filteredLogs = periodStart
    ? allLogs.filter((l) => l.date >= periodStart)
    : allLogs;

  const counts: Record<string, number> = {};
  const mins: Record<string, number> = {};
  filteredLogs.forEach((l) => {
    counts[l.type] = (counts[l.type] ?? 0) + 1;
    mins[l.type] = (mins[l.type] ?? 0) + (l.duration_min ?? 0);
  });

  const data: TypeCount[] = TYPE_DEFS.map((def) => ({
    ...def,
    count: counts[def.value] ?? 0,
    totalMins: mins[def.value] ?? 0,
  }));

  const total = data.reduce((s, d) => s + d.count, 0);
  const totalTime = data.reduce((s, d) => s + d.totalMins, 0);
  const chartMode: "time" | "count" = totalTime > 0 ? "time" : "count";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <h4 className="text-sm font-medium text-zinc-300">🥋 {t("chart.typeDistribution")}</h4>
        <div className="flex items-center gap-2">
          {!isOpen && total > 0 && (
            <span className="text-xs text-zinc-400">
              {totalTime > 0 ? fmtMins(totalTime) : `${total}${t("chart.timesUnit")}`}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && (<div className={`p-4 border-t border-white/10 ${!isPro ? "relative" : ""}`}>{!isPro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/80 rounded-b-xl">
          <span className="text-2xl mb-2">🔒</span>
          <p className="text-sm font-semibold text-zinc-100">{t("chart.proOnly")}</p>
          {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ? (
            <a href={userId ? `${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}?client_reference_id=${userId}` : process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK} className="mt-3 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-4 py-2 rounded-lg transition-all">
              {t("chart.upgradeToProBtn")}
            </a>
          ) : (
            <span className="mt-3 inline-block bg-zinc-700 text-zinc-400 text-xs font-semibold px-4 py-2 rounded-lg cursor-not-allowed">
              {t("chart.upgradeToProBtn")}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-zinc-300">{t("chart.typeDistribution")}</h4>
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          {(["all", "month", "week"] as const).map((p) => (
            <button type="button"
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-1.5 rounded-lg transition-all ${
                period === p ? "bg-zinc-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              {p === "all" ? t("chart.allTime") : p === "month" ? t("chart.thisMonth") : t("chart.thisWeek")}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        period === "all" ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <svg className="w-8 h-8 text-zinc-500 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13l-.87.5M4.21 15.5l-.87.5M19.79 15.5l-.87-.5M4.21 8.5l-.87-.5M21 12h-1M4 12H3m15.36-6.36l-.7.7M6.34 17.66l-.7.7M17.66 17.66l.7.7M6.34 6.34l.7.7" />
            </svg>
            <p className="text-sm text-zinc-400">{t("chart.noSessionsYet")}</p>
            <p className="text-xs text-zinc-400">{t("chart.logToFillChart")}</p>
          </div>
        ) : (
          <div className="text-center py-4 text-zinc-400 text-xs">
            {period === "week" ? t("chart.noSessionsThisWeek") : t("chart.noSessionsThisMonth")}
          </div>
        )
      ) : (
        <div className="flex items-center gap-4">
          <DonutChart data={data} mode={chartMode} timesUnit={t("chart.timesUnit")} sessionsLabel={t("chart.sessions")} totalTimeLabel={t("chart.totalTime")} />
          <div className="flex-1 space-y-1.5">
            {data
              .filter((d) => chartMode === "time" ? d.totalMins > 0 : d.count > 0)
              .sort((a, b) => chartMode === "time" ? b.totalMins - a.totalMins : b.count - a.count)
              .map((d) => {
                const legendTotal = chartMode === "time" ? totalTime : total;
                const legendVal = chartMode === "time" ? d.totalMins : d.count;
                const pct = legendTotal > 0 ? Math.round((legendVal / legendTotal) * 100) : 0;
                const isSelected = selectedType === d.value;
                return (
                  <div
                    key={d.value}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg px-1 py-0.5 transition-colors ${
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => setSelectedType(isSelected ? null : d.value)}
                    title={t("chart.clickForTrend")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedType(isSelected ? null : d.value);
                      }
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.bg}`} />
                    <span className={`text-xs flex-1 truncate ${isSelected ? "text-white font-medium" : "text-zinc-400"}`}>{d.label}</span>
                    <span className="text-xs font-medium text-white">
                      {chartMode === "time" ? fmtMins(d.totalMins) : `${d.count}${t("chart.timesUnit")}`}
                    </span>
                    <span className="text-xs text-zinc-400 w-7 text-right">{pct}%</span>
                    {chartMode !== "time" && d.totalMins > 0 && (
                      <span className="text-xs text-zinc-400 w-8 text-right">{fmtMins(d.totalMins)}</span>
                    )}
                    <MiniSparkline logs={allLogs} typeValue={d.value} color={d.color} />
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {selectedType && (() => {
        const typeDef = TYPE_DEFS.find((d) => d.value === selectedType);
        return typeDef ? (
          <MonthlyTrend
            logs={allLogs}
            typeValue={selectedType}
            typeLabel={typeDef.label}
            color={typeDef.color}
            trendSubtitle={t("chart.monthlyTrendSubtitle")}
          />
        ) : null;
      })()}
      </div>)}
    </div>
  );
}
