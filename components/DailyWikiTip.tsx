"use client";

// DailyWikiTip — 日替わりBJJ Wikiページ推薦コンポーネント
// 年の通算日でWikiページをローテーション表示 + 次のヒントプレビュー

import { useState } from "react";

const WIKI_BASE = "https://t307239.github.io/bjj-wiki";

type WikiTip = {
  slug: string;
  titleJa: string;
  descJa: string;
  category: string;
  lang?: "en" | "ja" | "pt";
};

const WIKI_TIPS: WikiTip[] = [
  // サブミッション
  { slug: "bjj-triangle-choke-guide", titleJa: "トライアングルチョーク完全ガイド", descJa: "セットアップからフィニッシュまで詳細解説", category: "サブミッション" },
  { slug: "bjj-armbar-guide", titleJa: "アームバー（腕十字）完全ガイド", descJa: "ガード・マウント・サイドからの腕十字", category: "サブミッション" },
  { slug: "bjj-kimura-lock-guide", titleJa: "キムラ（腕がらみ）ガイド", descJa: "キムラトラップシステムで連携する方法", category: "サブミッション" },
  { slug: "bjj-omoplata-guide", titleJa: "オモプラータガイド", descJa: "ガードからのオモプラータ・コンボと使い方", category: "サブミッション" },
  { slug: "bjj-heel-hook-guide", titleJa: "ヒールフックガイド", descJa: "アシガラミからのアウトサイド・インサイドヒールフック", category: "レッグロック" },
  { slug: "bjj-leg-lock-system", titleJa: "レッグロックシステム", descJa: "ヒールフック・ニーバー・カーフスライサー体系", category: "レッグロック" },
  // ガード
  { slug: "bjj-half-guard-guide", titleJa: "ハーフガード完全ガイド", descJa: "ニーシールド・アンダーフック・ロックダウン", category: "ガード" },
  { slug: "bjj-de-la-riva-guard", titleJa: "デラヒーバガード", descJa: "エントリー・スウィープ・バックテイク", category: "ガード" },
  { slug: "bjj-butterfly-guard", titleJa: "バタフライガード", descJa: "フック・スウィープ・バックテイクの総合ガイド", category: "ガード" },
  { slug: "bjj-x-guard-position-guide", titleJa: "Xガードポジション", descJa: "Xガードからのスウィープとレッグ攻撃", category: "ガード" },
  { slug: "bjj-rubber-guard-guide", titleJa: "ラバーガードガイド", descJa: "ミッションコントロールからゴゴプラタまで", category: "ガード" },
  { slug: "bjj-guard-retention-advanced", titleJa: "ガードリテンション（上級）", descJa: "高度なフレーミング・ヒップエスケープ・リガード体系", category: "ガード" },
  { slug: "bjj-guard-retention-system", titleJa: "ガードリテンションシステム", descJa: "フレーミング・ヒップエスケープ・リガードの基礎", category: "ディフェンス" },
  // ポジション
  { slug: "bjj-mount-system", titleJa: "マウントシステム", descJa: "マウントコントロールから攻撃への連携", category: "ポジション" },
  { slug: "bjj-back-control-system", titleJa: "バックコントロールシステム", descJa: "シートベルトからRNC・ボウアンドアロー", category: "ポジション" },
  { slug: "bjj-back-escape-system", titleJa: "バックエスケープシステム", descJa: "ロール・シートベルト対策・タートルからの脱出", category: "エスケープ" },
  // パッシング
  { slug: "bjj-guard-passing-fundamentals", titleJa: "ガードパスの基礎", descJa: "プレッシャーパスとスピードパスの使い分け", category: "パッシング" },
  { slug: "bjj-guard-passing-concepts", titleJa: "ガードパスの概念", descJa: "コンセプト別ガードパスシステムの体系化", category: "パッシング" },
  // スウィープ
  { slug: "bjj-sweep-fundamentals", titleJa: "スウィープの基礎", descJa: "シザー・ヒップバンプ・フラワースウィープ解説", category: "スウィープ" },
  // テイクダウン
  { slug: "bjj-double-leg-takedown", titleJa: "ダブルレッグテイクダウン", descJa: "ショット・ドライブ・フィニッシュの完全解説", category: "テイクダウン" },
  { slug: "bjj-single-leg-takedown", titleJa: "シングルレッグテイクダウン", descJa: "ハイC・ランニングザパイプ・コンボ", category: "テイクダウン" },
  { slug: "bjj-takedown-entry-systems", titleJa: "テイクダウンエントリーシステム", descJa: "クリンチからの各種テイクダウン入り方の体系", category: "テイクダウン" },
  // エスケープ
  { slug: "bjj-mount-escape-system", titleJa: "マウントエスケープシステム", descJa: "ブリッジ・エルボーエスケープ・ガード再構築", category: "エスケープ" },
  { slug: "bjj-side-control-escape-guide", titleJa: "サイドコントロールエスケープ", descJa: "フレーム・ヒップエスケープ・タートル転換", category: "エスケープ" },
  // 競技・メンタル
  { slug: "bjj-competition-mindset", titleJa: "BJJ競技メンタル", descJa: "試合前後のメンタル管理と集中力の高め方", category: "メンタル" },
  { slug: "bjj-competition-preparation", titleJa: "BJJ大会準備ガイド", descJa: "ゲームプラン・メンタル・ウォームアップ", category: "競技" },
  { slug: "bjj-sport-psychology", titleJa: "BJJのスポーツ心理学", descJa: "集中力・レジリエンス・試合メンタルの鍛え方", category: "メンタル" },
  // フィジカル・栄養
  { slug: "bjj-injury-prevention-guide", titleJa: "ケガ予防ガイド", descJa: "BJJに多い怪我の予防法とリスク管理", category: "フィジカル" },
  { slug: "bjj-nutrition-science", titleJa: "BJJの栄養科学", descJa: "パフォーマンスを最大化する食事と栄養の科学", category: "栄養" },
  { slug: "bjj-recovery-protocol-bjj", titleJa: "BJJ特化のリカバリー方法", descJa: "練習後の回復を最大化するプロトコル", category: "フィジカル" },
  { slug: "bjj-recovery-protocols", titleJa: "リカバリープロトコル詳細", descJa: "科学的根拠に基づく最適な回復戦略", category: "フィジカル" },
  { slug: "bjj-grip-strength-training", titleJa: "グリップ強化トレーニング", descJa: "BJJに特化したグリップ筋力の鍛え方", category: "フィジカル" },
  { slug: "bjj-bjj-strength-training", titleJa: "BJJのための筋力トレーニング", descJa: "柔術パフォーマンスを向上させるS&Cプログラム", category: "フィジカル" },
  // アドバンスト
  { slug: "bjj-gordons-system-guide", titleJa: "ゴードン・ライアンのシステム", descJa: "ワールドチャンピオンのレッグロックシステム分析", category: "アドバンスト" },
  { slug: "bjj-marcelo-garcia-system", titleJa: "マルセロ・ガルシアのシステム", descJa: "ギロチン・バック・バタフライの三角体系", category: "アドバンスト" },
  { slug: "bjj-submission-defense-systems", titleJa: "サブミッションディフェンスシステム", descJa: "各種サブミッションへの防御と脱出の体系", category: "ディフェンス" },
  // ビギナー
  { slug: "bjj-complete-beginners-guide", titleJa: "BJJ完全初心者ガイド", descJa: "初心者が知るべき基礎知識と最初の一歩", category: "ビギナー" },
  { slug: "bjj-blue-belt-guide", titleJa: "青帯へのロードマップ", descJa: "白帯から青帯昇格に必要なスキルと心構え", category: "ビギナー" },
  // Batch 332-336
  { slug: "bjj-grip-fighting-advanced", titleJa: "グリップファイティング上級", descJa: "グリップ支配・ブレイク・シークエンスの高度な体系", category: "グリップ" },
  { slug: "bjj-competition-tactics-advanced", titleJa: "競技タクティクス上級", descJa: "ゲームプラン開発・ブラケット管理・メンタル強化", category: "競技" },
  { slug: "bjj-periodization-training", titleJa: "BJJのピリオダイゼーション", descJa: "マクロ・メソサイクルで競技パフォーマンスを最大化", category: "フィジカル" },
  { slug: "bjj-nutrition-timing", titleJa: "BJJの栄養タイミング", descJa: "トレーニング前・中・後の栄養補給プロトコル", category: "栄養" },
  { slug: "bjj-mental-performance", titleJa: "メンタルパフォーマンスBJJ", descJa: "ビジュアライゼーション・自信構築・試合不安管理", category: "メンタル" },
  // Batch 337-341
  { slug: "bjj-advanced-concepts-guide", titleJa: "BJJアドバンスドコンセプト", descJa: "高レベル柔術の概念的フレームワークと原則体系", category: "アドバンスト" },
  { slug: "bjj-flow-rolling-advanced", titleJa: "フローローリング上級", descJa: "技術向上のためのフロー状態ロール入門と応用", category: "アドバンスト" },
  { slug: "bjj-positional-drilling-system", titleJa: "ポジショナルドリリングシステム", descJa: "ポジション別の構造化ドリルで技術を自動化する方法", category: "テクニック" },
  { slug: "bjj-guard-attacks-advanced-system", titleJa: "ガードアタック上級システム", descJa: "コンビネーションアタックで相手を崩す高度なガード攻撃", category: "ガード" },
  { slug: "bjj-passing-systems-complete", titleJa: "パッシングシステム完全版", descJa: "プレッシャー・スピード・レッグドラッグの統合パスシステム", category: "パッシング" },
  // Batch 342-346
  { slug: "bjj-advanced-leg-lock-systems", titleJa: "アドバンスドレッグロックシステム", descJa: "アシガラミエントリーからヒールフックメカニクスまでのモダンレッグロック体系", category: "レッグロック" },
  { slug: "bjj-competition-game-planning", titleJa: "競技ゲームプランニング", descJa: "ブラケット分析・Aゲーム構築・試合中の調整法", category: "競技" },
  { slug: "bjj-gi-vs-nogi-comparison", titleJa: "GiとノーギのBJJ比較", descJa: "グリップ差・ガードゲーム・ペース・トレーニング推奨の違い", category: "テクニック" },
  { slug: "bjj-black-belt-concepts", titleJa: "黒帯コンセプト", descJa: "効率性・感受性・原則ベースの理解で極意を掴む", category: "アドバンスト" },
  // Batch 347-351
  { slug: "bjj-submission-chain-attacks", titleJa: "サブミッションチェーンアタック", descJa: "サブミッションをつなげて止められない攻撃シーケンスを作る方法", category: "サブミッション" },
  { slug: "bjj-wrestling-integration", titleJa: "BJJのためのレスリング統合", descJa: "レスリングのテイクダウンとスクランブルをBJJゲームに統合する方法", category: "テイクダウン" },
  { slug: "bjj-back-system-advanced", titleJa: "バックシステム上級", descJa: "上級者のための完全なバックコントロール・維持・攻撃システム", category: "ポジション" },
  { slug: "bjj-guard-concepts-advanced", titleJa: "ガードコンセプト上級", descJa: "ガードプレイのハイレベルな概念的フレームワーク", category: "ガード" },
  { slug: "bjj-competition-prep-advanced", titleJa: "競技準備上級", descJa: "経験豊富な競技者のためのエリートレベル競技準備戦略", category: "競技" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "サブミッション": "bg-red-500/20 text-red-300",
  "レッグロック": "bg-pink-500/20 text-pink-300",
  "ガード": "bg-blue-500/20 text-blue-300",
  "ポジション": "bg-indigo-500/20 text-indigo-300",
  "ディフェンス": "bg-cyan-500/20 text-cyan-300",
  "パッシング": "bg-orange-500/20 text-orange-300",
  "スウィープ": "bg-yellow-500/20 text-yellow-300",
  "テイクダウン": "bg-green-500/20 text-green-300",
  "エスケープ": "bg-teal-500/20 text-teal-300",
  "競技": "bg-purple-500/20 text-purple-300",
  "メンタル": "bg-violet-500/20 text-violet-300",
  "フィジカル": "bg-emerald-500/20 text-emerald-300",
  "栄養": "bg-lime-500/20 text-lime-300",
  "アドバンスト": "bg-rose-500/20 text-rose-300",
  "ビギナー": "bg-sky-500/20 text-sky-300",
  "グリップ": "bg-amber-500/20 text-amber-300",
  "テクニック": "bg-blue-600/20 text-blue-200",
};

export default function DailyWikiTip() {
  const [showNext, setShowNext] = useState(false);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      86400000
  );
  const tip = WIKI_TIPS[dayOfYear % WIKI_TIPS.length];
  const tipNext = WIKI_TIPS[(dayOfYear + 1) % WIKI_TIPS.length];
  const lang = tip.lang ?? "ja";
  const wikiUrl = `${WIKI_BASE}/${lang}/${tip.slug}.html`;
  const nextLang = tipNext.lang ?? "ja";
  const nextUrl = `${WIKI_BASE}/${nextLang}/${tipNext.slug}.html`;
  const badgeClass = CATEGORY_COLORS[tip.category] ?? "bg-gray-500/20 text-gray-300";
  const nextBadgeClass = CATEGORY_COLORS[tipNext.category] ?? "bg-gray-500/20 text-gray-300";

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700/40">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📚</span>
        <span className="text-xs text-gray-400 font-medium">今日のBJJ知識</span>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
          {tip.category}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1 leading-snug">{tip.titleJa}</h3>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{tip.descJa}</p>
      <div className="flex items-center justify-between">
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#e94560] hover:text-[#ff6b6b] transition-colors font-medium"
        >
          <span>Wikiで詳しく読む</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <button
          onClick={() => setShowNext((v) => !v)}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
        >
          {showNext ? "▲ 閉じる" : `明日: ${tipNext.category} ▼`}
        </button>
      </div>

      {/* 次のヒントプレビュー — スライドアニメーション */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: showNext ? "160px" : "0px" }}
      >
        <div className="mt-3 pt-3 border-t border-gray-700/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-600">明日のヒント</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${nextBadgeClass}`}>
              {tipNext.category}
            </span>
          </div>
          <h4 className="text-xs font-semibold text-gray-300 mb-1 leading-snug">{tipNext.titleJa}</h4>
          <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">{tipNext.descJa}</p>
          <a
            href={nextUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-[#e94560] transition-colors"
          >
            <span>先読みする →</span>
          </a>
        </div>
      </div>
    </div>
  );
}
