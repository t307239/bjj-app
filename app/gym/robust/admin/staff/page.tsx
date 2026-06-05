"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

type Staff = {
  id: string;
  email: string;
  role: string;
  status: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  instructor: "インストラクター",
};

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-blue-500/20 text-blue-300",
  instructor: "bg-emerald-500/20 text-emerald-300",
};

export default function StaffManagePage() {
  const supabase = createRobustClient();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  // 追加フォーム
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"instructor" | "admin">("instructor");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchStaff() {
    const res = await fetch("/api/gym/robust/staff");
    if (!res.ok) {
      if (res.status === 401) { setShowLogin(true); setLoading(false); return; }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setStaff(json.staff);
    setOwnerEmail(json.owner_email);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setShowLogin(true); setLoading(false); return; }
      await fetchStaff();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/gym/robust/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "追加に失敗しました");
      setFormSuccess(`${email.trim()} を${ROLE_LABEL[role]}として追加しました`);
      setEmail("");
      await fetchStaff();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(staffId: string, staffEmail: string) {
    if (!confirm(`${staffEmail} をスタッフから外しますか？`)) return;
    setDeletingId(staffId);
    setFormError("");
    try {
      const res = await fetch("/api/gym/robust/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "削除に失敗しました");
      }
      setStaff(prev => prev.filter(s => s.id !== staffId));
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (showLogin) {
    return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); setLoading(true); fetchStaff(); }} />;
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

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">スタッフ管理</h1>
          <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white">← ダッシュボード</a>
        </div>
        <p className="text-zinc-500 text-xs mb-5">インストラクター・管理者の追加と削除ができます</p>

        {/* 追加フォーム */}
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-white/10 rounded-xl p-5 mb-6 space-y-3">
          <h2 className="text-sm font-bold text-white">スタッフを追加</h2>
          <p className="text-zinc-500 text-xs">
            追加したい人には、先に会員登録ページ（/gym/robust/register）でアカウントを作ってもらってください。
            そのメールアドレスをここに入力します。
          </p>
          <div>
            <label htmlFor="staff-email" className="block text-xs text-zinc-400 mb-1">メールアドレス</label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="instructor@example.com"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label htmlFor="staff-role" className="block text-xs text-zinc-400 mb-1">役割</label>
            <select
              id="staff-role"
              value={role}
              onChange={e => setRole(e.target.value as "instructor" | "admin")}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="instructor">インストラクター（出欠確認・手動チェックインのみ）</option>
              <option value="admin">管理者（会員管理など全機能）</option>
            </select>
          </div>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}
          {formSuccess && <p className="text-emerald-400 text-xs">{formSuccess}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
          >
            {submitting ? "追加中..." : "スタッフに追加"}
          </button>
        </form>

        {/* 一覧 */}
        <div className="space-y-2">
          {ownerEmail && (
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm truncate" title={ownerEmail}>{ownerEmail}</p>
                <p className="text-zinc-500 text-xs">オーナー</p>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded shrink-0 whitespace-nowrap">オーナー</span>
            </div>
          )}
          {staff.length === 0 ? (
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-zinc-400 text-sm">まだスタッフはいません</p>
            </div>
          ) : (
            staff.map(s => (
              <div key={s.id} className="bg-zinc-900 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm truncate" title={s.email}>{s.email}</p>
                  <p className="text-zinc-500 text-xs">{ROLE_LABEL[s.role] ?? s.role}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${ROLE_COLOR[s.role] ?? "bg-zinc-700 text-zinc-300"}`}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.email)}
                    disabled={deletingId === s.id}
                    className="min-h-[44px] px-3 text-xs text-red-300 hover:text-red-200 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg whitespace-nowrap"
                  >
                    {deletingId === s.id ? "..." : "削除"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
