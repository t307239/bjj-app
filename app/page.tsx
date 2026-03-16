import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* ナビゲーション */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥋</span>
          <span className="font-bold text-lg">BJJ App</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ログイン
        </Link>
      </nav>

      {/* ヒーロー */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          {/* バッジ */}
          <div className="inline-flex items-center gap-2 bg-[#16213e] border border-[#e94560]/30 rounded-full px-4 py-1.5 text-sm text-[#e94560] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e94560] animate-pulse" />
            無料で始められます
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            BJJの成長を、
            <br />
            <span className="bg-gradient-to-r from-[#e94560] to-pink-400 bg-clip-text text-transparent">
              データで証明する。
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
            練習回数・テクニック・連続記録を一元管理。<br className="hidden md:block" />
            毎日の積み重ねが、帯昇格への道を切り開く。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#e94560]/20"
            >
              無料で始める →
            </Link>
          </div>

          <p className="text-gray-600 text-sm">
            GitHub / Google アカウントで即スタート。クレジットカード不要。
          </p>
        </div>
      </section>

      {/* 機能紹介 */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-gray-200">
          すべての機能が無料
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#16213e] rounded-2xl p-6 border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold text-lg mb-2">練習ログ</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              日付・時間・練習タイプ・メモを記録。今月の練習数と総練習時間を自動集計。
            </p>
          </div>
          <div className="bg-[#16213e] rounded-2xl p-6 border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">📚</div>
            <h3 className="font-bold text-lg mb-2">テクニック帳</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              習得したテクニックをポジション別に整理。習熟度を追跡して弱点を把握。
            </p>
          </div>
          <div className="bg-[#16213e] rounded-2xl p-6 border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">🔥</div>
            <h3 className="font-bold text-lg mb-2">連続記録</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              何日連続で練習できているか自動カウント。習慣化のモチベーションに。
            </p>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="px-6 py-8 text-center text-gray-600 text-sm border-t border-gray-800">
        <p>© 2026 BJJ App. Made for grapplers, by grapplers.</p>
      </footer>
    </main>
  );
}
