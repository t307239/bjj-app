"use client";

// WikiQuickLinks — ダッシュボードのBJJ Wiki クイックリンクカード
// カテゴリフィルター付き（今日の日替わりセット + カテゴリ別フィルタリング）

import { useState } from "react";

const WIKI_BASE = "https://t307239.github.io/bjj-wiki/ja";

// GA4イベント送信ヘルパー
function trackWikiClick(slug: string, tag: string) {
  try {
    if (typeof window !== "undefined" && typeof (window as { gtag?: (...args: unknown[]) => void }).gtag === "function") {
      (window as { gtag: (...args: unknown[]) => void }).gtag("event", "wiki_link_click", {
        event_category: "BJJ Wiki",
        event_label: slug,
        wiki_tag: tag,
      });
    }
  } catch { /* silent */ }
}

type QuickLink = {
  emoji: string;
  title: string;
  slug: string;
  tag: string;
};

// カテゴリ別おすすめ技術リスト（日替わりローテーション用）
const QUICK_LINK_SETS: QuickLink[][] = [
  [
    { emoji: "🔺", title: "トライアングルチョーク", slug: "bjj-triangle-choke-guide", tag: "サブミッション" },
    { emoji: "💪", title: "アームバー入門", slug: "bjj-armbar-guide", tag: "サブミッション" },
    { emoji: "🔄", title: "スウィープの基礎", slug: "bjj-sweep-fundamentals", tag: "攻撃" },
  ],
  [
    { emoji: "🛡️", title: "ガードリテンション", slug: "bjj-guard-retention-system", tag: "ディフェンス" },
    { emoji: "🌀", title: "ハーフガードシステム", slug: "bjj-half-guard-guide", tag: "ガード" },
    { emoji: "🦋", title: "バタフライガード", slug: "bjj-butterfly-guard", tag: "ガード" },
  ],
  [
    { emoji: "🦵", title: "ヒールフックガイド", slug: "bjj-heel-hook-guide", tag: "レッグロック" },
    { emoji: "🔗", title: "レッグロックシステム", slug: "bjj-leg-lock-system", tag: "レッグロック" },
    { emoji: "📐", title: "アシガラミガイド", slug: "bjj-ashi-garami-guide", tag: "レッグロック" },
  ],
  [
    { emoji: "🏔️", title: "マウントシステム", slug: "bjj-mount-system", tag: "ポジション" },
    { emoji: "🎯", title: "バックコントロール", slug: "bjj-back-control-system", tag: "ポジション" },
    { emoji: "🔓", title: "マウント脱出", slug: "bjj-mount-escape-system", tag: "エスケープ" },
  ],
  [
    { emoji: "⬇️", title: "ダブルレッグ", slug: "bjj-double-leg-takedown", tag: "テイクダウン" },
    { emoji: "➡️", title: "シングルレッグ", slug: "bjj-single-leg-takedown", tag: "テイクダウン" },
    { emoji: "🚀", title: "エントリーシステム", slug: "bjj-takedown-entry-systems", tag: "テイクダウン" },
  ],
  [
    { emoji: "🌿", title: "デラヒーバガード", slug: "bjj-de-la-riva-guard", tag: "ガード" },
    { emoji: "❌", title: "Xガードシステム", slug: "bjj-x-guard-position-guide", tag: "ガード" },
    { emoji: "🕸️", title: "スパイダーガード", slug: "bjj-spider-guard-system", tag: "ガード" },
  ],
  [
    { emoji: "🔄", title: "ガードパスの概念", slug: "bjj-guard-passing-concepts", tag: "パッシング" },
    { emoji: "💨", title: "プレッシャーパス", slug: "bjj-pressure-passing-guide", tag: "パッシング" },
    { emoji: "🏃", title: "スピードパス入門", slug: "bjj-speed-passing-guide", tag: "パッシング" },
  ],
  [
    { emoji: "🧠", title: "競技メンタル", slug: "bjj-competition-mindset", tag: "メンタル" },
    { emoji: "🏆", title: "大会準備ガイド", slug: "bjj-competition-preparation", tag: "競技" },
    { emoji: "📊", title: "スポーツ心理学", slug: "bjj-sport-psychology", tag: "メンタル" },
  ],
  [
    { emoji: "🛡️", title: "サブミッションディフェンス", slug: "bjj-submission-defense-systems", tag: "ディフェンス" },
    { emoji: "🔙", title: "バックエスケープ", slug: "bjj-back-escape-system", tag: "エスケープ" },
    { emoji: "↩️", title: "サイドコントロール脱出", slug: "bjj-side-control-escape-guide", tag: "エスケープ" },
  ],
  [
    { emoji: "💪", title: "BJJ筋力トレーニング", slug: "bjj-bjj-strength-training", tag: "フィジカル" },
    { emoji: "🔋", title: "リカバリープロトコル", slug: "bjj-recovery-protocols", tag: "フィジカル" },
    { emoji: "🤝", title: "グリップ強化", slug: "bjj-grip-strength-training", tag: "フィジカル" },
  ],
];

