"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Log = { id: string; checked_in_at: string; class_type: string | null; billing_period: string; charged: boolean };

const CLASS_LABEL: Record<string, string> = {
  beginner: "白帯クラス", basic: "基礎", regular: "通常",
  nogi: "ノーギ", private: "個別", other: "その他",
};

export default function MemberHistoryPage() {
  const supabase = createRobustClient();
  const [logs, setLogs] = useState<Log[]>([]);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [planCap, setPlanCap] = useState<number | null>(null);
  const [planType, setPlanType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }
      const res = await fetch("/api/gym/robust/member/history");
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setLogs(json.logs);
      setThisMonthCount(json.thisMonthCount);
      setPlanCap(json.planCap);
      setPlanType(json.planType);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 月別にグループ化
  const grouped = logs.reduce<Record<string, Log[]>>((acc, l) => {
    const key = l.billing_period;
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">チェックイン履歴</h1>
          <a href="/gym/robust/member/profile" className="text-zinc-400 text-xs hover:text-white">← マイページ</a>
        </div>

        {/* 今月サマリ */}
        {planType === "twice_weekly" && planCap !== null && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
            <p className="text-zinc-400 text-xs mb-1">今月の来館回数</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${thisMonthCount > planCap ? "text-red-400" : "text-emerald-400"}`}>
                {thisMonthCount}
              </span>
              <span className="text-zinc-500 text-sm">/ {planCap}回</span>
            </div>
            {thisMonthCount > planCap && (
              <p className="text-red-400 text-xs mt-1">上限を超えています（超過分 ¥1,000/回 が翌月請求に追加されます）</p>
            )}
          </div>
        )}

        {/* 履歴一覧 */}
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">チェックイン履歴がありません</p>
          </div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([period, periodLogs]) => (
              <div key={period} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-medium text-zinc-400">
                    {period.replace("-", "年")}月
                  </h2>
                  <span className="text-xs text-zinc-500">{periodLogs.length}回</span>
                </div>
                <div className="space-y-2">
                  {periodLogs.map(log => (
                    <div key={log.id} className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">
                          {new Date(log.checked_in_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
                        </p>
                        {log.class_type && <p className="text-zinc-500 text-xs mt-0.5">{CLASS_LABEL[log.class_type] ?? log.class_type}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 text-xs tabular-nums">
                          {new Date(log.checked_in_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {log.charged && <p className="text-red-400 text-xs">超過</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
