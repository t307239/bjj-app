"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

interface WeightPoint {
  isoDate: string;   // YYYY-MM-DD
  dateLabel: string; // "Mar 25"
  standalone: number | null;   // from weight_logs
  postTraining: number | null; // from training_logs.weight
}

interface Props {
  userId: string;
  refreshKey?: number;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const W = 300; // SVG width
const H = 140; // SVG height
const PAD = { top: 10, right: 10, bottom: 28, left: 34 };

function toSvgX(i: number, total: number): number {
  if (total <= 1) return PAD.left + (W - PAD.left - PAD.right) / 2;
  return PAD.left + (i / (total - 1)) * (W - PAD.left - PAD.right);
}

function toSvgY(val: number, minW: number, maxW: number): number {
  if (maxW === minW) return PAD.top + (H - PAD.top - PAD.bottom) / 2;
  const range = maxW - minW;
  const ratio = (val - minW) / range;
  return PAD.top + (H - PAD.top - PAD.bottom) * (1 - ratio);
}

function pointsToPolyline(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export default function WeightChart({ userId, refreshKey }: Props) {
  const { t } = useLocale();
  const supabase = createClient();

  const [data, setData] = useState<WeightPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: wLogs }, { data: tLogs }] = await Promise.all([
      supabase
        .from("weight_logs")
        .select("weight, measured_at")
        .eq("user_id", userId)
        .gte("measured_at", since)
        .order("measured_at", { ascending: true }),
      supabase
        .from("training_logs")
        .select("weight, date")
        .eq("user_id", userId)
        .not("weight", "is", null)
        .gte("date", since.slice(0, 10))
        .order("date", { ascending: true }),
    ]);

    const map = new Map<string, WeightPoint>();

    for (const row of wLogs ?? []) {
      const key = (row.measured_at as string).slice(0, 10);
      const existing = map.get(key);
      map.set(key, {
        isoDate: key,
        dateLabel: formatDateLabel(key),
        standalone: row.weight as number,
        postTraining: existing?.postTraining ?? null,
      });
    }

    for (const row of tLogs ?? []) {
      const key = row.date as string;
      const existing = map.get(key);
      map.set(key, {
        isoDate: key,
        dateLabel: existing?.dateLabel ?? formatDateLabel(key),
        standalone: existing?.standalone ?? null,
        postTraining: row.weight as number,
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.isoDate.localeCompare(b.isoDate)
    );

    setData(sorted);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
        <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
          {t("body.weightChart")}
        </p>
        <p className="text-gray-600 text-sm text-center py-6">{t("body.noData")}</p>
      </div>
    );
  }

  const allWeights = data
    .flatMap((d) => [d.standalone, d.postTraining])
    .filter((v): v is number => v !== null);
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);

  // Build line path segments (skip nulls by breaking the line)
  const standalonePts = data.map((d, i) =>
    d.standalone !== null ? { x: toSvgX(i, data.length), y: toSvgY(d.standalone, minW, maxW) } : null
  );
  const postPts = data.map((d, i) =>
    d.postTraining !== null ? { x: toSvgX(i, data.length), y: toSvgY(d.postTraining, minW, maxW) } : null
  );

  // Group consecutive non-null points into segments
  function toSegments(pts: ({ x: number; y: number } | null)[]): { x: number; y: number }[][] {
    const segments: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    for (const p of pts) {
      if (p) {
        current.push(p);
      } else {
        if (current.length > 0) { segments.push(current); current = []; }
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }

  const standaloneSegs = toSegments(standalonePts);
  const postSegs = toSegments(postPts);

  // X-axis: show first, middle, last labels
  const xLabels = data.length <= 6
    ? data.map((d, i) => ({ i, label: d.dateLabel }))
    : [
        { i: 0, label: data[0]?.dateLabel ?? "" },
        { i: Math.floor((data.length - 1) / 2), label: data[Math.floor((data.length - 1) / 2)]?.dateLabel ?? "" },
        { i: data.length - 1, label: data[data.length - 1]?.dateLabel ?? "" },
      ];

  // Y-axis labels
  const yTicks = [minW, Math.round((minW + maxW) / 2), maxW];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
      <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
        {t("body.weightChart")} <span className="text-gray-600 font-normal">(90 days)</span>
      </p>

      {/* Legend */}
      <div className="flex gap-4 mb-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="inline-block w-5 h-0.5 bg-[#10B981] rounded" />
          {t("body.standalone")}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="inline-block w-5 h-0.5 bg-[#60a5fa] rounded border-t-2 border-dashed border-[#60a5fa]" />
          {t("body.postTraining")}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={t("body.weightChart")}>
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = toSvgY(tick, minW, maxW);
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="#27272a" strokeWidth="1" strokeDasharray="3 3"
              />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#6b7280">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={toSvgX(i, data.length)}
            y={H - 4}
            textAnchor="middle"
            fontSize="8"
            fill="#6b7280"
          >
            {label}
          </text>
        ))}

        {/* kg unit */}
        <text x={PAD.left - 4} y={PAD.top - 2} textAnchor="end" fontSize="7" fill="#4b5563">
          kg
        </text>

        {/* Standalone lines */}
        {standaloneSegs.map((seg, si) =>
          seg.length > 1 ? (
            <polyline
              key={`s-${si}`}
              points={pointsToPolyline(seg)}
              fill="none"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null
        )}

        {/* Post-training lines (dashed) */}
        {postSegs.map((seg, si) =>
          seg.length > 1 ? (
            <polyline
              key={`p-${si}`}
              points={pointsToPolyline(seg)}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null
        )}

        {/* Dots — standalone */}
        {standalonePts.map((pt, i) =>
          pt ? (
            <circle key={`sd-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#10B981" />
          ) : null
        )}

        {/* Dots — post-training */}
        {postPts.map((pt, i) =>
          pt ? (
            <circle key={`pd-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#60a5fa" />
          ) : null
        )}
      </svg>
    </div>
  );
}
