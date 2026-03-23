"use client";

// WikiQuickLinks — ダッシュボードのBJJ Wiki クイックリンクカード
// カテゴリフィルター付き（今日の日替わりセット + カテゴリ別フィルタリング）

import { useState } from "react";
import { useLocale } from "@/lib/i18n";

// WIKI_BASE is computed inside the component using locale (see below)

// GA4イベント送信ヘルパー
function trackWikiClick(slug: string, tag: string) {
  try {
    if (typeof window !== "undefined" && typeof (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag === "function") {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "wiki_link_click", {
        event_category: "BJJ Wiki",
        event_label: slug,
        wiki_tag: tag,
      });
    }
  } catch { /* silent */ }
}

type QuickLink = {
  emoji: string;
  titleEn: string;
  titleJa: string;
  slug: string;
  tagEn: string;
  tagJa: string;
};

// カテゴリ別おすすめ技術リスト（日替わりローテーション用）
const QUICK_LINK_SETS: QuickLink[][] = [
  [
    { emoji: "🔺", titleEn: "Triangle Choke Complete Guide", titleJa: "トライアングルチョーク完全ガイド", slug: "bjj-triangle-choke-guide", tagEn: "Submission", tagJa: "サブミッション" },
    { emoji: "💪", titleEn: "Armbar Fundamentals", titleJa: "アームバー入門", slug: "bjj-armbar-guide", tagEn: "Submission", tagJa: "サブミッション" },
    { emoji: "🔄", titleEn: "Sweep Fundamentals", titleJa: "スウィープの基礎", slug: "bjj-sweep-fundamentals", tagEn: "Sweep", tagJa: "攻撃" },
  ],
  [
    { emoji: "🛡️", titleEn: "Guard Retention System", titleJa: "ガードリテンション", slug: "bjj-guard-retention-system", tagEn: "Defense", tagJa: "ディフェンス" },
    { emoji: "🌀", titleEn: "Half Guard Complete Guide", titleJa: "ハーフガードシステム", slug: "bjj-half-guard-guide", tagEn: "Guard", tagJa: "ガード" },
    { emoji: "🦋", titleEn: "Butterfly Guard Guide", titleJa: "バタフライガード", slug: "bjj-butterfly-guard", tagEn: "Guard", tagJa: "ガード" },
  ],
  [
    { emoji: "🦵", titleEn: "Heel Hook Complete Guide", titleJa: "ヒールフックガイド", slug: "bjj-heel-hook-guide", tagEn: "Leg Lock", tagJa: "レッグロック" },
    { emoji: "🔗", titleEn: "Leg Lock System", titleJa: "レッグロックシステム", slug: "bjj-leg-lock-system", tagEn: "Leg Lock", tagJa: "レッグロック" },
    { emoji: "📐", titleEn: "Ashi Garami Guide", titleJa: "アシガラミガイド", slug: "bjj-ashi-garami-guide", tagEn: "Leg Lock", tagJa: "レッグロック" },
  ],
  [
    { emoji: "🏔️", titleEn: "Mount System", titleJa: "マウントシステム", slug: "bjj-mount-system", tagEn: "Position", tagJa: "ポジション" },
    { emoji: "🎯", titleEn: "Back Control System", titleJa: "バックコントロール", slug: "bjj-back-control-system", tagEn: "Position", tagJa: "ポジション" },
    { emoji: "🔓", titleEn: "Mount Escape System", titleJa: "マウント脱出", slug: "bjj-mount-escape-system", tagEn: "Escape", tagJa: "エスケープ" },
  ],
  [
    { emoji: "⬇️", titleEn: "Double Leg Takedown", titleJa: "ダブルレッグ", slug: "bjj-double-leg-takedown", tagEn: "Takedown", tagJa: "テイクダウン" },
    { emoji: "➡️", titleEn: "Single Leg Takedown", titleJa: "シングルレッグ", slug: "bjj-single-leg-takedown", tagEn: "Takedown", tagJa: "テイクダウン" },
    { emoji: "🚀", titleEn: "Takedown Entry System", titleJa: "エントリーシステム", slug: "bjj-takedown-entry-systems", tagEn: "Takedown", tagJa: "テイクダウン" },
  ],
  [
    { emoji: "🌿", titleEn: "De la Riva Guard", titleJa: "デラヒーバガード", slug: "bjj-de-la-riva-guard", tagEn: "Guard", tagJa: "ガード" },
    { emoji: "❌", titleEn: "X Guard Position", titleJa: "Xガードシステム", slug: "bjj-x-guard-position-guide", tagEn: "Guard", tagJa: "ガード" },
    { emoji: "🕸️", titleEn: "Spider Guard System", titleJa: "スパイダーガード", slug: "bjj-spider-guard-system", tagEn: "Guard", tagJa: "ガード" },
  ],
  [
    { emoji: "🔄", titleEn: "Guard Passing Concepts", titleJa: "ガードパスの概念", slug: "bjj-guard-passing-concepts", tagEn: "Passing", tagJa: "パッシング" },
    { emoji: "💨", titleEn: "Pressure Passing Guide", titleJa: "プレッシャーパス", slug: "bjj-pressure-passing-guide", tagEn: "Passing", tagJa: "パッシング" },
    { emoji: "🏃", titleEn: "Speed Passing Fundamentals", titleJa: "スピードパス入門", slug: "bjj-speed-passing-guide", tagEn: "Passing", tagJa: "パッシング" },
  ],
  [
    { emoji: "🧠", titleEn: "BJJ Competition Mental Game", titleJa: "競技メンタル", slug: "bjj-competition-mindset", tagEn: "Mental", tagJa: "メンタル" },
    { emoji: "🏆", titleEn: "BJJ Tournament Preparation Guide", titleJa: "大会準備ガイド", slug: "bjj-competition-preparation", tagEn: "Competition", tagJa: "競技" },
    { emoji: "📊", titleEn: "BJJ Sport Psychology", titleJa: "スポーツ心理学", slug: "bjj-sport-psychology", tagEn: "Mental", tagJa: "メンタル" },
  ],
  [
    { emoji: "🛡️", titleEn: "Submission Defense System", titleJa: "サブミッションディフェンス", slug: "bjj-submission-defense-systems", tagEn: "Defense", tagJa: "ディフェンス" },
    { emoji: "🔙", titleEn: "Back Escape System", titleJa: "バックエスケープ", slug: "bjj-back-escape-system", tagEn: "Escape", tagJa: "エスケープ" },
    { emoji: "↩️", titleEn: "Side Control Escape", titleJa: "サイドコントロール脱出", slug: "bjj-side-control-escape-guide", tagEn: "Escape", tagJa: "エスケープ" },
  ],
  [
    { emoji: "💪", titleEn: "BJJ Strength Training", titleJa: "BJJ筋力トレーニング", slug: "bjj-bjj-strength-training", tagEn: "Physical", tagJa: "フィジカル" },
    { emoji: "🔋", titleEn: "Recovery Protocols", titleJa: "リカバリープロトコル", slug: "bjj-recovery-protocols", tagEn: "Physical", tagJa: "フィジカル" },
    { emoji: "🤝", titleEn: "Grip Strength Training", titleJa: "グリップ強化", slug: "bjj-grip-strength-training", tagEn: "Physical", tagJa: "フィジカル" },
  ],
];

