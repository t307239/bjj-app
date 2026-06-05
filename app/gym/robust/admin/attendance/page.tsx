"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

type RosterMember = {
  id: string;
  name: string;
  plan_type: string;
  checked_in_today: boolean;
};

const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム",
  twice_weekly: "週2回",
  drop_in: "ドロップイン",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  instructor: "インストラクター",
};

export default function AttendanceCheckPage() {
  const supabase = createRobustClient();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function fetchRoster() {
    const res = await fetch("/api/gym/robust/attendance");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) { setShowLogin(true); setLoading(false); return; }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setRoster(json.roster);
    setRole(json.role);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setShowLogin(true); setLoading(false); return; }
      await fetchRoster();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 未出席会員をワンタップで手動チェックイン（既存の members API を再利用）
  async function handleManualCheckin(memberId: string) {
    setCheckingId(memberId);
    setActionError("");
    try {
      const res = await fetch("/api/gym/robust/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, manual_checkin: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "チェックインに失敗しました");
      }
      setRoster(prev => prev.map(m => (m.id === memberId ? { ...m, checked_in_today: true } : m)));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCheckingId(null);
    }
  }

  if (showLogin) {
    return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); setLoading(true); fetchRoster(); }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const presentCount = roster.filter(m => m.checked_in_today).length;
  const absentCount = roster.length - presentCount;
  const visible = onlyAbsent ? roster.filter(m => !m.checked_in_today) : roster;
  const todayLabel = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">出欠確認</h1>
          <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white">← ダッシュボード</a>
        </div>
        <p className="text-zinc-500 text-xs mb-5">
          {todayLabel}
          {role && <span className="ml-2 text-zinc-600">/ {ROLE_LABEL[role] ?? role}</span>}
        </p>

        {/* サマリ */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
            <p className="text-xs text-zinc-500 mt-1">出席</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-300">{absentCount}</p>
            <p className="text-xs text-zinc-500 mt-1">未出席</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{roster.length}</p>
            <p className="text-xs text-zinc-500 mt-1">在籍</p>
          </div>
        </div>

        {/* フィルタ */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setOnlyAbsent(v => !v)}
            className={`text-xs rounded-lg px-3 min-h-[44px] transition-colors ${onlyAbsent ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:text-white"}`}
          >
            {onlyAbsent ? "未出席のみ表示中" : "未出席だけ表示"}
          </button>
          {actionError && <span className="text-red-400 text-xs">{actionError}</span>}
        </div>

        {/* 一覧 */}
        {visible.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">{onlyAbsent ? "未出席の会員はいません 🎉" : "在籍会員がいません"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(m => (
              <div key={m.id} className="bg-zinc-900 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden="true">{m.checked_in_today ? "✅" : "⬜"}</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate" title={m.name}>{m.name}</p>
                    <p className="text-zinc-500 text-xs">{PLAN_LABEL[m.plan_type] ?? m.plan_type}</p>
                  </div>
                </div>
                {m.checked_in_today ? (
                  <span className="text-emerald-400 text-xs shrink-0 whitespace-nowrap">出席済み</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleManualCheckin(m.id)}
                    disabled={checkingId === m.id}
                    className="shrink-0 min-h-[44px] px-4 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap"
                  >
                    {checkingId === m.id ? "..." : "チェック"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
