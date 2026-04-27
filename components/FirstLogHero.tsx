"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

/**
 * FirstLogHero — z214 (F-17): dashboard 0-log empty state activation card.
 *
 * 新規ユーザーが dashboard を最初に見た時、StatusBar は all-zero、
 * Heatmap/MatTime/WeeklyReport は hidden、RecentLogs 空 で
 * 「何をすればいいか分からない」状態だった。
 *
 * Top app pattern (Linear empty workspace / Notion getting started):
 *   - 単一の primary action を画面最上部に超目立つ形で配置
 *   - そこを click すれば「最初の体験」が始まる
 *   - 既存 OnboardingChecklist は 4 step (text-xs) で priority 不明確
 *
 * 設計:
 *   - totalCount === 0 の時のみ render (component caller 側で制御)
 *   - emerald gradient + 大きな emoji + 太字 title で視覚 dominance
 *   - CTA は 1 つのみ → /records?welcome=1 で TrainingLog form 自動 open (z183)
 *   - 「10秒で完了」の所要時間明示で friction 不安 kill
 */
export default function FirstLogHero() {
  const { t } = useLocale();
  return (
    <section
      className="mb-6 rounded-2xl p-6 sm:p-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
        border: "1px solid rgba(16,185,129,0.4)",
        boxShadow: "0 0 32px rgba(16,185,129,0.15)",
      }}
    >
      <div className="text-center">
        <div className="text-5xl sm:text-6xl mb-3">🥋</div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          {t("firstLogHero.title")}
        </h2>
        <p className="text-sm sm:text-base text-emerald-100/90 mb-5 max-w-md mx-auto">
          {t("firstLogHero.sub")}
        </p>
        <Link
          href="/records?welcome=1"
          className="inline-flex items-center justify-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 font-bold py-3.5 px-8 rounded-full text-base transition-all shadow-lg"
        >
          {t("firstLogHero.cta")}
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="text-xs text-emerald-200/70 mt-3">
          {t("firstLogHero.duration")}
        </p>
      </div>
    </section>
  );
}
