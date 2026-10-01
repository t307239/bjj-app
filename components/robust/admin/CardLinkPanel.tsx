"use client";

import { useState } from "react";
import { useCopyFeedback } from "@/lib/robust/hooks/useCopyFeedback";

/**
 * カード登録リンク発行パネル（非カード会員 → カード払いへの切替用）。
 * オーナーがプランを選んでリンクを発行 → 会員に送る → 会員がカード登録で翌月からカード課金。
 * 選択プラン・発行結果・エラーはこのパネル内だけで持つ(会員ごとに独立)。
 */
export default function CardLinkPanel({ memberId }: { memberId: string }) {
  const [plan, setPlan] = useState("fulltime_male");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { copiedKey, copyText } = useCopyFeedback();

  async function issueCardLink() {
    setLoading(true);
    setError("");
    setUrl(null);
    try {
      const res = await fetch("/api/gym/robust/members/card-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, planKey: plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "発行に失敗しました");
      setUrl(json.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 bg-zinc-950/50 border border-white/10 rounded-lg p-3 space-y-2">
      <p className="text-xs text-zinc-400">
        プラン（料金）を選んでリンクを発行 → 会員に送ってください。会員がカード登録すると
        <span className="text-zinc-200">翌月1日からカード課金</span>
        になります（今は課金なし）。※口座振替の停止時期はオーナーが合わせてください。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`cardplan-${memberId}`} className="sr-only">
          プラン
        </label>
        <select
          id={`cardplan-${memberId}`}
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
        >
          <option value="fulltime_male">フルタイム（男性）¥12,000</option>
          <option value="fulltime_female">フルタイム（女性）¥10,000</option>
          <option value="twice_male">月8回（大人）¥10,000</option>
          <option value="twice_kids">月8回（キッズ）¥7,000</option>
          <option value="drop_in">ドロップイン ¥2,000</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => issueCardLink()}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 whitespace-nowrap"
        >
          {loading ? "発行中..." : "リンク発行"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {url && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="カード登録リンク"
            className="flex-1 bg-zinc-800 border border-white/10 rounded px-2 py-1.5 text-white text-xs"
          />
          <button
            type="button"
            onClick={() => copyText("cardlink", url)}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded px-2 py-1.5 whitespace-nowrap"
          >
            {copiedKey === "cardlink" ? "✓ コピー済" : "コピー"}
          </button>
        </div>
      )}
    </div>
  );
}
