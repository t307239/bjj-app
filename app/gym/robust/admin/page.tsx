"use client";

import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

/**
 * ROBUST 管理ダッシュボード
 *
 * - スタッフ/オーナー専用 (API 側で is_gym_staff_or_owner を確認)
 * - 今日のチェックインログ
 * - 会員一覧 (名前 / プラン / ステータス / 今月出欠数)
 */

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Member = {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  status: string;
  month_count: number;
  created_at: string;
};

type TodayLog = {
  id: string;
  checked_in_at: string;
  class_type: string | null;
  gym_members: { name: string; plan_type: string } | null;
};

type InsuranceExpiring = {
  id: string;
  name: string;
  insurance_expires_at: string;
  status: string;
};

type AdminData = {
  members: Member[];
  todayLogs: TodayLog[];
  insuranceExpiring: InsuranceExpiring[];
  billingPeriod: string;
};

const PLAN_LABEL: Record<string, string> = {
  fulltime:     "フルタイム",
  twice_weekly: "週2回",
  drop_in:      "ドロップイン",
};

const CLASS_LABEL: Record<string, string> = {
  beginner: "白帯",
  basic:    "基礎",
  regular:  "通常",
  nogi:     "ノーギ",
  private:  "個別",
  other:    "その他",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPage() {
  const supabase = createRobustClient();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"today" | "members">("today");
  const [showLogin, setShowLogin] = useState(false);

  async function fetchDashboard() {
    const res = await fetch("/api/gym/robust/admin");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setShowLogin(true);
        setLoading(false);
        return;
      }
      await fetchDashboard();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (showLogin) {
    return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); setLoading(true); fetchDashboard(); }} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/gym/robust/register" className="text-zinc-500 text-xs mt-2 block">
            ← ログインページへ
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeMembers = data.members.filter(m => m.status === "active");
  const planCounts: Record<string, number> = {};
  for (const m of activeMembers) {
    planCounts[m.plan_type] = (planCounts[m.plan_type] ?? 0) + 1;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ヘッダー */}
      <header className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
        <div>
          <h1 className="text-base font-bold">ROBUST 柔術</h1>
          <p className="text-xs text-zinc-500">管理ダッシュボード</p>
        </div>
        <span className="text-xs text-zinc-500">{data.billingPeriod}</span>
      </header>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{activeMembers.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">有効会員</p>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{data.todayLogs.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">本日来館</p>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{planCounts.twice_weekly ?? 0}</p>
          <p className="text-xs text-zinc-500 mt-0.5">週2プラン</p>
        </div>
      </div>

      {/* クイックリンク */}
      <div className="flex gap-2 px-4 pb-3">
        <a href="/gym/robust/admin/members"
          className="flex-1 text-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2.5 transition-colors">
          会員管理
        </a>
        <a href="/gym/robust/admin/videos"
          className="flex-1 text-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2.5 transition-colors">
          動画管理
        </a>
        <a href="/gym/robust/checkin"
          className="flex-1 text-center text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2.5 transition-colors">
          チェックイン
        </a>
      </div>

      {/* 保険期限切れ予定者（期限切れ + 30日以内） */}
      {data.insuranceExpiring.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-400 text-sm font-medium mb-2">
              ⚠️ スポーツ保険の更新予定（{data.insuranceExpiring.length}名）
            </p>
            <div className="space-y-1.5">
              {data.insuranceExpiring.map(m => {
                const expired = new Date(m.insurance_expires_at) < new Date();
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200">{m.name}</span>
                    <span className={`whitespace-nowrap ${expired ? "text-red-400" : "text-amber-300"}`}>
                      {m.insurance_expires_at}{expired ? "（期限切れ）" : " まで"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-white/10 px-4">
        {(["today", "members"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "today" ? `今日 (${data.todayLogs.length})` : `会員 (${data.members.length})`}
          </button>
        ))}
      </div>

      {/* 今日のログ */}
      {tab === "today" && (
        <div className="p-4 space-y-2">
          {data.todayLogs.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">まだチェックインはありません</p>
          ) : (
            data.todayLogs.map(log => (
              <div
                key={log.id}
                className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {log.gym_members?.name ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {PLAN_LABEL[log.gym_members?.plan_type ?? ""] ?? log.gym_members?.plan_type}
                    {log.class_type && ` · ${CLASS_LABEL[log.class_type] ?? log.class_type}`}
                  </p>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">{fmt(log.checked_in_at)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 会員一覧 */}
      {tab === "members" && (
        <div className="p-4 space-y-2">
          {data.members.map(m => (
            <div
              key={m.id}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{m.email}</p>
                </div>
                <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded ${
                  m.status === "active"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-700 text-zinc-400"
                }`}>
                  {m.status === "active" ? "有効" : m.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                <span>{PLAN_LABEL[m.plan_type] ?? m.plan_type}</span>
                <span className="text-zinc-700">·</span>
                <span>今月 <strong className="text-white">{m.month_count}</strong> 回</span>
              </div>
            </div>
          ))}
          {data.members.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">会員がまだいません</p>
          )}
        </div>
      )}
    </div>
  );
}
