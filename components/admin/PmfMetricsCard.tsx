/**
 * PmfMetricsCard — z255kk: PMF (Product-Market Fit) metrics dashboard card.
 *
 * Shows:
 * - Signups: last 7d / 30d / 90d + week-over-week %
 * - D7 retention: of users who signed up 7-30 days ago, % with a session in first 7 days
 * - Source breakdown: which referral source brings most users
 * - Weekly active trend: last 4 weeks
 *
 * Surface: /admin (above user list). Owner-only via parent route guard.
 */
"use client";

import { useEffect, useState } from "react";
import { clientLogger } from "@/lib/clientLogger";
import { fetchWithTimeout } from "@/lib/fetchWithRetry";

type PmfMetrics = {
  signups_last_7d: number;
  signups_last_30d: number;
  signups_last_90d: number;
  signup_wow_percent: number;
  d7_retention_percent: number;
  d7_retention_cohort_size: number;
  source_breakdown: Record<string, number>;
  weekly_active_trend: number[];
};

type FullMetrics = {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  pmf?: PmfMetrics;
};

export default function PmfMetricsCard() {
  const [data, setData] = useState<FullMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/admin/metrics", {
          timeoutMs: 15_000,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as FullMetrics;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          clientLogger.error("pmf_metrics.fetch_failed", {}, err as Error);
          setErrorMsg("Failed to load PMF metrics.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="bg-zinc-900 border border-white/10 rounded-xl p-5 mb-6 animate-pulse"
        role="status"
        aria-live="polite"
        aria-label="Loading PMF metrics"
      >
        <div className="h-5 w-32 bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div
        className="bg-zinc-900 border border-red-500/30 rounded-xl p-5 mb-6 text-sm text-red-300"
        role="alert"
      >
        ⚠️ {errorMsg ?? "No data."}
      </div>
    );
  }

  const pmf = data.pmf;
  if (!pmf) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-5 mb-6 text-sm text-zinc-400">
        PMF metrics unavailable (auth.users fetch failed).
      </div>
    );
  }

  const wowColor =
    pmf.signup_wow_percent > 0
      ? "text-emerald-400"
      : pmf.signup_wow_percent < 0
        ? "text-red-400"
        : "text-zinc-400";
  const wowSign = pmf.signup_wow_percent > 0 ? "+" : "";

  // D7 health interpretation
  // <20%: 製品が市場に合ってない / >40%: PMF achieved
  const d7Color =
    pmf.d7_retention_percent >= 40
      ? "text-emerald-400"
      : pmf.d7_retention_percent >= 20
        ? "text-yellow-400"
        : pmf.d7_retention_percent === 0 && pmf.d7_retention_cohort_size === 0
          ? "text-zinc-500"
          : "text-red-400";

  // Source breakdown sorted descending
  const sourceEntries = Object.entries(pmf.source_breakdown).sort(
    (a, b) => b[1] - a[1]
  );

  // Weekly trend max for bar chart scaling
  const trendMax = Math.max(1, ...pmf.weekly_active_trend);

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">📈 PMF Metrics</h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          z255kk
        </span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-zinc-950 border border-white/[0.06] rounded-lg p-3">
          <div className="text-2xl font-bold text-white">
            {pmf.signups_last_7d}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            Signups (last 7d)
          </div>
          <div className={`text-[11px] mt-1 ${wowColor}`}>
            {wowSign}
            {pmf.signup_wow_percent}% vs prev 7d
          </div>
        </div>
        <div className="bg-zinc-950 border border-white/[0.06] rounded-lg p-3">
          <div className="text-2xl font-bold text-white">
            {pmf.signups_last_30d}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Signups (30d)</div>
          <div className="text-[11px] text-zinc-600 mt-1">
            {pmf.signups_last_90d} in 90d
          </div>
        </div>
        <div className="bg-zinc-950 border border-white/[0.06] rounded-lg p-3">
          <div className={`text-2xl font-bold ${d7Color}`}>
            {pmf.d7_retention_cohort_size === 0
              ? "—"
              : `${pmf.d7_retention_percent}%`}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            D7 retention
          </div>
          <div className="text-[11px] text-zinc-600 mt-1">
            cohort: {pmf.d7_retention_cohort_size}
          </div>
        </div>
        <div className="bg-zinc-950 border border-white/[0.06] rounded-lg p-3">
          <div className="text-2xl font-bold text-white">
            {data.active_users_7d}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            Active users (7d)
          </div>
          <div className="text-[11px] text-zinc-600 mt-1">
            {data.active_users_30d} (30d)
          </div>
        </div>
      </div>

      {/* Weekly active trend (sparkline-ish) */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-300 mb-2">
          Weekly Active Users (last 4 weeks)
        </div>
        <div className="flex items-end gap-2 h-20">
          {pmf.weekly_active_trend.map((v, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              title={`Week ${i - 3}: ${v} users`}
            >
              <div className="text-[10px] text-zinc-400">{v}</div>
              <div
                className="w-full bg-emerald-500/40 rounded-t"
                style={{
                  height: `${(v / trendMax) * 60}px`,
                  minHeight: v > 0 ? "4px" : "0",
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-1 text-[10px] text-zinc-500">
          <span className="flex-1 text-center">3w ago</span>
          <span className="flex-1 text-center">2w ago</span>
          <span className="flex-1 text-center">last w</span>
          <span className="flex-1 text-center">this w</span>
        </div>
      </div>

      {/* Source breakdown */}
      <div>
        <div className="text-xs font-semibold text-zinc-300 mb-2">
          Signup Source (last 90d)
        </div>
        {sourceEntries.length === 0 ? (
          <div className="text-xs text-zinc-500">No signups in last 90 days.</div>
        ) : (
          <div className="space-y-1.5">
            {sourceEntries.slice(0, 6).map(([src, count]) => {
              const pct = Math.round(
                (count / Math.max(1, pmf.signups_last_90d)) * 100
              );
              return (
                <div key={src} className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-300 w-32 truncate" title={src}>
                    {src}
                  </span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-zinc-400 tabular-nums w-12 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interpretation hint */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11px] text-zinc-500 leading-relaxed">
        💡 D7 retention {"<"} 20% = no PMF / {"≥"} 40% = strong PMF
        signal. Cohort: signed up 7-30 days ago, returned within first 7 days.
      </div>
    </div>
  );
}
