"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";
import RobustAccessDenied from "@/components/robust/RobustAccessDenied";
import RobustBeltBar from "@/components/robust/RobustBeltBar";
import RobustPhotoLightbox from "@/components/robust/RobustPhotoLightbox";

type Member = {
  id: string;
  name: string;
  name_kana: string | null;
  email: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  sports_history: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  medical_notes: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  injury_history: string | null;
  blood_type: string | null;
  belt: string;
  stripes: number;
  photo_url: string | null;
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
  twice_weekly: "月8回",
  drop_in: "ドロップイン",
};

const BELT_LABEL: Record<string, string> = {
  white: "白帯",
  blue: "青帯",
  purple: "紫帯",
  brown: "茶帯",
  black: "黒帯",
};

type Promotion = {
  id: string;
  belt: string;
  stripes: number;
  promoted_on: string;
  note: string | null;
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
  const [editBelt, setEditBelt] = useState<string>("white");
  const [editStripes, setEditStripes] = useState<number>(0);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  // 昇格履歴（依頼書 Section 10）: 詳細を開いた会員の履歴をオンデマンド取得してキャッシュ
  const [detailHistory, setDetailHistory] = useState<Promotion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // 会員写真アップロード進行状態
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  // 本人確認用の写真拡大（ライトボックス）
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; name: string } | null>(null);
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
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
    setEditBelt(m.belt);
    setEditStripes(m.stripes);
    setSaveError("");
  }

  // 詳細パネルの開閉。開くときだけ昇格履歴をオンデマンド取得（一覧APIを N+1 で重くしない）。
  async function toggleDetail(m: Member) {
    if (detailMember?.id === m.id) {
      setDetailMember(null);
      return;
    }
    setDetailMember(m);
    setDetailHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/gym/robust/members/history?memberId=${m.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailHistory(json.history ?? []);
      }
      // 履歴取得失敗は詳細表示自体は妨げない（履歴セクションを空表示にとどめる）
    } finally {
      setHistoryLoading(false);
    }
  }

  // 会員写真アップロード: File → base64 → API。成功で一覧の photo_url を即時更新。
  async function handlePhotoUpload(memberId: string, file: File) {
    if (file.size > MAX_PHOTO_BYTES) {
      setActionMsg({ id: memberId, text: "画像は5MBまでです", ok: false });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setActionMsg({ id: memberId, text: "JPEG/PNG/WebPのみ対応です", ok: false });
      return;
    }
    setUploadingPhotoId(memberId);
    setActionMsg(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "");
        reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/gym/robust/members/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, contentType: file.type, imageBase64: base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "アップロードに失敗しました");
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, photo_url: json.url } : m));
      setActionMsg({ id: memberId, text: "写真を更新しました", ok: true });
    } catch (err) {
      setActionMsg({ id: memberId, text: (err as Error).message, ok: false });
    } finally {
      setUploadingPhotoId(null);
    }
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

  // 動画閲覧権限をワンタップでON/OFF
  function handleToggleVideo(memberId: string, current: boolean) {
    patchMember(
      memberId,
      { video_access: !current },
      m => ({ ...m, video_access: !current }),
      !current ? "動画閲覧をONにしました" : "動画閲覧をOFFにしました",
    );
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
        belt: editBelt,
        stripes: editStripes,
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
        ? { ...m, status: editStatus, plan_type: editPlan, plan_cap: body.plan_cap as number | null, video_access: editVideoAccess, payment_method: editPaymentMethod, belt: editBelt, stripes: editStripes }
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
    return <RobustAccessDenied message={error} onLogin={() => { setError(""); setShowLogin(true); }} />;
  }

  const activeCount = members.filter(m => m.status === "active").length;
  const pausedCount = members.filter(m => m.status === "paused").length;

  // 動画アクセス（手動 Drive 共有）管理リスト
  // Why: 動画は Drive フォルダを各会員の Google アカウントに手動共有する運用。
  //      アプリの動画リンクは status==active かつ video_access でゲートされるが、
  //      手動共有した Drive 権限はアプリのゲートが効かない（退会後も直接閲覧可能）。
  //      「共有すべき人」「権限を外すべき人」を可視化し剥奪忘れの事故を防ぐ。
  const driveShareTargets = members.filter(m => m.status === "active" && m.video_access);
  const driveRevokeTargets = members.filter(m => m.video_access && m.status !== "active");

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">会員管理</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ROBUST 柔術</p>
          </div>
          <div className="flex items-center gap-3">
            {/* CSVエクスポート（事業継続・引き継ぎ用）。同一オリジンのGETでCookieセッションによりAPI認証される。 */}
            <a
              href="/api/gym/robust/export"
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 whitespace-nowrap"
              title="会員データをCSVでダウンロード"
            >
              ⬇ CSVエクスポート
            </a>
            <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white whitespace-nowrap">← ダッシュボード</a>
          </div>
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

        {/* 動画アクセス（Drive 共有）管理 */}
        {(driveShareTargets.length > 0 || driveRevokeTargets.length > 0) && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-medium text-white mb-1">📹 動画アクセス（Drive 共有管理）</h2>
            <p className="text-zinc-500 text-xs mb-3">
              動画フォルダを各会員の Google アカウントに手動共有する運用です。下記を Drive の共有設定に反映してください。
            </p>

            {driveRevokeTargets.length > 0 && (
              <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-red-400 text-xs font-medium mb-1">
                  ⚠️ Drive 権限を外す（{driveRevokeTargets.length}名）— 退会・休会したが動画ONのまま
                </p>
                <ul className="space-y-1">
                  {driveRevokeTargets.map(m => (
                    <li key={m.id} className="text-xs text-zinc-300 flex items-center gap-2 flex-wrap">
                      <span>{m.name}</span>
                      <span className="text-zinc-500">{m.email}</span>
                      <span className="text-red-400">（{STATUS_LABEL[m.status] ?? m.status}）</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-emerald-400 text-xs font-medium mb-1">
                ✅ Drive を共有する対象（{driveShareTargets.length}名）— 有効かつ動画ON
              </p>
              {driveShareTargets.length === 0 ? (
                <p className="text-zinc-500 text-xs">対象なし</p>
              ) : (
                <ul className="space-y-1">
                  {driveShareTargets.map(m => (
                    <li key={m.id} className="text-xs text-zinc-300 flex items-center gap-2 flex-wrap">
                      <span>{m.name}</span>
                      <span className="text-zinc-500">{m.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

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
                          <option value="twice_weekly">月8回</option>
                          <option value="drop_in">ドロップイン</option>
                        </select>
                      </div>
                    </div>
                    {/* Why: プラン変更は cap/超過の判定には効くが、Stripe の月額請求は自動で変わらない。
                            （プラン種別だけでは男女別価格を確定できず自動同期できない）。誤解防止の注意書き。 */}
                    {editPlan !== m.plan_type && (
                      <p className="text-amber-400 text-xs bg-amber-500/10 rounded-lg px-3 py-2">
                        ※ プラン変更は月額（Stripe）の請求額には自動反映されません。金額の変更が必要な場合は Stripe 側で行ってください。
                      </p>
                    )}
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
                    {/* 帯・ストライプ（依頼書 Section 9）。保存時に変更があれば昇格履歴に自動記録される。 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">帯</label>
                        <select value={editBelt} onChange={e => setEditBelt(e.target.value)}
                          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                          <option value="white">白帯</option>
                          <option value="blue">青帯</option>
                          <option value="purple">紫帯</option>
                          <option value="brown">茶帯</option>
                          <option value="black">黒帯</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">ストライプ</label>
                        <select value={String(editStripes)} onChange={e => setEditStripes(parseInt(e.target.value))}
                          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                          <option value="0">0本</option>
                          <option value="1">1本</option>
                          <option value="2">2本</option>
                          <option value="3">3本</option>
                          <option value="4">4本</option>
                        </select>
                      </div>
                    </div>
                    {(editBelt !== m.belt || editStripes !== m.stripes) && (
                      <p className="text-emerald-400 text-xs bg-emerald-500/10 rounded-lg px-3 py-2">
                        ※ 保存すると昇格履歴に記録されます（{BELT_LABEL[m.belt] ?? m.belt}{m.stripes}本 → {BELT_LABEL[editBelt] ?? editBelt}{editStripes}本）
                      </p>
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
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 会員写真（本人確認・なりすまし/過少申告対策）
                          Why: 写真ありは「タップで拡大」して氏名↔顔を照合、右下の鉛筆で変更。
                               写真なしはアバター全体をクリックで登録（従来動作）。 */}
                      <div className="relative shrink-0">
                        {m.photo_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setZoomPhoto({ url: m.photo_url as string, name: m.name })}
                              className="rounded-full cursor-zoom-in"
                              title="クリックで拡大"
                              aria-label={`${m.name} の写真を拡大`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.photo_url} alt={m.name} className="w-14 h-14 rounded-full object-cover bg-zinc-800" />
                            </button>
                            <label className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center cursor-pointer border border-zinc-900 text-[11px] leading-none"
                              title="写真を変更">
                              <span aria-hidden="true">✎</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                disabled={uploadingPhotoId === m.id}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(m.id, f); e.currentTarget.value = ""; }} />
                            </label>
                          </>
                        ) : (
                          <label className="cursor-pointer" title="クリックで写真を登録">
                            <span className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-lg">{m.name.charAt(0)}</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                              disabled={uploadingPhotoId === m.id}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(m.id, f); e.currentTarget.value = ""; }} />
                          </label>
                        )}
                        {uploadingPhotoId === m.id && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium text-sm">{m.name}</p>
                        {m.name_kana && <span className="text-zinc-500 text-xs">（{m.name_kana}）</span>}
                        {m.is_minor && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">未成年</span>}
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[m.status] ?? "bg-zinc-700 text-zinc-400"}`}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                        <RobustBeltBar belt={m.belt} stripes={m.stripes} />
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">{m.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                        <span>{PLAN_LABEL[m.plan_type] ?? m.plan_type}</span>
                        {m.plan_cap != null && <span>上限{m.plan_cap}回/月</span>}
                        {m.phone && <span>{m.phone}</span>}
                        <span>{m.payment_method === "stripe" ? "カード" : "口座振替"}</span>
                        {m.video_access && <span className="text-emerald-500">動画あり</span>}
                        {m.family_member_name && (
                          <span
                            className={m.family_discount_warning ? "text-yellow-400" : m.family_discount ? "text-blue-400" : "text-amber-400"}
                            title={m.family_discount_warning
                              ? `⚠️ 同じ氏名「${m.family_member_name}」を複数会員が申請しています。確認が必要です。`
                              : `家族割引 ${m.family_discount ? "適用中" : "申請中（未適用）"}: ${m.family_member_name}さんと同世帯`}
                          >
                            {m.family_discount_warning ? "⚠️" : "👨‍👩‍👦"} {m.family_member_name}
                            {m.family_discount ? "（適用中）" : "（申請中）"}
                          </span>
                        )}
                      </div>
                    </div>
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      {(m.address || m.sports_history || m.birth_date || m.emergency_contact_name || m.emergency_contact_phone || m.medical_notes || m.chronic_conditions || m.allergies || m.injury_history || m.blood_type) && (
                        <button type="button" onClick={() => toggleDetail(m)}
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
                    {/* 動画閲覧権限のワンタップ切替 */}
                    <button type="button" disabled={actioningId === m.id}
                      onClick={() => handleToggleVideo(m.id, m.video_access)}
                      className={`min-h-[44px] px-3 text-xs disabled:opacity-40 rounded-lg whitespace-nowrap ${m.video_access ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}>
                      {m.video_access ? "🎬 動画ON（OFFにする）" : "🎬 動画OFF（ONにする）"}
                    </button>
                    {/* ③ 再入会: 退会済みのみ表示 */}
                    {m.status === "cancelled" && (
                      <button type="button" disabled={actioningId === m.id}
                        onClick={() => handleRejoin(m.id)}
                        className="min-h-[44px] px-3 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                        ↩ 再入会
                      </button>
                    )}
                    {/* ① 家族割引: 申請（氏名入力）があれば表示。未適用なら承認、適用中なら解除 */}
                    {m.family_member_name && !m.family_discount && (
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
                    {m.family_member_name && m.family_discount && (
                      <button type="button" disabled={actioningId === m.id}
                        onClick={() => handleFamilyDecision(m.id, false)}
                        className="min-h-[44px] px-3 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg whitespace-nowrap">
                        家族割引を解除
                      </button>
                    )}
                    {actionMsg?.id === m.id && (
                      <span className={`text-xs ${actionMsg.ok ? "text-emerald-400" : "text-red-400"}`} role="status">
                        {actionMsg.text}
                      </span>
                    )}
                  </div>
                )}
                {/* 詳細情報パネル（生年月日・住所・緊急連絡先・運動経歴・既往症） */}
                {detailMember?.id === m.id && editing !== m.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs">
                    {m.birth_date && (
                      <div>
                        <span className="text-zinc-500">生年月日: </span>
                        <span className="text-zinc-300">{m.birth_date}</span>
                      </div>
                    )}
                    {m.address && (
                      <div>
                        <span className="text-zinc-500">住所: </span>
                        <span className="text-zinc-300">{m.address}</span>
                      </div>
                    )}
                    {(m.emergency_contact_name || m.emergency_contact_phone) && (
                      <div>
                        <span className="text-zinc-500">緊急連絡先: </span>
                        <span className="text-zinc-300">
                          {m.emergency_contact_name}
                          {m.emergency_contact_relation && `（${m.emergency_contact_relation}）`}
                          {m.emergency_contact_phone && ` ${m.emergency_contact_phone}`}
                        </span>
                      </div>
                    )}
                    {m.sports_history && (
                      <div>
                        <span className="text-zinc-500">運動経歴: </span>
                        <span className="text-zinc-300">{m.sports_history}</span>
                      </div>
                    )}
                    {m.blood_type && (
                      <div>
                        <span className="text-zinc-500">血液型: </span>
                        <span className="text-zinc-300">{m.blood_type}型</span>
                      </div>
                    )}
                    {m.chronic_conditions && (
                      <div>
                        <span className="text-amber-500">持病: </span>
                        <span className="text-zinc-300">{m.chronic_conditions}</span>
                      </div>
                    )}
                    {m.allergies && (
                      <div>
                        <span className="text-amber-500">アレルギー: </span>
                        <span className="text-zinc-300">{m.allergies}</span>
                      </div>
                    )}
                    {m.injury_history && (
                      <div>
                        <span className="text-amber-500">怪我歴: </span>
                        <span className="text-zinc-300">{m.injury_history}</span>
                      </div>
                    )}
                    {m.medical_notes && (
                      <div>
                        <span className="text-amber-500">既往症・アレルギー（旧）: </span>
                        <span className="text-zinc-300">{m.medical_notes}</span>
                      </div>
                    )}
                    {/* 昇格履歴（依頼書 Section 10・管理画面の一覧表示） */}
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-zinc-500">昇格履歴: </span>
                      {historyLoading ? (
                        <span className="text-zinc-500">読み込み中…</span>
                      ) : detailHistory.length === 0 ? (
                        <span className="text-zinc-500">記録なし</span>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {detailHistory.map(pr => (
                            <li key={pr.id} className="flex items-baseline gap-2">
                              <span className="text-zinc-500 tabular-nums whitespace-nowrap">
                                {new Date(pr.promoted_on).toLocaleDateString("ja-JP")}
                              </span>
                              <span className="text-zinc-300 whitespace-nowrap">
                                {BELT_LABEL[pr.belt] ?? pr.belt}{pr.stripes > 0 ? ` ${pr.stripes}本` : ""}
                              </span>
                              {pr.note && <span className="text-zinc-500 truncate" title={pr.note}>{pr.note}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <RobustPhotoLightbox photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />
    </div>
  );
}
