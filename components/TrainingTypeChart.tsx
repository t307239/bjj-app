"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type TypeCount = {
  value: string;
  label: string;
  count: number;
  totalMins: number;
  color: string;
  bg: string;
};

const TYPE_DEFS: Omit<TypeCount, "count" | "totalMins">[] = [
  { value: "gi",          label: "道衣 (Gi)",       color: "#3b82f6", bg: "bg-blue-500" },
  { value: "nogi",        label: "ノーギ",           color: "#f97316", bg: "bg-orange-500" },
  { value: "drilling",    label: "ドリル",           color: "#a855f7", bg: "bg-purple-500" },
  { value: "competition", label: "試合",             color: "#e94560", bg: "bg-red-500" },
  { value: "open_mat",    label: "オープンマット",   color: "#22c55e", bg: "bg-green-500" },
];

type Period = "all" | "month" | "week";

type Props = { userId: string };

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

function DonutChart({ data }: { data: TypeCount[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const cx = 60;
  const cy = 60;
  const R = 50;
  const r = 30;
  let cumAngle = -Math.PI / 2;

  const slices = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const angle = (d.count / total) * 2 * Math.PI;
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

      return { ...d, path, pct: Math.round((d.count / total) * 100) };
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
          {/* Label */}
          <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize="7" fontWeight="600">
            {hoveredSlice.label}
          </text>
          {/* Count */}
          <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
            {hoveredSlice.count}回
          </text>
          {/* Percentage */}
          <text x={cx} y={cy + 13} textAnchor="middle" fill={hoveredSlice.color} fontSize="8" fontWeight="600">
            {hoveredSlice.pct}%
          </text>
          {/* Total time (if available) */}
          {hoveredSlice.totalMins > 0 && (
            <text x={cx} y={cy + 23} textAnchor="middle" fill="#9ca3af" fontSize="7">
              {fmtMins(hoveredSlice.totalMins)}
            </text>
          )}
        </>
      ) : (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="7">
            練習回数
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

function MonthlyTrend({ logs, typeValue, typeLabel, color }: {
  logs: { date: string; type: string }[];
  typeValue: string;
  typeLabel: string;
  color: string;
}) {
  const now = new Date();
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
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
      <p className="text-[10px] text-gray-500 mb-2">
        <span style={{ color }} className="font-semibold">{typeLabel}</span> の月別推移（過去6ヶ月）
      </p>
      <div className="flex items-end gap-1.5 h-12">
        {months.map((m) => {
          const pct = m.count > 0 ? Math.max((m.count / maxCount) * 100, 8) : 0;
          const isCurrentMonth = m.key === months[5].key;
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <span className="text-[8px] text-gray-600 leading-none">
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
              <span className={`text-[8px] leading-none ${isCurrentMonth ? "text-white font-semibold" : "text-gray-600"}`}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingTypeChart({ userId }: Props) {
  const [allLogs, setAllLogs] = useState<{ date: string; type: string; duration_min: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: logs } = await supabase
        .from("training_logs")
        .select("date, type, duration_min")
        .eq("user_id", userId);

      if (logs) {
        setAllLogs(logs as { date: string; type: string; duration_min: number | null }[]);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;

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
  if (total === 0 && period === "all") return null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <h4 className="text-sm font-medium text-gray-300">🥋 練習タイプ分布</h4>
        <div className="flex items-center gap-2">
          {!isOpen && total > 0 && (
            <span className="text-[10px] text-gray-500">{total}回</span>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && (<div className="p-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">練習タイプ分布</h4>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["all", "month", "week"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[11px] px-2 py-1 transition-colors ${
                period === p ? "bg-[#e94560] text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {p === "all" ? "全期間" : p === "month" ? "今月" : "今週"}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-4 text-gray-600 text-xs">
          {period === "week" ? "今週" : "今月"}の練習記録はありません
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <DonutChart data={data} />
          <div className="flex-1 space-y-1.5">
            {data
              .filter((d) => d.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((d) => {
                const pct = Math.round((d.count / total) * 100);
                const isSelected = selectedType === d.value;
                return (
                  <div
                    key={d.value}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg px-1 py-0.5 transition-colors ${
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => setSelectedType(isSelected ? null : d.value)}
                    title="クリックして月別推移を表示"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.bg}`} />
                    <span className={`text-xs flex-1 truncate ${isSelected ? "text-white font-medium" : "text-gray-400"}`}>{d.label}</span>
                    <span className="text-xs font-medium text-white">{d.count}回</span>
                    <span className="text-[10px] text-gray-600 w-7 text-right">{pct}%</span>
                    {d.totalMins > 0 && (
                      <span className="text-[10px] text-gray-600 w-8 text-right">{fmtMins(d.totalMins)}</span>
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
          />
        ) : null;
      })()}
      </div>)}
    </div>
  );
}
