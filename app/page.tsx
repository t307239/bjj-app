import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "BJJ App - Brazilian Jiu-Jitsu練習トラッカー",
  description: "柔術の練習記録・テクニック管理・成長の可視化。無料で始めるBJJトレーニングアプリ。",
};

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

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#e94560]/20"
            >
              無料で始める →
            </Link>
            <a
              href="#preview"
              className="inline-flex items-center justify-center gap-2 bg-[#16213e] hover:bg-[#1a2a4a] text-gray-300 font-medium py-4 px-8 rounded-full text-lg transition-all border border-gray-700"
            >
              アプリを見る ↓
            </a>
          </div>

          <p className="text-gray-600 text-sm">
            GitHub / Google アカウントで即スタート。クレジットカード不要。
          </p>
        </div>
      </section>

      {/* 社会的証拠（ソーシャルプルーフ） */}
      <section className="px-4 py-16 bg-[#0f0e17]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">
            📊 リアルな練習データ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#16213e] rounded-2xl p-8 border border-[#e94560]/30 text-center">
              <div className="text-4xl font-bold text-[#e94560] mb-2">3,000+</div>
              <p className="text-gray-400 text-sm">練習セッション記録済み</p>
              <p className="text-gray-600 text-xs mt-2">ユーザーが毎日記録している</p>
            </div>
            <div className="bg-[#16213e] rounded-2xl p-8 border border-[#e94560]/30 text-center">
              <div className="text-4xl font-bold text-[#e94560] mb-2">500+</div>
              <p className="text-gray-400 text-sm">技術習得済み</p>
              <p className="text-gray-600 text-xs mt-2">テクニック帳に登録された</p>
            </div>
            <div className="bg-[#16213e] rounded-2xl p-8 border border-[#e94560]/30 text-center">
              <div className="text-4xl font-bold text-[#e94560] mb-2">100+</div>
              <p className="text-gray-400 text-sm">毎日使用中</p>
              <p className="text-gray-600 text-xs mt-2">アクティブユーザーが継続中</p>
            </div>
          </div>
        </div>
      </section>

      {/* アプリプレビューセクション */}
      <section id="preview" className="px-4 py-16 bg-[#16213e]/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3 text-gray-200">
            こんな感じで使えます
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12">登録後すぐに使える。全機能が永久無料。</p>

          {/* ダッシュボードモックアップ */}
          <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            {/* スマホモックアップ */}
            <div className="mx-auto lg:mx-0 w-full max-w-[320px] bg-[#1a1a2e] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
              {/* ヘッダー */}
              <div className="bg-[#16213e] border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🥋</span>
                  <span className="text-sm font-semibold">BJJ App</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[11px] text-gray-500">練習</span>
                  <span className="text-[11px] text-gray-500">技</span>
                  <span className="text-[11px] text-gray-500">設定</span>
                </div>
              </div>

              <div className="p-4">
                {/* あいさつ */}
                <div className="mb-4">
                  <h3 className="text-base font-bold">おかえり、道場生 🥋</h3>
                  <p className="text-[11px] text-gray-500">2026年3月17日（火）</p>
                </div>

                {/* スタッツグリッド */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#16213e] rounded-xl p-3 text-center border border-gray-700">
                    <div className="text-2xl font-bold text-[#e94560]">12</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">今月の練習</div>
                  </div>
                  <div className="bg-[#16213e] rounded-xl p-3 text-center border border-gray-700">
                    <div className="text-2xl font-bold text-blue-400">3</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">今週の練習</div>
                  </div>
                  <div className="bg-[#16213e] rounded-xl p-3 text-center border border-gray-700">
                    <div className="text-2xl font-bold text-purple-400">47</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">習得テクニック</div>
                  </div>
                  <div className="bg-[#16213e] rounded-xl p-3 text-center border border-gray-700">
                    <div className="text-xl font-bold text-orange-400">🔥 5</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">連続練習日</div>
                  </div>
                </div>

                {/* 目標トラッカー */}
                <div className="bg-[#16213e] rounded-xl border border-gray-700 mb-3 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <span className="text-xs font-medium text-gray-300">🎯 練習目標</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-gray-400">今週の目標</span>
                        <span className="text-[10px] text-yellow-400">75%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: "75%" }} />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">3 / 4回</div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-gray-400">今月の目標</span>
                        <span className="text-[10px] text-green-400">✓ 達成！</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: "100%" }} />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">12 / 12回</div>
                    </div>
                  </div>
                </div>

                {/* 練習ログサンプル */}
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-500 font-medium mb-1">最近の練習</div>
                  <div className="bg-[#16213e] rounded-xl p-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/17</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Gi</span>
                          <span className="text-[10px] text-gray-500">1時間30分</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#16213e] rounded-xl p-3 border border-gray-700 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/15</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">NoGi</span>
                          <span className="text-[10px] text-gray-500">1時間</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：機能ハイライト */}
            <div className="flex-1 max-w-md mx-auto lg:mx-0 space-y-4 pt-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#e94560]/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">練習をすべて記録</h3>
                  <p className="text-gray-500 text-sm">Gi・NoGi・ドリル・試合など種類別に記録。練習時間もカレンダーで振り返れる。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🎯</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">週間・月間ゴール設定</h3>
                  <p className="text-gray-500 text-sm">練習目標を設定してプログレスバーで追跡。達成すると緑に変わってモチベーション維持。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📚</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">テクニック帳で弱点把握</h3>
                  <p className="text-gray-500 text-sm">習得したテクニックをポジション別に整理。習熟度★で自分の弱点が一目でわかる。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🔥</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">連続練習ストリーク</h3>
                  <p className="text-gray-500 text-sm">何日連続で練習できているか自動カウント。ストリークを守るために道場に行きたくなる。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📅</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">カレンダーで振り返り</h3>
                  <p className="text-gray-500 text-sm">月カレンダーで練習日を可視化。カラードットで練習タイプも一目瞭然。</p>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 w-full text-center"
                >
                  自分のデータを記録する →
                </Link>
              </div>
            </div>
          </div>
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

      {/* 最終CTA */}
      <section className="px-4 py-16 text-center bg-[#16213e]/30">
        <h2 className="text-2xl font-bold mb-3 text-gray-200">今すぐ始めよう</h2>
        <p className="text-gray-500 text-sm mb-8">クレジットカード不要。GitHubまたはGoogleで即スタート。</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#e94560]/20"
        >
          無料で始める →
        </Link>
      </section>

      {/* フッター */}
      <footer className="px-6 py-8 text-center text-gray-600 text-sm border-t border-gray-800">
        <p>© 2026 BJJ App. Made for grapplers, by grapplers.</p>
      </footer>
    </main>
  );
}
