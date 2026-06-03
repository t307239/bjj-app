"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  sports_history: string | null;
  video_access: boolean;
  family_discount: boolean;
  family_member_name: string | null;
  family_discount_warning: boolean;
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
  const [editVideoAccess, setEditVideoAccess] = useState<boolean>(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("stripe");
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  // インライン操作（手動チェックイン / 家族割引承認却下 / 再入会）の進行状態とフィードバック
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

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

  function startEdit(m: Member) {
    setEditing(m.id);
    setEditStatus(m.status);
    setEditPlan(m.plan_type);
    setEditCap(m.plan_cap != null ? String(m.plan_cap) : "");
    setEditVideoAccess(m.video_access);
    setEditPaymentMethod(m.payment_method);
    setSaveError("");
  }

  // インライン PATCH の共通ヘルパー。成功で会員行を patch 更新し、フィードバックを表示する。
  async function patchMember(
    memberId: string,
    payload: Record<string, unknown>,
    applyLocal: (m: Member) => Member,
    successText: string,
  ) {
    setActioningId(memberId);
    setActionMsg(null);
    try {
      const res = await fetch("/api/gym/robust/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "操作に失敗しました");
      }
      setMembers(prev => prev.map(m => (m.id === memberId ? applyLocal(m) : m)));
      setActionMsg({ id: memberId, text: successText, ok: true });
    } catch (err) {
      setActionMsg({ id: memberId, text: (err as Error).message, ok: false });
    } finally {
      setActioningId(null);
    }
  }

  // ② 手動チェックイン: その日の来館記録を1クリックで作成（DB行は増えるが会員データは不変）
  function handleManualCheckin(memberId: string) {
    patchMember(memberId, { manual_checkin: true }, m => m, "本日のチェックインを記録しました");
  }

  // ① 家族割引 承認/却下: Stripe coupon も API 側で同期される
  function handleFamilyDecision(memberId: string, approved: boolean) {
    patchMember(
      memberId,
      { family_discount_approved: approved },
      m => ({ ...m, family_discount: approved }),
      approved ? "家族割引を承認しました" : "家族割引を却下しました",
    );
  }

  // ③ 再入会: 退会済み会員を1クリックで有効化
  function handleRejoin(memberId: string) {
    patchMember(memberId, { status: "active" }, m => ({ ...m, status: "active" }), "再入会を完了しました");
  }

  async function handleSave(memberId: string) {
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, unknown> = {
        memberId,
        status: editStatus,
        plan_type: editPlan,
        video_access: editVideoAccess,
        payment_method: editPaymentMethod,
      };
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
        ? { ...m, status: editStatus, plan_type: editPlan, plan_cap: body.plan_cap as number | null, video_access: editVideoAccess, payment_method: editPaymentMethod }
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
    return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); setLoading(true); fetchMembers(); }} />;
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    {/* 動画アクセス切替 */}
                    <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-white text-sm">会員限定動画の閲覧</p>
                        <p className="text-zinc-500 text-xs mt-0.5">オンにすると動画ページにアクセス可能</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditVideoAccess(v => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${editVideoAccess ? "bg-emerald-500" : "bg-zinc-600"}`}
                        aria-label="動画アクセス切替"
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${editVideoAccess ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    {/* ⑤ 支払い方法（カード / 口座振替）切替 */}
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">支払い方法</label>
                      <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)}
                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="stripe">カード（Stripe）</option>
                        <option value="bank_transfer">口座振替</option>
                      </select>
                    </div>
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
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                        <span>{PLAN_LABEL[m.plan_type] ?? m.plan_type}</span>
                        {m.plan_cap != null && <span>上限{m.plan_cap}回/月</span>}
                        {m.phone && <span>{m.phone}</span>}
                        <span>{m.payment_method === "stripe" ? "カード" : "口座振替"}</span>
                        {m.video_access && <span className="text-emerald-500">動画あり</span>}
                        {m.family_discount && (
                          <span
                            className={m.family_discount_warning ? "text-yellow-400" : "text-blue-400"}
                            title={m.family_discount_warning
                              ? `⚠️ 同じ氏名「${m.family_member_name}」を複数会員が申請しています。確認が必要です。`
                              : `家族割引申請: ${m.family_member_name ?? ""}さんと同世帯`}
                          >
                            {m.family_discount_warning ? "⚠️" : "👨‍👩‍👦"} {m.family_member_name ?? "家族割"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      {(m.address || m.sports_history) && (
                        <button type="button" onClick={() => setDetailMember(detailMember?.id === m.id ? null : m)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-2"
                          aria-label={`${m.name}の詳細`}>
                          詳細
                        </button>
                      )}
                      <button type="button" onClick={() => startEdit(m)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3"
                        aria-label={`${m.name}を編集`}>
                        編集
                      </button>
                    </div>
                  </div>
                )}
                {/* アクション行（手動チェックイン / 家族割引承認却下 / 再入会） */}
                {editing !== m.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2 items-center">
                    {/* ② 手動チェックイン: 退会者以外に表示 */}
                    {m.status !== "cancelled" && (
                      <button type="button" disabled={actioningId === m.id}
                        onClick={() => handleManualCheckin(m.id)}
                        className="min-h-[44px] px-3 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                        ✓ 手動チェックイン
                      </button>
                    )}
                    {/* ③ 再入会: 退会済みのみ表示 */}
                    {m.status === "cancelled" && (
                      <button type="button" disabled={actioningId === m.id}
                        onClick={() => handleRejoin(m.id)}
                        className="min-h-[44px] px-3 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                        ↩ 再入会
                      </button>
                    )}
                    {/* ① 家族割引 承認/却下: 申請中(family_discount=true)のみ表示 */}
                    {m.family_discount && (
                      <>
                        <button type="button" disabled={actioningId === m.id}
                          onClick={() => handleFamilyDecision(m.id, true)}
                          className="min-h-[44px] px-3 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                          👨‍👩‍👦 家族割引を承認
                        </button>
                        <button type="button" disabled={actioningId === m.id}
                          onClick={() => handleFamilyDecision(m.id, false)}
                          className="min-h-[44px] px-3 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                          却下
                        </button>
                      </>
                    )}
                    {actionMsg?.id === m.id && (
                      <span className={`text-xs ${actionMsg.ok ? "text-emerald-400" : "text-red-400"}`} role="status">
                        {actionMsg.text}
                      </span>
                    )}
                  </div>
                )}
                {/* 詳細情報パネル（住所・運動経歴） */}
                {detailMember?.id === m.id && editing !== m.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs">
                    {m.address && (
                      <div>
                        <span className="text-zinc-500">住所: </span>
                        <span className="text-zinc-300">{m.address}</span>
                      </div>
                    )}
                    {m.sports_history && (
                      <div>
                        <span className="text-zinc-500">運動経歴: </span>
                        <span className="text-zinc-300">{m.sports_history}</span>
                      </div>
                    )}
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
