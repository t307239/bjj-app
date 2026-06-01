"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan_type: string;
  plan_cap: number | null;
  status: string;
  payment_method: string;
  insurance_expires_at: string | null;
  is_minor: boolean;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム",
  twice_weekly: "週2回",
  drop_in: "ドロップイン",
};

const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  paused: "休会中",
  cancelled: "退会",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function AdminMembersPage() {
  const supabase = createRobustClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editPlan, setEditPlan] = useState<string>("");
  const [editCap, setEditCap] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  async function fetchMembers() {
    const res = await fetch("/api/gym/robust/members");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { setShowLogin(true); setLoading(false); return; }
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setMembers(json.members);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setShowLogin(true); setLoading(false); return; }
      await fetchMembers();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (signInError) throw signInError;
      setShowLogin(false);
      setLoading(true);
      await fetchMembers();
    } catch (err) {
      setLoginError((err as Error).message);
    }
  }

  function startEdit(m: Member) {
    setEditing(m.id);
    setEditStatus(m.status);
    setEditPlan(m.plan_type);
    setEditCap(m.plan_cap != null ? String(m.plan_cap) : "");
    setSaveError("");
  }

  async function handleSave(memberId: string) {
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, unknown> = { memberId, status: editStatus, plan_type: editPlan };
      if (editPlan === "twice_weekly") {
        body.plan_cap = editCap ? parseInt(editCap) : 8;
      } else {
        body.plan_cap = null;
      }
      const res = await fetch("/api/gym/robust/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "保存に失敗しました");
      }
      setMembers(prev => prev.map(m => m.id === memberId
        ? { ...m, status: editStatus, plan_type: editPlan, plan_cap: body.plan_cap as number | null }
        : m
      ));
      setEditing(null);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-bold text-white text-center mb-6">ROBUST 柔術 — 管理者ログイン</h1>
          <form onSubmit={handleLogin} className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="m-email" className="block text-xs text-zinc-400 mb-1">メールアドレス</label>
              <input id="m-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                required autoComplete="email"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="m-pw" className="block text-xs text-zinc-400 mb-1">パスワード</label>
              <input id="m-pw" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                required autoComplete="current-password"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm">ログイン</button>
          </form>
        </div>
      </div>
    );
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

  const activeCount = members.filter(m => m.status === "active").length;
  const pausedCount = members.filter(m => m.status === "paused").length;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">会員管理</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ROBUST 柔術</p>
          </div>
          <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white">← ダッシュボード</a>
        </div>

        {/* サマリ */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{members.length}</p>
            <p className="text-xs text-zinc-500 mt-1">総会員</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-xs text-zinc-500 mt-1">有効</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{pausedCount}</p>
            <p className="text-xs text-zinc-500 mt-1">休会中</p>
          </div>
        </div>

        {/* 会員リスト */}
        {members.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">会員がいません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                {editing === m.id ? (
                  /* 編集モード */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium">{m.name}</p>
                      <p className="text-zinc-500 text-xs">{m.email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">ステータス</label>
                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                          <option value="active">有効</option>
                          <option value="paused">休会中</option>
                          <option value="cancelled">退会</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">プラン</label>
                        <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
                          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                          <option value="fulltime">フルタイム</option>
                          <option value="twice_weekly">週2回</option>
                          <option value="drop_in">ドロップイン</option>
                        </select>
                      </div>
                    </div>
                    {editPlan === "twice_weekly" && (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">月上限回数</label>
                        <input type="number" value={editCap} onChange={e => setEditCap(e.target.value)}
                          min={1} max={99} placeholder="8"
                          className="w-32 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                    )}
                    {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleSave(m.id)} disabled={saving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded-lg py-2 font-medium">
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg py-2">
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 表示モード */
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium text-sm">{m.name}</p>
                        {m.is_minor && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">未成年</span>}
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[m.status] ?? "bg-zinc-700 text-zinc-400"}`}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">{m.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span>{PLAN_LABEL[m.plan_type] ?? m.plan_type}</span>
                        {m.plan_cap != null && <span>上限{m.plan_cap}回/月</span>}
                        {m.phone && <span>{m.phone}</span>}
                        <span>{m.payment_method === "stripe" ? "カード" : "口座振替"}</span>
                      </div>
                    </div>
                    <button onClick={() => startEdit(m)}
                      className="ml-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3"
                      aria-label={`${m.name}を編集`}>
                      編集
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
