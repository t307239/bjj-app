"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";
import RobustAccessDenied from "@/components/robust/RobustAccessDenied";
import RobustBeltBar from "@/components/robust/RobustBeltBar";
import RobustPhotoLightbox from "@/components/robust/RobustPhotoLightbox";
import { PLAN_LABEL, STATUS_LABEL, STATUS_COLOR, type Promotion } from "@/lib/robust/labels";
import AttendanceCsvExport from "@/components/robust/admin/AttendanceCsvExport";
import DriveAccessPanel from "@/components/robust/admin/DriveAccessPanel";
import MemberEditForm, { type MemberEditValues } from "@/components/robust/admin/MemberEditForm";
import CardLinkPanel from "@/components/robust/admin/CardLinkPanel";
import MemberDetailPanel from "@/components/robust/admin/MemberDetailPanel";

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

export default function AdminMembersPage() {
  const supabase = createRobustClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  // 昇格履歴（依頼書 Section 10）: 詳細を開いた会員の履歴をオンデマンド取得してキャッシュ
  const [detailHistory, setDetailHistory] = useState<Promotion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // 会員写真アップロード進行状態
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  // 本人確認用の写真拡大（ライトボックス）
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; name: string } | null>(null);
  // カード登録リンク発行（非カード会員→カード切替）: 発行パネルを開いている会員
  const [cardLinkFor, setCardLinkFor] = useState<string | null>(null);
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  // インライン操作（手動チェックイン / 家族割引承認却下 / 再入会）の進行状態とフィードバック
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; ok: boolean } | null>(
    null,
  );

  async function fetchMembers() {
    const res = await fetch("/api/gym/robust/members");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setShowLogin(true);
        setLoading(false);
        return;
      }
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setShowLogin(true);
        setLoading(false);
        return;
      }
      await fetchMembers();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(m: Member) {
    setEditing(m.id);
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
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
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
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, photo_url: json.url } : m)),
      );
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
      setMembers((prev) => prev.map((m) => (m.id === memberId ? applyLocal(m) : m)));
      setActionMsg({ id: memberId, text: successText, ok: true });
    } catch (err) {
      setActionMsg({ id: memberId, text: (err as Error).message, ok: false });
    } finally {
      setActioningId(null);
    }
  }

  // ① 家族割引 承認/却下: Stripe coupon も API 側で同期される
  function handleFamilyDecision(memberId: string, approved: boolean) {
    patchMember(
      memberId,
      { family_discount_approved: approved },
      (m) => ({ ...m, family_discount: approved }),
      approved ? "家族割引を承認しました" : "家族割引を却下しました",
    );
  }

  // ③ 再入会: 退会済み会員を1クリックで有効化
  function handleRejoin(memberId: string) {
    patchMember(
      memberId,
      { status: "active" },
      (m) => ({ ...m, status: "active" }),
      "再入会を完了しました",
    );
  }

  // 動画閲覧権限をワンタップでON/OFF
  function handleToggleVideo(memberId: string, current: boolean) {
    patchMember(
      memberId,
      { video_access: !current },
      (m) => ({ ...m, video_access: !current }),
      !current ? "動画閲覧をONにしました" : "動画閲覧をOFFにしました",
    );
  }

  async function handleSave(memberId: string, values: MemberEditValues) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/gym/robust/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, ...values }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "保存に失敗しました");
      }
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...values } : m)));
      setEditing(null);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (showLogin) {
    return (
      <RobustAdminLoginForm
        onSuccess={() => {
          setShowLogin(false);
          setLoading(true);
          fetchMembers();
        }}
      />
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
      <RobustAccessDenied
        message={error}
        onLogin={() => {
          setError("");
          setShowLogin(true);
        }}
      />
    );
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const pausedCount = members.filter((m) => m.status === "paused").length;

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
            {/* 会員マスタCSV（事業継続・引き継ぎ用）。同一オリジンのGETでCookieセッションによりAPI認証される。 */}
            <a
              href="/api/gym/robust/export"
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 whitespace-nowrap"
              title="会員データ（連絡先・プラン等）をCSVでダウンロード"
            >
              ⬇ 会員CSV
            </a>
            <a
              href="/gym/robust/admin"
              className="text-zinc-400 text-xs hover:text-white whitespace-nowrap"
            >
              ← ダッシュボード
            </a>
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

        <AttendanceCsvExport />

        <DriveAccessPanel members={members} />

        {/* 会員リスト */}
        {members.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">会員がいません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                {editing === m.id ? (
                  /* 編集モード */
                  <MemberEditForm
                    member={m}
                    saving={saving}
                    saveError={saveError}
                    onSave={(values) => handleSave(m.id, values)}
                    onCancel={() => setEditing(null)}
                  />
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
                              onClick={() =>
                                setZoomPhoto({ url: m.photo_url as string, name: m.name })
                              }
                              className="rounded-full cursor-zoom-in"
                              title="クリックで拡大"
                              aria-label={`${m.name} の写真を拡大`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.photo_url}
                                alt={m.name}
                                className="w-14 h-14 rounded-full object-cover bg-zinc-800"
                              />
                            </button>
                            <label
                              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center cursor-pointer border border-zinc-900 text-[11px] leading-none"
                              title="写真を変更"
                            >
                              <span aria-hidden="true">✎</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={uploadingPhotoId === m.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePhotoUpload(m.id, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <label className="cursor-pointer" title="クリックで写真を登録">
                            <span className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-lg">
                              {m.name.charAt(0)}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={uploadingPhotoId === m.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePhotoUpload(m.id, f);
                                e.currentTarget.value = "";
                              }}
                            />
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
                          {m.name_kana && (
                            <span className="text-zinc-500 text-xs">（{m.name_kana}）</span>
                          )}
                          {m.is_minor && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              未成年
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[m.status] ?? "bg-zinc-700 text-zinc-400"}`}
                          >
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
                              className={
                                m.family_discount_warning
                                  ? "text-yellow-400"
                                  : m.family_discount
                                    ? "text-blue-400"
                                    : "text-amber-400"
                              }
                              title={
                                m.family_discount_warning
                                  ? `⚠️ 同じ氏名「${m.family_member_name}」を複数会員が申請しています。確認が必要です。`
                                  : `家族割引 ${m.family_discount ? "適用中" : "申請中（未適用）"}: ${m.family_member_name}さんと同世帯`
                              }
                            >
                              {m.family_discount_warning ? "⚠️" : "👨‍👩‍👦"} {m.family_member_name}
                              {m.family_discount ? "（適用中）" : "（申請中）"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      {(m.address ||
                        m.sports_history ||
                        m.birth_date ||
                        m.emergency_contact_name ||
                        m.emergency_contact_phone ||
                        m.medical_notes ||
                        m.chronic_conditions ||
                        m.allergies ||
                        m.injury_history ||
                        m.blood_type) && (
                        <button
                          type="button"
                          onClick={() => toggleDetail(m)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-2"
                          aria-label={`${m.name}の詳細`}
                        >
                          詳細
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3"
                        aria-label={`${m.name}を編集`}
                      >
                        編集
                      </button>
                    </div>
                  </div>
                )}
                {/* アクション行（手動チェックイン / 家族割引承認却下 / 再入会） */}
                {editing !== m.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2 items-center">
                    {/* 出席取り（手動チェックイン・取消）は出欠確認画面に一本化。会員管理は情報管理に専念。 */}
                    {/* 動画閲覧権限のワンタップ切替 */}
                    <button
                      type="button"
                      disabled={actioningId === m.id}
                      onClick={() => handleToggleVideo(m.id, m.video_access)}
                      className={`min-h-[44px] px-3 text-xs disabled:opacity-40 rounded-lg whitespace-nowrap ${m.video_access ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}
                    >
                      {m.video_access ? "🎬 動画ON（OFFにする）" : "🎬 動画OFF（ONにする）"}
                    </button>
                    {/* カード登録リンク発行: 非カード会員(口座振替等)をカード払いに切り替える。オーナーが
                        プランを選んでリンク発行→会員に送る→会員がカード登録で翌月からカード課金。 */}
                    {m.payment_method !== "stripe" && m.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => setCardLinkFor(cardLinkFor === m.id ? null : m.id)}
                        className="min-h-[44px] px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg whitespace-nowrap"
                      >
                        💳 カード登録リンク
                      </button>
                    )}
                    {/* ③ 再入会: 退会済みのみ表示 */}
                    {m.status === "cancelled" && (
                      <button
                        type="button"
                        disabled={actioningId === m.id}
                        onClick={() => handleRejoin(m.id)}
                        className="min-h-[44px] px-3 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap"
                      >
                        ↩ 再入会
                      </button>
                    )}
                    {/* ① 家族割引: 申請（氏名入力）があれば表示。未適用なら承認、適用中なら解除 */}
                    {m.family_member_name && !m.family_discount && (
                      <>
                        <button
                          type="button"
                          disabled={actioningId === m.id}
                          onClick={() => handleFamilyDecision(m.id, true)}
                          className="min-h-[44px] px-3 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg whitespace-nowrap"
                        >
                          👨‍👩‍👦 家族割引を承認
                        </button>
                        <button
                          type="button"
                          disabled={actioningId === m.id}
                          onClick={() => handleFamilyDecision(m.id, false)}
                          className="min-h-[44px] px-3 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg whitespace-nowrap"
                        >
                          却下
                        </button>
                      </>
                    )}
                    {m.family_member_name && m.family_discount && (
                      <button
                        type="button"
                        disabled={actioningId === m.id}
                        onClick={() => handleFamilyDecision(m.id, false)}
                        className="min-h-[44px] px-3 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg whitespace-nowrap"
                      >
                        家族割引を解除
                      </button>
                    )}
                    {actionMsg?.id === m.id && (
                      <span
                        className={`text-xs ${actionMsg.ok ? "text-emerald-400" : "text-red-400"}`}
                        role="status"
                      >
                        {actionMsg.text}
                      </span>
                    )}
                  </div>
                )}
                {/* カード登録リンク発行パネル */}
                {editing !== m.id && cardLinkFor === m.id && <CardLinkPanel memberId={m.id} />}
                {/* 詳細情報パネル（生年月日・住所・緊急連絡先・運動経歴・既往症） */}
                {detailMember?.id === m.id && editing !== m.id && (
                  <MemberDetailPanel
                    member={m}
                    history={detailHistory}
                    historyLoading={historyLoading}
                  />
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