// 新着ページ（最新バッチ）
const NEW_LINKS: QuickLink[] = [
  { emoji: "🦵", titleEn: "Advanced Leg Lock Systems", titleJa: "アドバンスドレッグロックシステム", slug: "bjj-advanced-leg-lock-systems", tagEn: "New", tagJa: "新着" },
  { emoji: "🏆", titleEn: "Competition Game Planning", titleJa: "競技ゲームプランニング", slug: "bjj-competition-game-planning", tagEn: "New", tagJa: "新着" },
  { emoji: "🥋", titleEn: "Gi vs No-Gi Comparison", titleJa: "GiとノーギのBJJ比較", slug: "bjj-gi-vs-nogi-comparison", tagEn: "New", tagJa: "新着" },
  { emoji: "⚫", titleEn: "Black Belt Concepts", titleJa: "黒帯コンセプト", slug: "bjj-black-belt-concepts", tagEn: "New", tagJa: "新着" },
  { emoji: "🔗", titleEn: "Submission Chain Attacks", titleJa: "サブミッションチェーン", slug: "bjj-submission-chain-attacks", tagEn: "New", tagJa: "新着" },
  { emoji: "🤼", titleEn: "Wrestling Integration for BJJ", titleJa: "BJJのためのレスリング", slug: "bjj-wrestling-integration", tagEn: "New", tagJa: "新着" },
  { emoji: "🔙", titleEn: "Back System Advanced", titleJa: "バックシステム上級", slug: "bjj-back-system-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🌀", titleEn: "Advanced Guard Concepts", titleJa: "ガードコンセプト上級", slug: "bjj-guard-concepts-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "📋", titleEn: "Advanced Competition Prep", titleJa: "競技準備上級", slug: "bjj-competition-prep-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "👘", titleEn: "Gi Choke Systems", titleJa: "道衣チョークシステム", slug: "bjj-gi-choke-systems", tagEn: "New", tagJa: "新着" },
  { emoji: "🌓", titleEn: "Half Guard Advanced", titleJa: "上級ハーフガード", slug: "bjj-half-guard-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🐢", titleEn: "Turtle Top Attacks", titleJa: "タートルトップ攻撃", slug: "bjj-turtle-top-attacks", tagEn: "New", tagJa: "新着" },
  { emoji: "🔀", titleEn: "Open Guard Transitions", titleJa: "オープンガードトランジション", slug: "bjj-open-guard-transitions", tagEn: "New", tagJa: "新着" },
  { emoji: "🌪️", titleEn: "Scramble Systems", titleJa: "スクランブルシステム", slug: "bjj-scramble-systems", tagEn: "New", tagJa: "新着" },
  { emoji: "🔒", titleEn: "Closed Guard Systems", titleJa: "クローズドガードシステム", slug: "bjj-closed-guard-systems", tagEn: "New", tagJa: "新着" },
  { emoji: "🧭", titleEn: "North South Position Attacks", titleJa: "ノースサウス攻撃", slug: "bjj-north-south-position-attacks", tagEn: "New", tagJa: "新着" },
  { emoji: "🦵", titleEn: "Knee on Belly Advanced", titleJa: "ニーオンベリー上級", slug: "bjj-knee-on-belly-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "✝️", titleEn: "Crucifix Position System", titleJa: "クルシフィックスシステム", slug: "bjj-crucifix-position-system", tagEn: "New", tagJa: "新着" },
  { emoji: "🌀", titleEn: "Twister System", titleJa: "ツイスターシステム", slug: "bjj-twister-system", tagEn: "New", tagJa: "新着" },
  { emoji: "🕷️", titleEn: "Rubber Guard Advanced", titleJa: "ラバーガード上級", slug: "bjj-rubber-guard-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🕳️", titleEn: "Deep Half Guard Mastery", titleJa: "ディープハーフマスタリー", slug: "bjj-deep-half-guard-mastery", tagEn: "New", tagJa: "新着" },
  { emoji: "🦿", titleEn: "Leg Entanglement Entries", titleJa: "レッグエンタングルメントエントリー", slug: "bjj-leg-entanglement-entries", tagEn: "New", tagJa: "新着" },
  { emoji: "🎯", titleEn: "Back Take Advanced System", titleJa: "バックテイク上級", slug: "bjj-back-take-advanced-system", tagEn: "New", tagJa: "新着" },
  { emoji: "🏁", titleEn: "Submission Finishing Details", titleJa: "サブミッションフィニッシング詳細", slug: "bjj-submission-finishing-details", tagEn: "New", tagJa: "新着" },
  { emoji: "🛡️", titleEn: "Guard Development System", titleJa: "ガード開発システム", slug: "bjj-guard-development-system", tagEn: "New", tagJa: "新着" },
  { emoji: "⚡", titleEn: "Reaction Training", titleJa: "リアクショントレーニング", slug: "bjj-reaction-training-bjj", tagEn: "New", tagJa: "新着" },
  { emoji: "🤝", titleEn: "Chest to Chest Control", titleJa: "チェスト・トゥ・チェストコントロール", slug: "bjj-chest-to-chest-control", tagEn: "New", tagJa: "新着" },
  { emoji: "⚔️", titleEn: "Offense First BJJ", titleJa: "オフェンスファーストBJJ", slug: "bjj-offense-first-bjj", tagEn: "New", tagJa: "新着" },
  { emoji: "🗺️", titleEn: "Submission Matrix", titleJa: "サブミッションマトリックス", slug: "bjj-submission-matrix", tagEn: "New", tagJa: "新着" },
  { emoji: "🌊", titleEn: "Guard Sweeps Masterclass", titleJa: "ガードスウィープマスター", slug: "bjj-guard-sweeps-masterclass", tagEn: "New", tagJa: "新着" },
  { emoji: "🔗", titleEn: "Submission Setup Chains", titleJa: "サブミッションチェーン", slug: "bjj-submission-setup-chains", tagEn: "New", tagJa: "新着" },
  { emoji: "🥊", titleEn: "MMA Guard Work", titleJa: "MMAガードワーク", slug: "bjj-mma-guard-work", tagEn: "New", tagJa: "新着" },
  { emoji: "🛡️", titleEn: "Defensive Guard Play", titleJa: "ディフェンシブガード", slug: "bjj-defensive-guard-play", tagEn: "New", tagJa: "新着" },
  { emoji: "⚡", titleEn: "Transition Game Advanced", titleJa: "トランジションゲーム上級", slug: "bjj-transition-game-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🐢", titleEn: "Attacking from Turtle Advanced", titleJa: "タートル上級攻撃", slug: "bjj-attacking-from-turtle-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🔬", titleEn: "Conditioning Science", titleJa: "BJJコンディショニング科学", slug: "bjj-conditioning-science", tagEn: "New", tagJa: "新着" },
  { emoji: "🎯", titleEn: "Guard Setups Masterclass", titleJa: "ガードセットアップ", slug: "bjj-guard-setups-masterclass", tagEn: "New", tagJa: "新着" },
  { emoji: "🏁", titleEn: "Back Control Finishing Details", titleJa: "バックコントロール詳細", slug: "bjj-back-control-finishing-details", tagEn: "New", tagJa: "新着" },
  { emoji: "🔄", titleEn: "Sweeps to Submissions", titleJa: "スウィープ→サブミッション", slug: "bjj-sweeps-to-submissions", tagEn: "New", tagJa: "新着" },
  { emoji: "⬇️", titleEn: "Guard Pulling Strategy", titleJa: "ガードプル戦略", slug: "bjj-guard-pulling-strategy", tagEn: "New", tagJa: "新着" },
  { emoji: "🌐", titleEn: "Open Guard Mastery", titleJa: "オープンガードマスタリー", slug: "bjj-open-guard-mastery", tagEn: "New", tagJa: "新着" },
  { emoji: "🏋️", titleEn: "Top Pressure Advanced", titleJa: "トッププレッシャー上級", slug: "bjj-top-pressure-advanced", tagEn: "New", tagJa: "新着" },
  { emoji: "🎣", titleEn: "Submission Hunting", titleJa: "サブミッションハンティング", slug: "bjj-submission-hunting", tagEn: "New", tagJa: "新着" },
  { emoji: "📅", titleEn: "Tournament Preparation Complete", titleJa: "トーナメント準備完全版", slug: "bjj-tournament-preparation", tagEn: "New", tagJa: "新着" },
  { emoji: "🚧", titleEn: "Guard Passing Fundamentals", titleJa: "ガードパス基礎原則", slug: "bjj-passing-guard-fundamentals", tagEn: "New", tagJa: "新着" },
  { emoji: "🔒", titleEn: "Closed Guard Attacks", titleJa: "クローズドガード攻撃", slug: "bjj-closed-guard-attacks", tagEn: "New", tagJa: "新着" },
  { emoji: "↔️", titleEn: "Side Control Positions", titleJa: "サイドコントロール体系", slug: "bjj-side-control-positions", tagEn: "New", tagJa: "新着" },
  { emoji: "🎯", titleEn: "Back Take Entries", titleJa: "バックテイクエントリー", slug: "bjj-back-take-entries", tagEn: "New", tagJa: "新着" },
  { emoji: "🦵", titleEn: "Knee on Belly Control", titleJa: "ニーオンベリーコントロール", slug: "bjj-knee-on-belly-control", tagEn: "New", tagJa: "新着" },
];

// 全リンクをフラット化
const ALL_LINKS: QuickLink[] = [...QUICK_LINK_SETS.flat(), ...NEW_LINKS];

// ユニークカテゴリ一覧
const CATEGORIES = Array.from(new Set(ALL_LINKS.map((l) => l.tagEn)));

// カテゴリ絵文字マップ（EN+JA対応）
const CATEGORY_EMOJI: Record<string, string> = {
  // English keys
  "Submission": "🔺",
  "Sweep": "⚔️",
  "Defense": "🛡️",
  "Guard": "🌀",
  "Leg Lock": "🦵",
  "Position": "🏔️",
  "Escape": "🔓",
  "Takedown": "🚀",
  "Passing": "💨",
  "Mental": "🧠",
  "Competition": "🏆",
  "Physical": "💪",
  "New": "✨",
  // Japanese keys (for backward compat)
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
  const { t, locale } = useLocale();
  const WIKI_BASE = `https://wiki.bjj-app.net/${locale}`;
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 年の通算日でセットをローテーション（JST）
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const todaySet = QUICK_LINK_SETS[dayOfYear % QUICK_LINK_SETS.length];

  const displayLinks = selectedTag === null
    ? todaySet
    : ALL_LINKS.filter((l) => l.tagEn === selectedTag).slice(0, 9);

  // Get category names for display (English only)
  const getCategoryDisplay = (catEn: string, _catJa: string) => catEn;
  const getCategoryKey = (catEn: string) => catEn;

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-white/10 mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔗</span>
          <span className="text-xs text-gray-400 font-medium">{t("wiki.dailyTip")}</span>
          {!isOpen && selectedTag && (
            <span className="text-[10px] text-gray-500">{CATEGORY_EMOJI[selectedTag]} {selectedTag}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (<div className="px-4 pb-4 border-t border-white/10">
        <div className="flex items-center justify-between pt-3 mb-3">
          <span className="text-[10px] text-gray-500">{t("wiki.nextHint")}</span>
          <a
            href={`${WIKI_BASE}/index.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t("wiki.peekAhead")}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* カテゴリフィルターピル */}
        <div className="flex gap-1 flex-wrap mb-3">
          <button
            onClick={() => setSelectedTag(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              selectedTag === null
                ? "bg-zinc-600 border-zinc-600 text-white"
                : "border-white/10 text-gray-400 hover:border-white/20 hover:text-zinc-100"
            }`}
          >
            Today
          </button>
          {CATEGORIES.map((catEn) => {
            const displayCat = catEn;
            return (
              <button
                key={catEn}
                onClick={() => setSelectedTag(selectedTag === catEn ? null : catEn)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  selectedTag === catEn
                    ? "bg-zinc-600 border-zinc-600 text-white"
                    : "border-white/10 text-gray-400 hover:border-white/20 hover:text-zinc-100"
                }`}
              >
                {CATEGORY_EMOJI[catEn] ?? ""} {displayCat}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {displayLinks.map((link) => (
            <a
              key={link.slug}
              href={`${WIKI_BASE}/${link.slug}.html`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWikiClick(link.slug, link.tagEn)}
              className="flex flex-col items-center text-center p-2.5 rounded-lg bg-white/5 hover:bg-zinc-800 border border-white/10 hover:border-white/25 transition-all group"
            >
              <span className="text-lg mb-1">{link.emoji}</span>
              <span className="text-[10px] text-gray-300 group-hover:text-white font-medium leading-tight line-clamp-2">
                {link.titleEn}
              </span>
              <span className="text-[9px] text-gray-500 mt-1">{link.tagEn}</span>
            </a>
          ))}
        </div>
      </div>)}
    </div>
  );
}
