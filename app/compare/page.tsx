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

export const metadata: Metadata = {
  title: "BJJ App vs BJJBuddy vs BJJ Notes vs MatTime",
  description:
    "Honest comparison of BJJ training tracker apps. Wiki integration, languages, pricing, native apps — what each does well.",
  alternates: { canonical: "https://bjj-app.net/compare" },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/compare",
    siteName: "BJJ App",
    title: "BJJ App vs the others — honest comparison",
    description: "BJJBuddy, BJJ Notes, MatTime, BJJ App — what each does well and where each falls short.",
    images: [{ url: COMPARE_OG, width: 1200, height: 630, alt: "BJJ App comparison" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJJ App vs the others",
    description: "Honest indie comparison of BJJ training tracker apps.",
    images: [COMPARE_OG],
  },
};

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

const COPY = {
  ja: {
    backToApp: "ホームに戻る",
    heroTitle: "BJJ アプリ比較 — 正直に",
    heroSub: "BJJBuddy / BJJ Notes / MatTime / BJJ App。各々の強みと弱みを並べました。我々が劣る点も隠さず書いてます。",
    tableTitle: "機能比較表",
    cardsTitle: "どれを選ぶか",
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
    cardsTitle: "Qual escolher",
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
    cardsTitle: "Which to pick",
    ctaTitle: "If you want to try BJJ App",
    ctaSub: "If Wiki + multilingual matter to you, 30 seconds to try.",
    ctaPrimary: "Start for free →",
    sourceNote: "※ Competitor data sourced April 2026 from each company's website. Spot an error? 307239t777@gmail.com",
  },
} as const;

const ROWS: CompareRow[] = [
  {
    feature: "Free tier",
    bjjApp: "✅ Free forever (core)",
    bjjBuddy: "✅ Fully free",
    bjjNotes: "✅ Free",
    matTime: "✅ Free + Premium",
  },
  {
    feature: "Paid tier",
    bjjApp: "Pro $9.99/mo (analytics + AI coach)",
    bjjBuddy: "—",
    bjjNotes: "—",
    matTime: "Premium (no public price)",
  },
  {
    feature: "Wiki integration",
    bjjApp: "✅ 1,500+ pages on every technique",
    bjjBuddy: "❌",
    bjjNotes: "Searchable knowledge base only",
    matTime: "❌",
  },
  {
    feature: "Languages",
    bjjApp: "✅ EN / JA / PT",
    bjjBuddy: "EN only",
    bjjNotes: "EN only",
    matTime: "EN only",
  },
  {
    feature: "Platform",
    bjjApp: "Web / PWA (no install)",
    bjjBuddy: "iOS / Android native",
    bjjNotes: "iOS / Android native",
    matTime: "Native (mobile)",
  },
  {
    feature: "AI features",
    bjjApp: "Pro tier: AI coach feedback",
    bjjBuddy: "❌",
    bjjNotes: "✅ AI insights / pattern detection",
    matTime: "❌",
  },
  {
    feature: "Heatmap / streak",
    bjjApp: "✅ 365-day Duolingo-style",
    bjjBuddy: "Charts & stats",
    bjjNotes: "Performance reports",
    matTime: "Weekly / monthly analytics",
  },
  {
    feature: "Skill / technique tree",
    bjjApp: "✅ Skill Map by position",
    bjjBuddy: "Submission tracking",
    bjjNotes: "Win rates by position / guard",
    matTime: "Technique skill levels",
  },
  {
    feature: "Belt tracking",
    bjjApp: "✅ Auto-calc months at belt",
    bjjBuddy: "✅",
    bjjNotes: "✅ Belt + stripes",
    matTime: "✅ Toward 10,000 hours",
  },
  {
    feature: "Social / leaderboard",
    bjjApp: "❌ (planned)",
    bjjBuddy: "Follow friends",
    bjjNotes: "—",
    matTime: "✅ Gym leaderboards",
  },
  {
    feature: "User base claim",
    bjjApp: "Indie / honest (1 user — me)",
    bjjBuddy: "—",
    bjjNotes: "20,000+ practitioners",
    matTime: "1000s hours tracked",
  },
  {
    feature: "Funding",
    bjjApp: "Indie blue belt, no VC",
    bjjBuddy: "Not disclosed",
    bjjNotes: "Not disclosed",
    matTime: "Not disclosed",
  },
  {
    feature: "Data export",
    bjjApp: "✅ CSV anytime",
    bjjBuddy: "Unknown",
    bjjNotes: "Unknown",
    matTime: "Unknown",
  },
];

const CARDS: AppCard[] = [
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
];

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
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];

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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd(ROWS)) }}
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
          {CARDS.map((card) => (
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
                  <dt className="text-emerald-400 font-medium mb-0.5">+ Good at</dt>
                  <dd className="text-zinc-300 leading-relaxed">{card.goodAt}</dd>
                </div>
                <div>
                  <dt className="text-amber-400 font-medium mb-0.5">− Not so good</dt>
                  <dd className="text-zinc-400 leading-relaxed">{card.notSoGood}</dd>
                </div>
                <div>
                  <dt className="text-zinc-300 font-medium mb-0.5">Pick if</dt>
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
                  Feature
                </th>
                <th className="py-3 px-2 font-medium text-emerald-400">BJJ App</th>
                <th className="py-3 px-2 font-medium text-zinc-400">BJJBuddy</th>
                <th className="py-3 px-2 font-medium text-zinc-400">BJJ Notes</th>
                <th className="py-3 px-2 font-medium text-zinc-400">MatTime</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
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
