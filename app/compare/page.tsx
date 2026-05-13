/**
 * /compare — z221: BJJ app comparison page (vs BJJBuddy / BJJ Notes / MatTime)
 *
 * 目的:
 *   1. SEO: 「bjj app vs bjj notes」「best bjj tracker」等の比較 keyword 捕捉
 *   2. Reddit/HN 投稿時の「fact check 先回り」: 評価軸を我々が定義
 *   3. 実際 audit した z220 結果 (BJJBuddy/BJJ Notes/MatTime hero/pricing/feature)
 *      を表で公開、competitive transparency で trust 構築
 *
 * Top app reference (Cal.com /vs-calendly, Linear /vs-jira, Plausible /vs-ga):
 *   - 競合を sg しない、事実だけ並べる
 *   - 我々が劣る部分も honest に書く
 *   - 競合を選ぶ理由も併記 (potential user の信頼を逆に得る)
 *
 * 注意: 競合主張の数値 (BJJ Notes 「20,000+」) はそのまま記載 (我々が verify
 * する責任なし)。ただし「我々の側」の数字は z201 で撲滅した fake stats を
 * 二度と入れない。
 */

import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";

const COMPARE_OG = "https://bjj-app.net/api/og?mode=lp&lang=en&belt=blue&count=1500&streak=14&months=14";

