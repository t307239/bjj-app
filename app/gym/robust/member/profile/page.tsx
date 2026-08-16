"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import { subscribeRobustPush, unsubscribeRobustPush, isRobustPushSubscribed } from "@/lib/robust/push";

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  sports_history: string | null;
  plan_type: string;
  status: string;
  video_access: boolean;
  belt: string;
  stripes: number;
  created_at: string;
};

const BELT_LABEL: Record<string, string> = {
  white: "白帯", blue: "青帯", purple: "紫帯", brown: "茶帯", black: "黒帯",
};

type Promotion = {
  id: string;
  belt: string;
  stripes: number;
  promoted_on: string;
  note: string | null;
};

const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム", twice_weekly: "月8回", drop_in: "ドロップイン",
};

export default function MemberProfilePage() {
  const supabase = createRobustClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const saveMsgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // プッシュ通知（依頼書 Section 15）
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushMsg, setPushMsg] = useState("");

  // この端末の購読状態を初期化（トグルの初期 ON/OFF に反映）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    let mounted = true;
    isRobustPushSubscribed()
      .then(on => { if (mounted) setPushOn(on); })
      .catch(() => { /* silent: ok — 購読状態の取得失敗時はトグルOFF初期値のまま */ });
    return () => { mounted = false; };
  }, []);

  async function handleTogglePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      if (pushOn) {
        await unsubscribeRobustPush();
        setPushOn(false);
        setPushMsg("通知をオフにしました");
      } else {
        const ok = await subscribeRobustPush();
        if (ok) {
          setPushOn(true);
          setPushMsg("通知をオンにしました");
        } else {
          // 権限拒否 or 非対応。ブラウザ設定で許可が必要な旨を案内。
          setPushMsg("通知を有効にできませんでした。ブラウザの通知許可をご確認ください。");
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }
      const res = await fetch("/api/gym/robust/member/profile");
      if (!res.ok) { setError("プロフィールの取得に失敗しました"); setLoading(false); return; }
      const json = await res.json();
      setProfile(json.member);
      setPromotions(json.promotions ?? []);
      setPhone(json.member.phone ?? "");
      setAddress(json.member.address ?? "");
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(msg: string) {
    setSaveMsg(msg);
    if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current);
    saveMsgTimerRef.current = setTimeout(() => setSaveMsg(""), 3000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/gym/robust/member/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || null, address: address || null }),
      });
      if (res.ok) {
        setProfile(p => p ? { ...p, phone: phone || null, address: address || null } : p);
        setEditing(false);
        showMsg("保存しました");
      } else {
        const json = await res.json().catch(() => ({}));
        showMsg(json.error ?? "保存に失敗しました");
      }
    } catch {
      showMsg("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" /></div>;
  if (error || !profile) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"><p className="text-red-400 text-sm">{error || "会員情報が見つかりません"}</p></div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">マイページ</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ROBUST 柔術</p>
          </div>
          <a href="/gym/robust/member/qr" className="text-zinc-400 text-xs hover:text-white">← QRコード</a>
        </div>

        {/* プラン情報 */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{profile.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{profile.email}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${profile.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>
              {profile.status === "active" ? "有効" : profile.status === "paused" ? "休会中" : "退会"}
            </span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-zinc-500 flex-wrap">
            <span>{PLAN_LABEL[profile.plan_type] ?? profile.plan_type}</span>
            <span className="text-zinc-300 whitespace-nowrap">{BELT_LABEL[profile.belt] ?? profile.belt}{profile.stripes > 0 ? ` ${profile.stripes}本` : ""}</span>
            <span>入会: {new Date(profile.created_at).toLocaleDateString("ja-JP")}</span>
            {profile.video_access && <span className="text-emerald-500">動画あり</span>}
          </div>
        </div>

        {/* 昇格履歴（依頼書 Section 10）: 記録がある場合のみ表示 */}
        {promotions.length > 0 && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-medium text-white mb-3">昇格履歴</h2>
            <ul className="space-y-2">
              {promotions.map(pr => (
                <li key={pr.id} className="flex items-baseline gap-3 text-sm">
                  <span className="text-zinc-500 text-xs whitespace-nowrap tabular-nums">
                    {new Date(pr.promoted_on).toLocaleDateString("ja-JP")}
                  </span>
                  <span className="text-white whitespace-nowrap">
                    {BELT_LABEL[pr.belt] ?? pr.belt}{pr.stripes > 0 ? ` ${pr.stripes}本` : ""}
                  </span>
                  {pr.note && <span className="text-zinc-400 text-xs truncate" title={pr.note}>{pr.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 連絡先・プロフィール */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-white">連絡先・プロフィール</h2>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)}
                className="text-xs text-zinc-400 hover:text-white bg-zinc-800 px-3 py-1.5 rounded-lg">編集</button>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">電話番号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">住所</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded-lg py-2 font-medium">
                  {saving ? "保存中..." : "保存"}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg py-2">キャンセル</button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">電話</span><span className="text-white">{profile.phone || "未登録"}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">住所</span><span className="text-white text-right max-w-[60%] truncate" title={profile.address ?? ""}>{profile.address || "未登録"}</span></div>
            </div>
          )}
          {saveMsg && <p className="text-emerald-400 text-xs mt-2">{saveMsg}</p>}
        </div>

        {/* プッシュ通知（依頼書 Section 15）: 休館・イベント・緊急連絡を受け取る */}
        {pushSupported && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm">お知らせ通知</p>
                <p className="text-zinc-500 text-xs mt-0.5">休館日・イベント・緊急連絡をこの端末で受け取る</p>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushBusy}
                role="switch"
                aria-checked={pushOn}
                aria-label="お知らせ通知の受け取り"
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${pushOn ? "bg-emerald-500" : "bg-zinc-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${pushOn ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {pushMsg && <p className="text-zinc-400 text-xs mt-2">{pushMsg}</p>}
          </div>
        )}

        {/* リンク */}
        <div className="space-y-2">
          <a href="/gym/robust/member/qr"
            className="block bg-emerald-600 hover:bg-emerald-500 rounded-xl p-4 flex items-center justify-between transition-colors">
            <span className="text-white text-sm font-medium">📱 チェックイン用QRコードを表示</span>
            <span className="text-white/80 text-xs">→</span>
          </a>
          <a href="/gym/robust/member/history"
            className="block bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/20">
            <span className="text-white text-sm">チェックイン履歴</span>
            <span className="text-zinc-500 text-xs">→</span>
          </a>
          <a href="/gym/robust/member/billing"
            className="block bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/20">
            <span className="text-white text-sm">お支払い・カード変更</span>
            <span className="text-zinc-500 text-xs">→</span>
          </a>
          <a href="/gym/robust/member/videos"
            className="block bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/20">
            <span className="text-white text-sm">会員限定動画</span>
            <span className="text-zinc-500 text-xs">→</span>
          </a>
        </div>

        {/* ログアウト */}
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/gym/robust/register"; }}
          className="w-full mt-4 min-h-[44px] text-zinc-400 hover:text-white text-sm bg-zinc-900 border border-white/10 rounded-xl"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
