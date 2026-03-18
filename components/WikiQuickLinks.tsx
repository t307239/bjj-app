"use client";

// WikiQuickLinks — ダッシュボードのBJJ Wiki クイックリンクカード
// カテゴリフィルター付き（今日の日替わりセット + カテゴリ別フィルタリング）

import { useState } from "react";

const WIKI_BASE = "https://t307239.github.io/bjj-wiki/ja";

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

// 全リンクをフラット化
const ALL_LINKS: QuickLink[] = QUICK_LINK_SETS.flat();

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
