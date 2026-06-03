"use client";

import { useState } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Props = {
  onSuccess: () => void;
};

/**
 * ROBUST 管理者ログインフォーム（共通コンポーネント）
 * admin/page.tsx, admin/members/page.tsx, admin/videos/page.tsx で共用
 */
export default function RobustAdminLoginForm({ onSuccess }: Props) {
  const supabase = createRobustClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onSuccess();
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
          <p className="text-zinc-500 text-sm mt-1">管理者ログイン</p>
        </div>
        <form onSubmit={handleLogin} className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="robust-admin-email" className="block text-xs text-zinc-400 mb-1">メールアドレス</label>
            <input
              id="robust-admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label htmlFor="robust-admin-password" className="block text-xs text-zinc-400 mb-1">パスワード</label>
            <input
              id="robust-admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
