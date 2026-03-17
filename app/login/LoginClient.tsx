"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  auth: "認証に失敗しました。もう一度お試しください。",
  callback: "ログインエラーが発生しました。再度お試しください。",
  access_denied: "アクセスが拒否されました。",
};

function ErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  if (!error) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm text-center">
      {errorMessages[error] ?? "エラーが発生しました。もう一度お試しください。"}
    </div>
  );
}

function LoginForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const sendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!email || !email.includes("@")) {
      setEmailError("有効なメールアドレスを入力してください");
      return;
    }
    setEmailLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setEmailError("メール送信に失敗しました。もう一度お試しください。");
    } else {
      setEmailSent(true);
    }
    setEmailLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#1a1a2e]">
      <div className="w-full max-w-sm">

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥋</div>
          <h1 className="text-2xl font-bold text-white">BJJ App をはじめる</h1>
          <p className="text-gray-400 mt-2 text-sm">
            初めての方も、ログインの方も同じボタンでOK
          </p>
        </div>

        <Suspense fallback={null}>
          <ErrorBanner />
        </Suspense>

        <div className="bg-[#16213e] rounded-2xl p-6 border border-gray-700 space-y-3">

          {/* Google — 最も一般的なので最上位 */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google アカウントで続ける</span>
          </button>

          {/* 区切り */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-xs">またはメールで</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* メール送信済み */}
          {emailSent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-5 text-center">
              <div className="text-3xl mb-2">📬</div>
              <p className="text-green-400 text-sm font-semibold">メールを送りました！</p>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                <span className="text-white">{email}</span> に<br />
                ログイン用のリンクを送りました。<br />
                メールを開いてリンクをタップしてください。
              </p>
              <p className="text-gray-600 text-xs mt-3">
                ※ 届かない場合は迷惑メールフォルダもご確認ください
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail(""); }}
                className="text-gray-500 text-xs mt-4 hover:text-gray-300 transition-colors underline"
              >
                別のメールアドレスで試す
              </button>
            </div>
          ) : (
            <form onSubmit={sendEmailLink} className="space-y-2">
              {emailError && (
                <p className="text-red-400 text-xs px-1">{emailError}</p>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                autoComplete="email"
                className="w-full bg-[#0f3460] text-white rounded-xl px-4 py-3 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={emailLoading}
                className="w-full bg-[#e94560] hover:bg-[#c73652] text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {emailLoading ? "送信中..." : "ログインリンクをメールで受け取る"}
              </button>
              <p className="text-[11px] text-gray-600 text-center pt-0.5">
                パスワード不要 · 登録も同時にできます
              </p>
            </form>
          )}

          {/* GitHub — 開発者向けとして下に小さく */}
          <div className="pt-1 border-t border-gray-800">
            <button
              onClick={signInWithGitHub}
              className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 py-2 px-4 rounded-xl hover:bg-gray-800/50 transition-colors text-xs"
            >
              <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub でログイン（開発者向け）
            </button>
          </div>
        </div>

        {/* ゲストモードリンク */}
        <div className="text-center mt-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            <span>👀</span>
            <span>登録なしで試してみる</span>
            <span className="text-xs">→</span>
          </Link>
          <p className="text-gray-700 text-xs mt-1">データはブラウザに保存、後で同期できます</p>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          ログインすることで
          <a href="#" className="hover:text-gray-400 underline mx-0.5">利用規約</a>
          と
          <a href="#" className="hover:text-gray-400 underline mx-0.5">プライバシーポリシー</a>
          に同意します
        </p>
      </div>
    </main>
  );
}

export default function LoginClient() {
  return <LoginForm />;
}
