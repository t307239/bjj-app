"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import RobustAdminLoginForm from "@/components/robust/RobustAdminLoginForm";

// 依頼書 Section 15: 休館・イベント・緊急連絡の一斉プッシュ配信（オーナー/スタッフ）
// よく使う雛形。選ぶと件名・本文の初期値が入る（そのまま編集可）。
const TEMPLATES: { label: string; title: string; body: string; urgent: boolean }[] = [
  { label: "休館のお知らせ", title: "【休館のお知らせ】", body: "本日は休館です。ご確認ください。", urgent: false },
  { label: "イベント・セミナー", title: "【イベント告知】", body: "セミナーの受付を開始しました。詳細はアプリをご確認ください。", urgent: false },
  { label: "緊急連絡", title: "【緊急連絡】", body: "本日は臨時休館します。ご注意ください。", urgent: true },
];

type SendResult = { total: number; sent: number; failed: number; staleRemoved: number };

export default function NotifyPage() {
  const supabase = createRobustClient();
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setShowLogin(true); setLoading(false); return; }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTitle(t.title);
    setBody(t.body);
    setUrgent(t.urgent);
    setResult(null);
    setError("");
  }

  async function handleSend() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/gym/robust/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), urgent }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "送信に失敗しました"); return; }
      setResult({ total: json.total, sent: json.sent, failed: json.failed, staleRemoved: json.staleRemoved });
    } catch {
      setError("通信に失敗しました。時間をおいて再試行してください。");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" /></div>;
  if (showLogin) return <RobustAdminLoginForm onSuccess={() => { setShowLogin(false); }} />;

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">お知らせ配信</h1>
          <a href="/gym/robust/admin" className="text-zinc-400 text-xs hover:text-white">← 管理トップ</a>
        </div>

        <p className="text-zinc-500 text-xs mb-4">通知をオンにしている有効会員の端末に、休館・イベント・緊急連絡をプッシュ配信します。</p>

        {/* 雛形 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TEMPLATES.map(t => (
            <button key={t.label} type="button" onClick={() => applyTemplate(t)}
              className="min-h-[36px] px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 space-y-3">
          <div>
            <label htmlFor="notify-title" className="block text-xs text-zinc-400 mb-1">件名</label>
            <input id="notify-title" type="text" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={100} placeholder="【休館のお知らせ】"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label htmlFor="notify-body" className="block text-xs text-zinc-400 mb-1">本文</label>
            <textarea id="notify-body" value={body} onChange={e => setBody(e.target.value)}
              rows={4} maxLength={500} placeholder="本日は休館です。ご確認ください。"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-zinc-300">緊急連絡（深夜帯 22:00〜8:00 でも送信する）</span>
          </label>

          {error && <p className="text-red-400 text-xs" role="alert">{error}</p>}
          {result && (
            <p className="text-emerald-400 text-xs" role="status">
              送信完了：対象 {result.total} 件中 {result.sent} 件に配信（失敗 {result.failed} 件{result.staleRemoved > 0 ? `・無効 ${result.staleRemoved} 件を整理` : ""}）
            </p>
          )}

          <button type="button" onClick={handleSend} disabled={!canSend}
            className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded-lg font-medium">
            {sending ? "送信中…" : "この内容で配信する"}
          </button>
        </div>

        <p className="text-zinc-600 text-[11px] mt-3">※ 通知は「お知らせ通知」をオンにしている会員のみに届きます。連続送信は1分間に1回までです。</p>
      </div>
    </div>
  );
}
