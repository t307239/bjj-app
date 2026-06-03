"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import { createRobustClient } from "@/lib/robust/supabase";

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
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム", twice_weekly: "週2回", drop_in: "ドロップイン",
};

export default function MemberProfilePage() {
  const supabase = createRobustClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [sportsHistory, setSportsHistory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const saveMsgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }
      const res = await fetch("/api/gym/robust/member/profile");
      if (!res.ok) { setError("プロフィールの取得に失敗しました"); setLoading(false); return; }
      const json = await res.json();
      setProfile(json.member);
      setPhone(json.member.phone ?? "");
      setAddress(json.member.address ?? "");
      setSportsHistory(json.member.sports_history ?? "");
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
        body: JSON.stringify({ phone: phone || null, address: address || null, sports_history: sportsHistory || null }),
      });
      if (res.ok) {
        setProfile(p => p ? { ...p, phone: phone || null, address: address || null, sports_history: sportsHistory || null } : p);
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
          <div className="flex gap-4 mt-3 text-xs text-zinc-500">
            <span>{PLAN_LABEL[profile.plan_type] ?? profile.plan_type}</span>
            <span>入会: {new Date(profile.created_at).toLocaleDateString("ja-JP")}</span>
            {profile.video_access && <span className="text-emerald-500">動画あり</span>}
          </div>
        </div>

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
              <div>
                <label className="block text-xs text-zinc-400 mb-1">運動経歴・格闘技歴</label>
                <textarea value={sportsHistory} onChange={e => setSportsHistory(e.target.value)} rows={2} maxLength={500}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" />
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
              <div><span className="text-zinc-500 text-xs">運動経歴</span><p className="text-white text-xs mt-0.5">{profile.sports_history || "未登録"}</p></div>
            </div>
          )}
          {saveMsg && <p className="text-emerald-400 text-xs mt-2">{saveMsg}</p>}
        </div>

        {/* リンク */}
        <div className="space-y-2">
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
      </div>
    </div>
  );
}