// 新着ページ（最新バッチ）
const NEW_LINKS: QuickLink[] = [
  { emoji: "🦵", title: "アドバンスドレッグロックシステム", slug: "bjj-advanced-leg-lock-systems", tag: "新着" },
  { emoji: "🏆", title: "競技ゲームプランニング", slug: "bjj-competition-game-planning", tag: "新着" },
  { emoji: "🥋", title: "GiとノーギのBJJ比較", slug: "bjj-gi-vs-nogi-comparison", tag: "新着" },
  { emoji: "⚫", title: "黒帯コンセプト", slug: "bjj-black-belt-concepts", tag: "新着" },
  { emoji: "🔗", title: "サブミッションチェーン", slug: "bjj-submission-chain-attacks", tag: "新着" },
  { emoji: "🤼", title: "BJJのためのレスリング", slug: "bjj-wrestling-integration", tag: "新着" },
  { emoji: "🔙", title: "バックシステム上級", slug: "bjj-back-system-advanced", tag: "新着" },
  { emoji: "🌀", title: "ガードコンセプト上級", slug: "bjj-guard-concepts-advanced", tag: "新着" },
  { emoji: "📋", title: "競技準備上級", slug: "bjj-competition-prep-advanced", tag: "新着" },
  // Batch 352-356
  { emoji: "👘", title: "道衣チョークシステム", slug: "bjj-gi-choke-systems", tag: "新着" },
  { emoji: "🌓", title: "上級ハーフガード", slug: "bjj-half-guard-advanced", tag: "新着" },
  { emoji: "🐢", title: "タートルトップ攻撃", slug: "bjj-turtle-top-attacks", tag: "新着" },
  { emoji: "🔀", title: "オープンガードトランジション", slug: "bjj-open-guard-transitions", tag: "新着" },
  { emoji: "🌪️", title: "スクランブルシステム", slug: "bjj-scramble-systems", tag: "新着" },
  // Batch 357-361
  { emoji: "🔒", title: "クローズドガードシステム", slug: "bjj-closed-guard-systems", tag: "新着" },
  { emoji: "🧭", title: "ノースサウス攻撃", slug: "bjj-north-south-position-attacks", tag: "新着" },
  { emoji: "🦵", title: "ニーオンベリー上級", slug: "bjj-knee-on-belly-advanced", tag: "新着" },
  { emoji: "✝️", title: "クルシフィックスシステム", slug: "bjj-crucifix-position-system", tag: "新着" },
  { emoji: "🌀", title: "ツイスターシステム", slug: "bjj-twister-system", tag: "新着" },
  // Batch 362-366
  { emoji: "🕷️", title: "ラバーガード上級", slug: "bjj-rubber-guard-advanced", tag: "新着" },
  { emoji: "🕳️", title: "ディープハーフマスタリー", slug: "bjj-deep-half-guard-mastery", tag: "新着" },
  { emoji: "🦿", title: "レッグエンタングルメントエントリー", slug: "bjj-leg-entanglement-entries", tag: "新着" },
  { emoji: "🎯", title: "バックテイク上級", slug: "bjj-back-take-advanced-system", tag: "新着" },
  { emoji: "🏁", title: "サブミッションフィニッシング詳細", slug: "bjj-submission-finishing-details", tag: "新着" },
  // Batch 367-371
  { emoji: "🛡️", title: "ガード開発システム", slug: "bjj-guard-development-system", tag: "新着" },
  { emoji: "⚡", title: "リアクショントレーニング", slug: "bjj-reaction-training-bjj", tag: "新着" },
  { emoji: "🤝", title: "チェスト・トゥ・チェストコントロール", slug: "bjj-chest-to-chest-control", tag: "新着" },
  { emoji: "⚔️", title: "オフェンスファーストBJJ", slug: "bjj-offense-first-bjj", tag: "新着" },
  { emoji: "🗺️", title: "サブミッションマトリックス", slug: "bjj-submission-matrix", tag: "新着" },
  // Batch 372-376
  { emoji: "🌊", title: "ガードスウィープマスター", slug: "bjj-guard-sweeps-masterclass", tag: "新着" },
  { emoji: "🔗", title: "サブミッションチェーン", slug: "bjj-submission-setup-chains", tag: "新着" },
  { emoji: "🥊", title: "MMAガードワーク", slug: "bjj-mma-guard-work", tag: "新着" },
  { emoji: "🛡️", title: "ディフェンシブガード", slug: "bjj-defensive-guard-play", tag: "新着" },
  { emoji: "⚡", title: "トランジションゲーム上級", slug: "bjj-transition-game-advanced", tag: "新着" },
  // Batch 377-381
  { emoji: "🐢", title: "タートル上級攻撃", slug: "bjj-attacking-from-turtle-advanced", tag: "新着" },
  { emoji: "🔬", title: "BJJコンディショニング科学", slug: "bjj-conditioning-science", tag: "新着" },
  { emoji: "🎯", title: "ガードセットアップ", slug: "bjj-guard-setups-masterclass", tag: "新着" },
  { emoji: "🏁", title: "バックコントロール詳細", slug: "bjj-back-control-finishing-details", tag: "新着" },
  { emoji: "🔄", title: "スウィープ→サブミッション", slug: "bjj-sweeps-to-submissions", tag: "新着" },
  // Batch 402-411
  { emoji: "⬇️", title: "ガードプル戦略", slug: "bjj-guard-pulling-strategy", tag: "新着" },
  { emoji: "🌐", title: "オープンガードマスタリー", slug: "bjj-open-guard-mastery", tag: "新着" },
  { emoji: "🏋️", title: "トッププレッシャー上級", slug: "bjj-top-pressure-advanced", tag: "新着" },
  { emoji: "🎣", title: "サブミッションハンティング", slug: "bjj-submission-hunting", tag: "新着" },
  { emoji: "📅", title: "トーナメント準備完全版", slug: "bjj-tournament-preparation", tag: "新着" },
  { emoji: "🚧", title: "ガードパス基礎原則", slug: "bjj-passing-guard-fundamentals", tag: "新着" },
  { emoji: "🔒", title: "クローズドガード攻撃", slug: "bjj-closed-guard-attacks", tag: "新着" },
  { emoji: "↔️", title: "サイドコントロール体系", slug: "bjj-side-control-positions", tag: "新着" },
  { emoji: "🎯", title: "バックテイクエントリー", slug: "bjj-back-take-entries", tag: "新着" },
  { emoji: "🦵", title: "ニーオンベリーコントロール", slug: "bjj-knee-on-belly-control", tag: "新着" },
];

