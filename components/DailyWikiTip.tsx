"use client";

// DailyWikiTip — 日替わりBJJ Wikiページ推薦コンポーネント
// 年の通算日でWikiページをローテーション表示

const WIKI_BASE = "https://bjj-wiki.com";

type WikiTip = {
  slug: string;
  titleJa: string;
  descJa: string;
  category: string;
};

const WIKI_TIPS: WikiTip[] = [
  { slug: "bjj-triangle-choke-guide", titleJa: "トライアングルチョーク完全ガイド", descJa: "セットアップからフィニッシュまで詳細解説", category: "サブミッション" },
  { slug: "bjj-armbar-guide", titleJa: "アームバー（腕十字）完全ガイド", descJa: "ガード・マウント・サイドからの腕十字", category: "サブミッション" },
  { slug: "bjj-guard-passing-fundamentals", titleJa: "ガードパスの基礎", descJa: "プレッシャーパスとスピードパスの使い分け", category: "パッシング" },
  { slug: "bjj-mount-system", titleJa: "マウントシステム", descJa: "マウントコントロールから攻撃への連携", category: "ポジション" },
  { slug: "bjj-back-control-system", titleJa: "バックコントロールシステム", descJa: "シートベルトからRNC・ボウアンドアロー", category: "ポジション" },
  { slug: "bjj-de-la-riva-guard", titleJa: "デラヒーバガード", descJa: "エントリー・スウィープ・バックテイク", category: "ガード" },
  { slug: "bjj-half-guard-guide", titleJa: "ハーフガード完全ガイド", descJa: "ニーシールド・アンダーフック・ロックダウン", category: "ガード" },
  { slug: "bjj-kimura-lock-guide", titleJa: "キムラ（腕がらみ）ガイド", descJa: "キムラトラップシステムで連携する方法", category: "サブミッション" },
  { slug: "bjj-heel-hook-guide", titleJa: "ヒールフックガイド", descJa: "アシガラミからのアウトサイド・インサイドヒールフック", category: "レッグロック" },
  { slug: "bjj-leg-lock-system", titleJa: "レッグロックシステム", descJa: "ヒールフック・ニーバー・カーフスライサー体系", category: "レッグロック" },
  { slug: "bjj-butterfly-guard", titleJa: "バタフライガード", descJa: "フック・スウィープ・バックテイクの総合ガイド", category: "ガード" },
  { slug: "bjj-x-guard-position-guide", titleJa: "Xガードポジション", descJa: "Xガードからのスウィープとレッグ攻撃", category: "ガード" },
  { slug: "bjj-rubber-guard-guide", titleJa: "ラバーガードガイド", descJa: "ミッションコントロールからゴゴプラタまで", category: "ガード" },
  { slug: "bjj-guard-retention-system", titleJa: "ガードリテンション（保持）システム", descJa: "フレーミング・ヒップエスケープ・リガードの体系", category: "ディフェンス" },
  { slug: "bjj-sweep-fundamentals", titleJa: "スウィープの基礎", descJa: "シザー・ヒップバンプ・フラワースウィープ解説", category: "スウィープ" },
  { slug: "bjj-omoplata-guide", titleJa: "オモプラータガイド", descJa: "ガードからのオモプラータ・コンボと使い方", category: "サブミッション" },
  { slug: "bjj-double-leg-takedown", titleJa: "ダブルレッグテイクダウン", descJa: "ショット・ドライブ・フィニッシュの完全解説", category: "テイクダウン" },
  { slug: "bjj-single-leg-takedown", titleJa: "シングルレッグテイクダウン", descJa: "ハイC・ランニングザパイプ・コンボ", category: "テイクダウン" },
  { slug: "bjj-mount-escape-system", titleJa: "マウントエスケープシステム", descJa: "ブリッジ・エルボーエスケープ・ガード再構築", category: "エスケープ" },
  { slug: "bjj-side-control-escape-guide", titleJa: "サイドコントロールエスケープ", descJa: "フレーム・ヒップエスケープ・タートル転換", category: "エスケープ" },
  { slug: "bjj-gordons-system-guide", titleJa: "ゴードン・ライアンのシステム", descJa: "ワールドチャンピオンのレッグロックシステム分析", category: "アドバンスト" },
  { slug: "bjj-marcelo-garcia-system", titleJa: "マルセロ・ガルシアのシステム", descJa: "ギロチン・バック・バタフライの三角体系", category: "アドバンスト" },
  { slug: "bjj-competition-preparation", titleJa: "BJJ大会準備ガイド", descJa: "ゲームプラン・メンタル・ウォームアップ", category: "競技" },
  { slug: "bjj-complete-beginners-guide", titleJa: "BJJ完全初心者ガイド", descJa: "初心者が知るべき基礎知識と最初の一歩", category: "ビギナー" },
  { slug: "bjj-blue-belt-guide", titleJa: "青帯へのロードマップ", descJa: "白帯から青帯昇格に必要なスキルと心構え", category: "ビギナー" },
  { slug: "bjj-sport-psychology", titleJa: "BJJのスポーツ心理学", descJa: "集中力・レジリエンス・試合メンタルの鍛え方", category: "メンタル" },
  { slug: "bjj-recovery-protocol-bjj", titleJa: "BJJ特化のリカバリー方法", descJa: "練習後の回復を最大化するプロトコル", category: "フィジカル" },
  { slug: "bjj-grip-strength-training", titleJa: "グリップ強化トレーニング", descJa: "BJJに特化したグリップ筋力の鍛え方", category: "フィジカル" },
];

export default function DailyWikiTip() {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      86400000
  );
  const tip = WIKI_TIPS[dayOfYear % WIKI_TIPS.length];
  const wikiUrl = `${WIKI_BASE}/ja/${tip.slug}.html`;

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700/40">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📚</span>
        <span className="text-xs text-gray-400 font-medium">今日のBJJ知識</span>
        <span className="ml-auto text-[10px] bg-[#e94560]/20 text-[#e94560] px-2 py-0.5 rounded-full">
          {tip.category}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1">{tip.titleJa}</h3>
      <p className="text-xs text-gray-400 mb-3">{tip.descJa}</p>
      <a
        href={wikiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[#e94560] hover:text-[#ff6b6b] transition-colors"
      >
        <span>Wikiで詳しく読む</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
