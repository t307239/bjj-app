"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

export default function ResetPasswordPage() {
  const supabase = createRobustClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Why: Supabase は URL の recovery token を非同期で処理する。
    //      getSession() を即時呼ぶと token 処理完了前に false になり「期限切れ」が誤表示される。
    //      onAuthStateChange の PASSWORD_RECOVERY イベントを待つのが確実。
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasSession(true);
      }
    });
    // フォールバック: すでにセッションがある場合
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("パスワードが一致しません"); return; }
    if (password.length < 8) { setError("8文字以上で入力してください"); return; }
    setError("");
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-white">ROBUST 柔術</h1>
          <p className="text-zinc-500 text-sm mt-1">パスワードの再設定</p>
        </div>
        {done ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 text-center space-y-3">
            <p className="text-emerald-400 text-sm">✓ パスワードを更新しました</p>
            <a href="/gym/robust/admin" className="block text-emerald-400 text-sm underline mt-2">
              管理画面へ戻る
            </a>
          </div>
        ) : !hasSession ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-red-400 text-sm">リンクの有効期限が切れています</p>
            <a href="/gym/robust/admin" className="block text-zinc-400 text-xs mt-3 underline">
              ← ログインページへ
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="new-pw" className="block text-xs text-zinc-400 mb-1">新しいパスワード（8文字以上）</label>
              <input id="new-pw" type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="block text-xs text-zinc-400 mb-1">パスワードの確認</label>
              <input id="confirm-pw" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm">
              {submitting ? "更新中..." : "パスワードを更新する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
