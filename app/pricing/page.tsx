/**
 * /pricing — z184: Standalone pricing landing page
 *
 * 既存 PricingSection (Free + Pro) は LP 内 inline のみだったため、
 *   - /pricing で直接シェア / SEO / Reddit 流入できない
 *   - B2B Gym tier ($99) が露出してない
 * を解消する 3-tier 専用ページ。
 *
 * Top app reference (Notion / Linear / Stripe / Hevy):
 *   - Hero (positional headline)
 *   - 3 tier cards: Free / Pro / Gym
 *   - Monthly / Annual toggle (Pro)
 *   - 14-day trial badges
 *   - FAQ section
 *   - Single CTA per tier
 */

import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";
import { GYM_VALUE_PROPS, TRIAL_BADGE, GYM_TIER, pickLocale } from "@/lib/copy/funnel";

const PricingSection = dynamic(() => import("@/components/PricingSection"), {
  loading: () => (
    <div className="min-h-[400px] bg-zinc-900/50 animate-pulse rounded-2xl" />
  ),
});

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free forever for individual BJJ practitioners. Pro $9.99/mo for analytics. Gym Pro $99/mo for dojos. 14-day free trial.",
  alternates: { canonical: "https://bjj-app.net/pricing" },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/pricing",
    siteName: "BJJ App",
    title: "BJJ App Pricing — Free / Pro $9.99 / Gym $99",
    description:
      "Track BJJ training free forever. Pro for analytics. Gym Pro for dojos.",
  },
};

const COPY = {
  ja: {
    heroTitle: "シンプルな料金体系",
    heroSub: "個人ユーザーは永久無料。本格分析は Pro、道場管理は Gym Pro。",
    gymTier: "Gym Pro",
    gymTagline: "道場全体を管理",
    faqTitle: "よくある質問",
    faqs: [
      {
        q: "本当に無料で使い続けられますか?",
        a: "はい。練習ログ、テクニック記録、目標トラッカー、ヒートマップ、 グラフは永久無料です。",
      },
      {
        q: "Pro と Gym Pro の違いは?",
        a: "Pro ($9.99/月) は個人向けで高度な分析、AIコーチ、無制限スキルマップが使えます。Gym Pro ($99/月) は道場主向けで、生徒全員の練習頻度や離脱リスクを管理できます。",
      },
      {
        q: "途中でキャンセルできますか?",
        a: "はい。トライアル中はいつでもキャンセル可、その後も7日間返金保証があります。",
      },
      {
        q: "支払い方法は?",
        a: "Stripe 経由でクレジットカード/デビットカードに対応。トライアル中はカード情報不要です。",
      },
    ],
  },
  pt: {
    heroTitle: "Preços simples",
    heroSub:
      "Grátis para sempre para usuários individuais. Pro para análise séria. Gym Pro para dojos.",
    gymTier: "Gym Pro",
    gymTagline: "Gerencie todo o dojo",
    faqTitle: "Perguntas frequentes",
    faqs: [
      {
        q: "Posso usar grátis para sempre?",
        a: "Sim. Logs de treino, técnicas, metas, mapa de calor e gráficos são grátis para sempre.",
      },
      {
        q: "Qual a diferença entre Pro e Gym Pro?",
        a: "Pro ($9,99/mês) é individual: análise avançada, AI coach, skill map ilimitado. Gym Pro ($99/mês) é para donos de dojos: gerencie frequência e risco de evasão de todos os alunos.",
      },
      {
        q: "Posso cancelar a qualquer momento?",
        a: "Sim. Durante o teste pode cancelar. Depois há garantia de 7 dias.",
      },
      {
        q: "Quais formas de pagamento?",
        a: "Cartão de crédito/débito via Stripe. Sem cartão durante o teste.",
      },
    ],
  },
  en: {
    heroTitle: "Simple pricing",
    heroSub: "Free forever for individuals. Pro for serious analytics. Gym Pro for dojos.",
    gymTier: "Gym Pro",
    gymTagline: "Manage your whole dojo",
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "Is it really free forever?",
        a: "Yes. Training logs, technique journal, goals, heatmap, and charts are free forever.",
      },
      {
        q: "What's the difference between Pro and Gym Pro?",
        a: "Pro ($9.99/mo) is for individuals — advanced analytics, AI coach, unlimited skill map. Gym Pro ($99/mo) is for dojo owners — manage every student's frequency and churn risk.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel anytime during trial. After that, 7-day money-back guarantee.",
      },
      {
        q: "What payment methods?",
        a: "Credit/debit card via Stripe. No card required during trial.",
      },
    ],
  },
} as const;

// JSON-LD: Product + Offer schema for rich snippets in search results
const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "BJJ App",
  description: "Brazilian Jiu-Jitsu training tracker. Free forever for individuals.",
  url: "https://bjj-app.net/pricing",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "9.99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Gym Pro",
      price: "99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  ],
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await detectServerLocale();
  const t = makeT(locale);
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  // z190: 一元化された value props を pull
  const gymProps = pickLocale(GYM_VALUE_PROPS, locale);
  const gymTrialBadge = pickLocale(TRIAL_BADGE, locale);
  const gymPer = pickLocale(GYM_TIER.perMonth, locale);
  const gymCta = pickLocale(GYM_TIER.trialCta, locale);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  // Fetch isPro for NavBar (only if logged in)
  let isPro = false;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single();
    isPro = prof?.is_pro ?? false;
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(pricingJsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        {/* Hero */}
        <section className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
            {c.heroTitle}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
            {c.heroSub}
          </p>
        </section>

        {/* B2C tiers (Free + Pro, with monthly/annual toggle) */}
        <PricingSection userId={user?.id ?? null} />

        {/* B2B Gym tier */}
        <section className="mt-12 max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 ring-2 ring-emerald-500/40 rounded-2xl p-7 sm:p-9 text-center">
            <div className="text-emerald-400 font-semibold text-sm tracking-widest uppercase mb-2">
              {c.gymTier}
            </div>
            <p className="text-zinc-300 text-sm mb-3">{c.gymTagline}</p>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-5xl font-bold text-white tabular-nums">
                {GYM_TIER.price}
              </span>
              <span className="text-zinc-400 text-lg">{gymPer}</span>
            </div>
            <div className="text-emerald-300 text-sm mb-6">
              {gymTrialBadge}
            </div>

            <ul className="grid sm:grid-cols-2 gap-2 mb-6 text-left">
              {gymProps.map((f, i) => (
                <li
                  key={i}
                  className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-lg px-3 py-2 text-sm text-zinc-200"
                >
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={user ? "/gym/upgrade?ref=pricing" : "/login?next=/gym/upgrade?ref=pricing"}
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-8 rounded-xl"
            >
              {gymCta}
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            {c.faqTitle}
          </h2>
          <div className="space-y-4">
            {c.faqs.map((faq, i) => (
              <details
                key={i}
                className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-xl px-5 py-4 group"
              >
                <summary className="cursor-pointer font-semibold text-white text-base list-none flex items-center justify-between">
                  {faq.q}
                  <span className="text-zinc-500 group-open:rotate-90 transition-transform text-lg">
                    ›
                  </span>
                </summary>
                <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