// z260g: locale-aware metadata (BACKLOG F-12 続き)
const COMPARE_META = {
  en: {
    title: "BJJ App vs BJJBuddy vs BJJ Notes vs MatTime",
    desc: "Honest comparison of BJJ training tracker apps. Wiki integration, languages, pricing, native apps — what each does well.",
    ogTitle: "BJJ App vs the others — honest comparison",
    ogDesc: "BJJBuddy, BJJ Notes, MatTime, BJJ App — what each does well and where each falls short.",
    twTitle: "BJJ App vs the others",
    twDesc: "Honest indie comparison of BJJ training tracker apps.",
  },
  ja: {
    title: "BJJ App vs BJJBuddy / BJJ Notes / MatTime",
    desc: "BJJ 練習トラッカーアプリの正直な比較。Wiki 統合、言語、価格、ネイティブアプリ — 各社の強みを並べました。",
    ogTitle: "BJJ App vs 競合 — 正直な比較",
    ogDesc: "BJJBuddy / BJJ Notes / MatTime / BJJ App — 各々の強みと弱みを並べました。",
    twTitle: "BJJ App vs 競合",
    twDesc: "BJJ 練習トラッカーアプリの正直な比較。",
  },
  pt: {
    title: "BJJ App vs BJJBuddy vs BJJ Notes vs MatTime",
    desc: "Comparação honesta de apps de treino de BJJ. Integração com Wiki, idiomas, preços, apps nativos — o que cada um faz bem.",
    ogTitle: "BJJ App vs os outros — comparação honesta",
    ogDesc: "BJJBuddy, BJJ Notes, MatTime, BJJ App — o que cada um faz bem e onde falha.",
    twTitle: "BJJ App vs os outros",
    twDesc: "Comparação indie honesta de apps de treino de BJJ.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectServerLocale();
  const m = COMPARE_META[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  return {
    title: m.title,
    description: m.desc,
    alternates: { canonical: "https://bjj-app.net/compare" },
    openGraph: {
      type: "website",
      url: "https://bjj-app.net/compare",
      siteName: "BJJ App",
      title: m.ogTitle,
      description: m.ogDesc,
      images: [{ url: COMPARE_OG, width: 1200, height: 630, alt: "BJJ App comparison" }],
      locale: locale === "ja" ? "ja_JP" : locale === "pt" ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: m.twTitle,
      description: m.twDesc,
      images: [COMPARE_OG],
    },
  };
}

type CompareRow = {
  feature: string;
  bjjApp: string;
  bjjBuddy: string;
  bjjNotes: string;
  matTime: string;
};

type AppCard = {
  name: string;
  url: string;
  emoji: string;
  goodAt: string;
  notSoGood: string;
  pickIf: string;
};

// 注意: 競合の数値主張はそのまま記載 (z220 audit 時点、各社サイトから引用)
// 我々の数値は honest only (z201 で fake stats 撲滅、これ以上嘘禁止)

// z255c: 3 言語完全対応 (旧 COPY は hero/footer のみで card/table 中身が英語残り)
const COPY = {
  ja: {
    backToApp: "ホームに戻る",
    heroTitle: "BJJ アプリ比較 — 正直に",
    heroSub: "BJJBuddy / BJJ Notes / MatTime / BJJ App。各々の強みと弱みを並べました。我々が劣る点も隠さず書いてます。",
    tableTitle: "機能比較表",
    tableHeaderFeature: "機能",
    cardsTitle: "どれを選ぶか",
    goodAtLabel: "+ 強み",
    notSoGoodLabel: "− 弱み",
    pickIfLabel: "選ぶべき人",
    ctaTitle: "BJJ App を試すなら",
    ctaSub: "Wiki と多言語が刺さるなら、30 秒で試せます。",
    ctaPrimary: "無料で始める →",
    sourceNote: "※ 競合データは 2026年4月時点の各社公式サイトから引用。誤りがあれば 307239t777@gmail.com まで指摘ください。",
  },
  pt: {
    backToApp: "Voltar ao início",
    heroTitle: "Apps de BJJ comparados — honestamente",
    heroSub: "BJJBuddy / BJJ Notes / MatTime / BJJ App. Pontos fortes e fracos lado a lado. Onde perdemos, dizemos.",
    tableTitle: "Tabela de comparação",
    tableHeaderFeature: "Recurso",
    cardsTitle: "Qual escolher",
    goodAtLabel: "+ Pontos fortes",
    notSoGoodLabel: "− Pontos fracos",
    pickIfLabel: "Escolha se",
    ctaTitle: "Para testar o BJJ App",
    ctaSub: "Se Wiki + multilíngue te atrai, 30 segundos pra testar.",
    ctaPrimary: "Começar grátis →",
    sourceNote: "※ Dados dos concorrentes coletados em abril/2026 dos sites oficiais. Erros? Avise: 307239t777@gmail.com",
  },
  en: {
    backToApp: "Back to home",
    heroTitle: "BJJ App comparison — honest",
    heroSub: "BJJBuddy, BJJ Notes, MatTime, BJJ App. Strengths and weaknesses side by side. Where we lose, we say so.",
    tableTitle: "Feature comparison",
    tableHeaderFeature: "Feature",
    cardsTitle: "Which to pick",
    goodAtLabel: "+ Good at",
    notSoGoodLabel: "− Not so good",
    pickIfLabel: "Pick if",
    ctaTitle: "If you want to try BJJ App",
    ctaSub: "If Wiki + multilingual matter to you, 30 seconds to try.",
    ctaPrimary: "Start for free →",
    sourceNote: "※ Competitor data sourced April 2026 from each company's website. Spot an error? 307239t777@gmail.com",
  },
} as const;

// z255c: ROWS / CARDS を locale-keyed に変換 (cells/feature 名は locale 依存、
// app 名/URL/emoji は共通)
type Locale = "en" | "ja" | "pt";

const ROWS_BY_LOCALE: Record<Locale, CompareRow[]> = {
  en: [
    { feature: "Free tier", bjjApp: "✅ Free forever (core)", bjjBuddy: "✅ Fully free", bjjNotes: "✅ Free", matTime: "✅ Free + Premium" },
    { feature: "Paid tier", bjjApp: "Pro $9.99/mo (analytics + AI coach)", bjjBuddy: "—", bjjNotes: "—", matTime: "Premium (no public price)" },
    { feature: "Wiki integration", bjjApp: "✅ 1,500+ pages on every technique", bjjBuddy: "❌", bjjNotes: "Searchable knowledge base only", matTime: "❌" },
    { feature: "Languages", bjjApp: "✅ EN / JA / PT", bjjBuddy: "EN only", bjjNotes: "EN only", matTime: "EN only" },
    { feature: "Platform", bjjApp: "Web / PWA (no install)", bjjBuddy: "iOS / Android native", bjjNotes: "iOS / Android native", matTime: "Native (mobile)" },
    { feature: "AI features", bjjApp: "Pro tier: AI coach feedback", bjjBuddy: "❌", bjjNotes: "✅ AI insights / pattern detection", matTime: "❌" },
    { feature: "Heatmap / streak", bjjApp: "✅ 365-day Duolingo-style", bjjBuddy: "Charts & stats", bjjNotes: "Performance reports", matTime: "Weekly / monthly analytics" },
    { feature: "Skill / technique tree", bjjApp: "✅ Skill Map by position", bjjBuddy: "Submission tracking", bjjNotes: "Win rates by position / guard", matTime: "Technique skill levels" },
    { feature: "Belt tracking", bjjApp: "✅ Auto-calc months at belt", bjjBuddy: "✅", bjjNotes: "✅ Belt + stripes", matTime: "✅ Toward 10,000 hours" },
    { feature: "Social / leaderboard", bjjApp: "❌ (planned)", bjjBuddy: "Follow friends", bjjNotes: "—", matTime: "✅ Gym leaderboards" },
    { feature: "User base claim", bjjApp: "Indie / honest (1 user — me)", bjjBuddy: "—", bjjNotes: "20,000+ practitioners", matTime: "1000s hours tracked" },
    { feature: "Funding", bjjApp: "Indie blue belt, no VC", bjjBuddy: "Not disclosed", bjjNotes: "Not disclosed", matTime: "Not disclosed" },
    { feature: "Data export", bjjApp: "✅ CSV anytime", bjjBuddy: "Unknown", bjjNotes: "Unknown", matTime: "Unknown" },
  ],
  ja: [
    { feature: "無料プラン", bjjApp: "✅ 永久無料 (コア機能)", bjjBuddy: "✅ 完全無料", bjjNotes: "✅ 無料", matTime: "✅ 無料 + Premium" },
    { feature: "有料プラン", bjjApp: "Pro $9.99/月 (分析 + AI コーチ)", bjjBuddy: "—", bjjNotes: "—", matTime: "Premium (価格非公開)" },
    { feature: "Wiki 連携", bjjApp: "✅ 1,500+ ページの技術解説", bjjBuddy: "❌", bjjNotes: "検索可能なナレッジベースのみ", matTime: "❌" },
    { feature: "対応言語", bjjApp: "✅ EN / JA / PT", bjjBuddy: "英語のみ", bjjNotes: "英語のみ", matTime: "英語のみ" },
    { feature: "プラットフォーム", bjjApp: "Web / PWA (インストール不要)", bjjBuddy: "iOS / Android ネイティブ", bjjNotes: "iOS / Android ネイティブ", matTime: "ネイティブ (モバイル)" },
    { feature: "AI 機能", bjjApp: "Pro: AI コーチによるフィードバック", bjjBuddy: "❌", bjjNotes: "✅ AI 分析 / パターン検出", matTime: "❌" },
    { feature: "ヒートマップ / 連続記録", bjjApp: "✅ 365 日 Duolingo 風", bjjBuddy: "グラフ・統計", bjjNotes: "パフォーマンスレポート", matTime: "週次 / 月次の分析" },
    { feature: "スキル / 技術ツリー", bjjApp: "✅ ポジション別 Skill Map", bjjBuddy: "サブミッション記録", bjjNotes: "ポジション別 / ガード別勝率", matTime: "技術レベル管理" },
    { feature: "帯トラッキング", bjjApp: "✅ 自動計算 (帯保持月数)", bjjBuddy: "✅", bjjNotes: "✅ 帯 + 線", matTime: "✅ 10,000 時間目安" },
    { feature: "ソーシャル / ランキング", bjjApp: "❌ (計画中)", bjjBuddy: "友達フォロー", bjjNotes: "—", matTime: "✅ ジム別ランキング" },
    { feature: "ユーザー数の主張", bjjApp: "indie / 正直 (実 user 1 名 — 私)", bjjBuddy: "—", bjjNotes: "20,000+ 練習者", matTime: "数千時間記録" },
    { feature: "資金調達", bjjApp: "indie 青帯、VC 無し", bjjBuddy: "非公開", bjjNotes: "非公開", matTime: "非公開" },
    { feature: "データエクスポート", bjjApp: "✅ CSV いつでも可", bjjBuddy: "不明", bjjNotes: "不明", matTime: "不明" },
  ],
  pt: [
    { feature: "Plano grátis", bjjApp: "✅ Grátis para sempre (núcleo)", bjjBuddy: "✅ Totalmente grátis", bjjNotes: "✅ Grátis", matTime: "✅ Grátis + Premium" },
    { feature: "Plano pago", bjjApp: "Pro $9.99/mês (análises + AI coach)", bjjBuddy: "—", bjjNotes: "—", matTime: "Premium (preço não público)" },
    { feature: "Integração Wiki", bjjApp: "✅ 1,500+ páginas em cada técnica", bjjBuddy: "❌", bjjNotes: "Apenas base de conhecimento pesquisável", matTime: "❌" },
    { feature: "Idiomas", bjjApp: "✅ EN / JA / PT", bjjBuddy: "Apenas EN", bjjNotes: "Apenas EN", matTime: "Apenas EN" },
    { feature: "Plataforma", bjjApp: "Web / PWA (sem instalação)", bjjBuddy: "iOS / Android nativo", bjjNotes: "iOS / Android nativo", matTime: "Nativo (mobile)" },
    { feature: "Recursos de AI", bjjApp: "Pro: feedback do AI coach", bjjBuddy: "❌", bjjNotes: "✅ AI insights / detecção de padrões", matTime: "❌" },
    { feature: "Mapa de calor / sequência", bjjApp: "✅ 365 dias estilo Duolingo", bjjBuddy: "Gráficos e estatísticas", bjjNotes: "Relatórios de desempenho", matTime: "Análises semanais / mensais" },
    { feature: "Mapa de habilidades / técnicas", bjjApp: "✅ Skill Map por posição", bjjBuddy: "Rastreio de finalizações", bjjNotes: "Taxa de vitória por posição / guarda", matTime: "Níveis de habilidade técnica" },
    { feature: "Rastreio de faixa", bjjApp: "✅ Cálculo automático de meses na faixa", bjjBuddy: "✅", bjjNotes: "✅ Faixa + graus", matTime: "✅ Rumo às 10,000 horas" },
    { feature: "Social / ranking", bjjApp: "❌ (planejado)", bjjBuddy: "Seguir amigos", bjjNotes: "—", matTime: "✅ Ranking por academia" },
    { feature: "Base de usuários alegada", bjjApp: "Indie / honesto (1 usuário — eu)", bjjBuddy: "—", bjjNotes: "20,000+ praticantes", matTime: "Milhares de horas registradas" },
    { feature: "Investimento", bjjApp: "Indie faixa azul, sem VC", bjjBuddy: "Não divulgado", bjjNotes: "Não divulgado", matTime: "Não divulgado" },
    { feature: "Exportar dados", bjjApp: "✅ CSV a qualquer momento", bjjBuddy: "Desconhecido", bjjNotes: "Desconhecido", matTime: "Desconhecido" },
  ],
};

const CARDS_BY_LOCALE: Record<Locale, AppCard[]> = {
  en: [
    {
      name: "BJJ App (us)",
      url: "https://bjj-app.net",
      emoji: "🥋",
      goodAt: "Wiki integration (1,500+ pages), 3 languages (EN/JA/PT), web access (no install), indie/no-VC transparency",
      notSoGood: "1 real user (me — that's the honest truth), no native mobile app yet, no social/leaderboard features yet, AI features less mature than BJJ Notes",
      pickIf: "You want technique reference + tracker in one place, you read JA or PT, or you don't want yet another app install",
    },
    {
      name: "BJJBuddy",
      url: "https://bjjbuddy.com",
      emoji: "📓",
      goodAt: "Established (since ~2016), App Store + Google Play presence, free, social features (follow friends), submission charts",
      notSoGood: "EN only, no wiki / technique reference content, no advanced analytics or AI",
      pickIf: "You want a simple submission tracker on iOS/Android with social features and don't need technique reference or multi-language",
    },
    {
      name: "BJJ Notes",
      url: "https://www.bjjnotes.app",
      emoji: "📊",
      goodAt: "AI-powered insights, 20,000+ user base, win rates by position/guard, advanced analytics, mature mobile UX",
      notSoGood: "EN only, no integrated technique wiki (searchable knowledge base only), no Pro/free tier transparency",
      pickIf: "You're an EN speaker who wants the most analytical / AI-driven tracker with the largest active community",
    },
    {
      name: "MatTime",
      url: "https://mattime.app",
      emoji: "⏱",
      goodAt: "\"Strava for BJJ\" social positioning, gym leaderboards, friend competition, 10,000-hour tracker, gym integrations",
      notSoGood: "EN only, no public pricing, no wiki / technique reference, less mature analytics than BJJ Notes",
      pickIf: "Your gym uses leaderboards or you train with friends and want social comparison features",
    },
  ],
  ja: [
    {
      name: "BJJ App (us)",
      url: "https://bjj-app.net",
      emoji: "🥋",
      goodAt: "Wiki 連携 (1,500+ ページ)、3 言語 (EN/JA/PT)、Web アクセス (インストール不要)、indie/VC 無しで透明性",
      notSoGood: "実 user 1 名のみ (正直に言って私本人)、ネイティブモバイル app まだ無し、ソーシャル/ランキング機能まだ無し、AI 機能は BJJ Notes より未成熟",
      pickIf: "技術リファレンスとトラッカーを 1 箇所で済ませたい / JA・PT で読みたい / app をもう 1 つ入れたくない",
    },
    {
      name: "BJJBuddy",
      url: "https://bjjbuddy.com",
      emoji: "📓",
      goodAt: "歴史 (2016〜) と App Store / Google Play 出店、無料、ソーシャル機能 (友達フォロー)、サブミッション統計",
      notSoGood: "英語のみ、Wiki / 技術リファレンス無し、高度な分析・AI 無し",
      pickIf: "iOS/Android のシンプルなサブミッショントラッカーで、ソーシャル機能が欲しく、技術リファレンスや多言語不要な人",
    },
    {
      name: "BJJ Notes",
      url: "https://www.bjjnotes.app",
      emoji: "📊",
      goodAt: "AI 分析、20,000+ user base、ポジション/ガード別勝率、高度な分析、洗練されたモバイル UX",
      notSoGood: "英語のみ、Wiki 統合無し (検索可能なナレッジベースのみ)、Pro/Free tier の透明性無し",
      pickIf: "英語話者で、最も分析的 / AI 駆動なトラッカーを使いたく、大規模アクティブコミュニティを求める人",
    },
    {
      name: "MatTime",
      url: "https://mattime.app",
      emoji: "⏱",
      goodAt: "「BJJ 版 Strava」のソーシャル路線、ジム別ランキング、友達対戦、10,000 時間トラッカー、ジム連携",
      notSoGood: "英語のみ、価格非公開、Wiki / 技術リファレンス無し、BJJ Notes より分析機能未成熟",
      pickIf: "ジムでランキングを使う、もしくは友達と一緒に練習してソーシャル比較したい人",
    },
  ],
  pt: [
    {
      name: "BJJ App (nós)",
      url: "https://bjj-app.net",
      emoji: "🥋",
      goodAt: "Integração Wiki (1,500+ páginas), 3 idiomas (EN/JA/PT), acesso web (sem instalação), transparência indie/sem-VC",
      notSoGood: "1 usuário real (eu — essa é a verdade), sem app mobile nativo ainda, sem recursos sociais/ranking ainda, recursos de AI menos maduros que BJJ Notes",
      pickIf: "Você quer referência técnica + tracker num só lugar, lê JA ou PT, ou não quer instalar mais um app",
    },
    {
      name: "BJJBuddy",
      url: "https://bjjbuddy.com",
      emoji: "📓",
      goodAt: "Estabelecido (desde ~2016), presença na App Store + Google Play, grátis, recursos sociais (seguir amigos), gráficos de finalizações",
      notSoGood: "Apenas EN, sem conteúdo wiki / referência técnica, sem análises avançadas ou AI",
      pickIf: "Você quer um tracker simples de finalizações no iOS/Android com recursos sociais e não precisa de referência técnica ou multi-idioma",
    },
    {
      name: "BJJ Notes",
      url: "https://www.bjjnotes.app",
      emoji: "📊",
      goodAt: "Insights com AI, base de 20,000+ usuários, taxas de vitória por posição/guarda, análises avançadas, UX mobile madura",
      notSoGood: "Apenas EN, sem wiki técnica integrada (apenas base de conhecimento pesquisável), sem transparência sobre Pro/free",
      pickIf: "Você é falante de EN e quer o tracker mais analítico / AI-driven com a maior comunidade ativa",
    },
    {
      name: "MatTime",
      url: "https://mattime.app",
      emoji: "⏱",
      goodAt: "Posicionamento \"Strava do BJJ\", rankings por academia, competição entre amigos, contador de 10,000 horas, integrações com academias",
      notSoGood: "Apenas EN, sem preço público, sem wiki / referência técnica, análises menos maduras que BJJ Notes",
      pickIf: "Sua academia usa rankings ou você treina com amigos e quer comparação social",
    },
  ],
};

const itemListJsonLd = (rows: readonly CompareRow[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "BJJ training tracker app comparison",
  numberOfItems: rows.length,
  itemListElement: rows.map((r, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: r.feature,
  })),
});

export default async function ComparePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await detectServerLocale();
  const t = makeT(locale);
  const localeKey: Locale = locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en";
  const c = COPY[localeKey];
  const cards = CARDS_BY_LOCALE[localeKey];
  const rows = ROWS_BY_LOCALE[localeKey];

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  let isPro = false;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single();
    isPro = prof?.is_pro ?? false;
  }

  const ctaHref = user ? "/dashboard" : "/login?ref=compare";

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd(rows)) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        {/* Back */}
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {c.backToApp}
        </Link>

        {/* Hero */}
        <section className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {c.heroTitle}
          </h1>
          <p className="text-base text-zinc-400 max-w-2xl">{c.heroSub}</p>
        </section>

        {/* App cards (which to pick) */}
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
          {c.cardsTitle}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {cards.map((card) => (
            <a
              key={card.name}
              href={card.url}
              target={card.url.includes("bjj-app.net") ? undefined : "_blank"}
              rel={card.url.includes("bjj-app.net") ? undefined : "noopener noreferrer"}
              className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.06] rounded-xl px-5 py-5 hover:ring-emerald-500/40 transition-colors block"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl flex-shrink-0">{card.emoji}</span>
                <h3 className="text-base font-semibold text-white">{card.name}</h3>
              </div>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-emerald-400 font-medium mb-0.5">{c.goodAtLabel}</dt>
                  <dd className="text-zinc-300 leading-relaxed">{card.goodAt}</dd>
                </div>
                <div>
                  <dt className="text-amber-400 font-medium mb-0.5">{c.notSoGoodLabel}</dt>
                  <dd className="text-zinc-400 leading-relaxed">{card.notSoGood}</dd>
                </div>
                <div>
                  <dt className="text-zinc-300 font-medium mb-0.5">{c.pickIfLabel}</dt>
                  <dd className="text-zinc-400 leading-relaxed">{card.pickIf}</dd>
                </div>
              </dl>
            </a>
          ))}
        </div>

        {/* Comparison table */}
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
          {c.tableTitle}
        </h2>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left">
                <th className="py-3 px-2 font-medium text-zinc-400 sticky left-0 bg-zinc-950">
                  {c.tableHeaderFeature}
                </th>
                <th className="py-3 px-2 font-medium text-emerald-400">BJJ App</th>
                <th className="py-3 px-2 font-medium text-zinc-400">BJJBuddy</th>
                <th className="py-3 px-2 font-medium text-zinc-400">BJJ Notes</th>
                <th className="py-3 px-2 font-medium text-zinc-400">MatTime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-b border-white/[0.04]">
                  <td className="py-3 px-2 text-zinc-300 font-medium sticky left-0 bg-zinc-950">
                    {row.feature}
                  </td>
                  <td className="py-3 px-2 text-zinc-200">{row.bjjApp}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.bjjBuddy}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.bjjNotes}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.matTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-500 mb-12 leading-relaxed">{c.sourceNote}</p>

        {/* CTA */}
        <section className="bg-zinc-900/40 border border-emerald-500/30 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-white mb-1">{c.ctaTitle}</h2>
          <p className="text-sm text-zinc-400 mb-5">{c.ctaSub}</p>
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-7 rounded-full transition-colors"
          >
            {c.ctaPrimary}
          </Link>
        </section>
      </main>
    </div>
  );
}
