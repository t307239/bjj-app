"use client";

/**
 * AttributionTable — z182: Display source-by-source signup / Pro CVR.
 *
 * Top app reference (Stripe Sigma / Mixpanel funnel):
 *   - Source 列をクリックでソート (signups / 30d / pro / CVR)
 *   - 30日 trend を sparkline 不要、数字のみで minimal
 *   - 高 CVR を強調 (色)
 *
 * Data: GET /api/admin/attribution (z180)
 */
import { useEffect, useState } from "react";

interface AttributionRow {
  source: string;
  signups_total: number;
  signups_30d: number;
  pro_users: number;
  pro_conversion_pct: number;
}

interface AttributionResponse {
  ok: boolean;
  total: { signups_all_sources: number; pro_all_sources: number; sources_count: number };
  rows: AttributionRow[];
  fetched_at: string;
}

type SortKey = "signups_total" | "signups_30d" | "pro_users" | "pro_conversion_pct";

export default function AttributionTable() {
  const [data, setData] = useState<AttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("signups_total");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/attribution");
        const json = (await res.json()) as AttributionResponse | { error?: string };
        if (cancelled) return;
        if (!res.ok || "error" in json) {
          setError(("error" in json && json.error) || "Failed to load");
          return;
        }
        setData(json as AttributionResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
        <div className="text-sm text-zinc-400">Loading attribution data…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
        <div className="text-sm text-red-300">Attribution: {error}</div>
      </div>
    );
  }
  if (!data) return null;

  const sorted = [...data.rows].sort((a, b) => b[sortKey] - a[sortKey]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      className={`text-left ${
        sortKey === key
          ? "text-emerald-400 font-semibold"
          : "text-zinc-400 hover:text-white"
      }`}
    >
      {label}
      {sortKey === key && " ↓"}
    </button>
  );

  return (
    <section className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">📊 Attribution by Source</h2>
        <div className="text-xs text-zinc-500">
          {data.total.sources_count} sources · {data.total.signups_all_sources} signups · {data.total.pro_all_sources} Pro
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="border-b border-white/10">
            <tr>
              <th className="text-left py-2 px-2 text-zinc-400 font-normal">Source</th>
              <th className="text-right py-2 px-2">{sortBtn("signups_total", "Signups")}</th>
              <th className="text-right py-2 px-2">{sortBtn("signups_30d", "30d")}</th>
              <th className="text-right py-2 px-2">{sortBtn("pro_users", "Pro")}</th>
              <th className="text-right py-2 px-2">{sortBtn("pro_conversion_pct", "CVR%")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-zinc-500">
                  No data yet (waiting for first signups with attribution)
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                // CVR color: high green / mid yellow / low gray
                const cvrColor =
                  row.pro_conversion_pct >= 10
                    ? "text-emerald-400 font-semibold"
                    : row.pro_conversion_pct >= 5
                      ? "text-yellow-300"
                      : "text-zinc-400";
                return (
                  <tr
                    key={row.source}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-2 px-2 text-zinc-200 font-mono">{row.source}</td>
                    <td className="py-2 px-2 text-right text-white">{row.signups_total}</td>
                    <td className="py-2 px-2 text-right text-zinc-300">
                      {row.signups_30d > 0 ? row.signups_30d : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-yellow-400">
                      {row.pro_users > 0 ? row.pro_users : "—"}
                    </td>
                    <td className={`py-2 px-2 text-right ${cvrColor}`}>
                      {row.signups_total > 0
                        ? `${row.pro_conversion_pct.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-600 mt-3 text-center">
        Last updated: {new Date(data.fetched_at).toLocaleTimeString()}
      </p>
    </section>
  );
}