// 全リンクをフラット化
const ALL_LINKS: QuickLink[] = [...QUICK_LINK_SETS.flat(), ...NEW_LINKS];

// ユニークカテゴリ一覧
const CATEGORIES = Array.from(new Set(ALL_LINKS.map((l) => l.tag)));

// カテゴリ絵文字マップ
const CATEGORY_EMOJI: Record<string, string> = {
  "サブミッション": "🔺",
  "攻撃": "⚔️",
  "ディフェンス": "🛡️",
  "ガード": "🌀",
  "レッグロック": "🦵",
  "ポジション": "🏔️",
  "エスケープ": "🔓",
  "テイクダウン": "🚀",
  "パッシング": "💨",
  "メンタル": "🧠",
  "競技": "🏆",
  "フィジカル": "💪",
  "新着": "✨",
};

export default function WikiQuickLinks() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 年の通算日でセットをローテーション（JST）
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const todaySet = QUICK_LINK_SETS[dayOfYear % QUICK_LINK_SETS.length];

  const displayLinks = selectedTag === null
    ? todaySet
    : ALL_LINKS.filter((l) => l.tag === selectedTag).slice(0, 9);

  return (
    <div className="bg-[#16213e]/60 rounded-xl p-4 border border-gray-700/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🔗</span>
        <span className="text-xs text-gray-400 font-medium">BJJ技術リファレンス</span>
        <a
          href="https://t307239.github.io/bjj-wiki/ja/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-[#e94560]/70 hover:text-[#e94560] transition-colors"
        >
          Wiki全体を見る →
        </a>
      </div>

      {/* カテゴリフィルターピル */}
      <div className="flex gap-1 flex-wrap mb-3">
        <button
          onClick={() => setSelectedTag(null)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            selectedTag === null
              ? "bg-[#e94560] border-[#e94560] text-white"
              : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
          }`}
        >
          今日
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedTag(selectedTag === cat ? null : cat)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              selectedTag === cat
                ? "bg-[#e94560] border-[#e94560] text-white"
                : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
            }`}
          >
            {CATEGORY_EMOJI[cat] ?? ""} {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {displayLinks.map((link) => (
          <a
            key={link.slug}
            href={`${WIKI_BASE}/${link.slug}.html`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWikiClick(link.slug, link.tag)}
            className="flex flex-col items-center text-center p-2.5 rounded-lg bg-[#0f3460]/50 hover:bg-[#0f3460] border border-gray-700/30 hover:border-[#e94560]/30 transition-all group"
          >
            <span className="text-lg mb-1">{link.emoji}</span>
            <span className="text-[10px] text-gray-300 group-hover:text-white font-medium leading-tight line-clamp-2">
              {link.title}
            </span>
            <span className="text-[9px] text-gray-500 mt-1">{link.tag}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
