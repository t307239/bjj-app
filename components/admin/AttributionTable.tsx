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

interface PaidAttributionRow {
  paid_ref: string;
  paid_count: number;
  b2c_pro: number;
  b2b_gym: number;
}

interface WikiFunnelSummary {
  wiki_signups_total: number;
  wiki_signups_30d: number;
  wiki_pro_users: number;
  wiki_pro_conversion_pct: number;
  direct_total: number;
  direct_pro_users: number;
  direct_pro_conversion_pct: number;
  top_wiki_pages: { slug: string; count: number }[];
}

interface AttributionResponse {
  ok: boolean;
  total: {
    signups_all_sources: number;
    pro_all_sources: number;
    sources_count: number;
    paid_sources_count?: number;
  };
  rows: AttributionRow[];
  paid_rows?: PaidAttributionRow[];
  /** z255rrr: Wiki funnel SEO ROI summary (signup_source LIKE 'wiki:%') */
  wiki_funnel?: WikiFunnelSummary;
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
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setError(body.error ?? `Failed to load (HTTP ${res.status})`);
          return;
        }
        const json = (await res.json()) as AttributionResponse | { error?: string };
        if (cancelled) return;
        if ("error" in json) {
          setError(json.error || "Failed to load");
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
        <div className="text-sm text-zinc-400">流入元データを読み込み中…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
        <div className="text-sm text-red-300">流入元データ取得エラー: {error}</div>
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
    <>
      {/* z255rrr: Wiki funnel SEO ROI summary card */}
      {data.wiki_funnel && (
        <section
          className="rounded-xl p-4 mb-6 border"
          style={{
            background:
              "linear-gradient(135deg, rgba(124, 106, 247, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)",
            borderColor: "rgba(124, 106, 247, 0.25)",
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-white" title="Wiki経由 (1,500+ ページ) からアプリ登録した人の数と Pro 化率">
              📚 Wiki 流入 SEO ROI
            </h2>
            <div className="text-xs text-zinc-500">直近 30 日: {data.wiki_funnel.wiki_signups_30d} 名</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="bg-zinc-900/40 rounded-lg p-2">
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{data.wiki_funnel.wiki_signups_total}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Wiki 経由 登録数</div>
            </div>
            <div className="bg-zinc-900/40 rounded-lg p-2">
              <div className="text-lg font-bold text-yellow-400 tabular-nums">{data.wiki_funnel.wiki_pro_users}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Wiki 経由 Pro</div>
            </div>
            <div className="bg-zinc-900/40 rounded-lg p-2">
              <div className="text-lg font-bold text-purple-400 tabular-nums">{data.wiki_funnel.wiki_pro_conversion_pct}%</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Wiki 課金率</div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 mb-2">
            Direct vs Wiki 課金率 比較: <span className="font-semibold text-zinc-200">{data.wiki_funnel.direct_pro_conversion_pct}%</span>
            {" "}<span className="text-zinc-500">vs</span>{" "}
            <span className="font-semibold text-purple-300">{data.wiki_funnel.wiki_pro_conversion_pct}%</span>
            {data.wiki_funnel.wiki_pro_conversion_pct > data.wiki_funnel.direct_pro_conversion_pct && data.wiki_funnel.wiki_signups_total > 0 && (
              <span className="ml-1 text-emerald-400">✓ Wiki の方が高い</span>
            )}
          </div>
          {data.wiki_funnel.top_wiki_pages.length > 0 && (
            <div className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">流入 Top 5 ページ:</span>{" "}
              {data.wiki_funnel.top_wiki_pages.map((p) => (
                <span key={p.slug} className="inline-block mr-2">
                  <span className="text-zinc-300">{p.slug}</span>
                  <span className="text-zinc-500"> ({p.count})</span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    <section className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-white" title="どの経路から登録した user が、どれくらい Pro 課金に進んだか">
          📊 流入元別の有料転換率
        </h2>
        <div className="text-xs text-zinc-500">
          {data.total.sources_count} 経路 · 登録 {data.total.signups_all_sources} 名 · Pro {data.total.pro_all_sources} 名
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums" aria-label="流入元別の有料転換率">
          <thead className="border-b border-white/10">
            <tr>
              <th className="text-left py-2 px-2 text-zinc-400 font-normal">流入元</th>
              <th className="text-right py-2 px-2">{sortBtn("signups_total", "登録数")}</th>
              <th className="text-right py-2 px-2">{sortBtn("signups_30d", "30日")}</th>
              <th className="text-right py-2 px-2">{sortBtn("pro_users", "Pro")}</th>
              <th className="text-right py-2 px-2">{sortBtn("pro_conversion_pct", "課金率")}</th>
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

      {/* z192: Paid attribution (paid_ref, post-conversion) */}
      {data.paid_rows && data.paid_rows.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h3
            className="text-xs font-semibold text-emerald-400 mb-2"
            title="実際に有料課金に至った user の流入元 (個人会員 Pro / 道場会員 Gym Pro 別)"
          >
            💰 課金に至った流入元
          </h3>
          <table className="w-full text-xs tabular-nums" aria-label="課金に至った流入元">
            <thead className="border-b border-white/10">
              <tr>
                <th className="text-left py-2 px-2 text-zinc-400 font-normal">
                  流入元タグ
                </th>
                <th className="text-right py-2 px-2 text-zinc-400 font-normal">
                  合計
                </th>
                <th className="text-right py-2 px-2 text-zinc-400 font-normal" title="個人 Pro 会員">
                  個人 Pro
                </th>
                <th className="text-right py-2 px-2 text-zinc-400 font-normal" title="道場 Gym Pro 会員">
                  道場
                </th>
              </tr>
            </thead>
            <tbody>
              {data.paid_rows.map((r) => (
                <tr
                  key={r.paid_ref}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="py-2 px-2 text-zinc-200 font-mono">
                    {r.paid_ref}
                  </td>
                  <td className="py-2 px-2 text-right text-emerald-400 font-semibold">
                    {r.paid_count}
                  </td>
                  <td className="py-2 px-2 text-right text-yellow-400">
                    {r.b2c_pro > 0 ? r.b2c_pro : "—"}
                  </td>
                  <td className="py-2 px-2 text-right text-blue-400">
                    {r.b2b_gym > 0 ? r.b2b_gym : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-zinc-600 mt-3 text-center">
        最終更新: {new Date(data.fetched_at).toLocaleTimeString()}
      </p>
    </section>
    </>
  );
}
