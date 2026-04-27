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

// z204: indie tagline 入り OG image (z195 で動的化済の /api/og を mode=lp で叩く)
const PRICING_OG = "https://bjj-app.net/api/og?mode=lp&lang=en&belt=blue&count=1500&streak=14&months=14";

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
    images: [{ url: PRICING_OG, width: 1200, height: 630, alt: "BJJ App Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJJ App Pricing — Free / Pro $9.99 / Gym $99",
    description: "Track BJJ training free forever. Pro for analytics. Gym Pro for dojos.",
    images: [PRICING_OG],
  },
};

const COPY = {
  ja: {
    // z201: positional headline (旧 generic "シンプルな料金体系" → 「無料」を先に)
    heroTitle: "BJJ を記録、永久無料。",
    heroSub: "個人ユーザーは永久無料。本格分析は Pro、道場管理は Gym Pro。",
    // z201: honest indie signal (実数 1566 ページ / 3 言語 / 個人開発)
    trustItems: [
      "🥋 青帯による個人開発",
      "📚 1,500+ ページの無料テクニック解説",
      "🚫 広告なし・スパムなし・データ販売なし",
    ],
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
      // z202: trust-gap killer FAQs
      {
        q: "データを第三者に販売したり、広告に使ったりしませんか?",
        a: "一切しません。練習データは販売目的でも広告目的でも使いません。第三者トラッカーも非搭載です。Stripe (決済) と Supabase (データ保管) のみ利用しています。",
      },
      {
        q: "VC や投資家は入っていますか?",
        a: "入っていません。青帯による完全な個人開発です。ユーザーが望む機能だけを作り、収益化の圧力でデータを売る必要もありません。",
      },
      {
        q: "自分のデータをエクスポートできますか?",
        a: "はい。Settings 画面から練習ログを CSV 形式で全件エクスポート可能です。ロックインなしで、いつでも持ち出せます。",
      },
      {
        q: "もしサービスが終了したらデータはどうなりますか?",
        a: "事前告知の上で CSV エクスポート期間を設けます。データはあなたのものです。Pro/Gym Pro 課金中の方には未使用期間分を返金します。",
      },
    ],
  },
  pt: {
    // z201: positional headline (lead with free, not "simple pricing")
    heroTitle: "Registre seu BJJ. Grátis, para sempre.",
    heroSub:
      "Grátis para sempre para usuários individuais. Pro para análise séria. Gym Pro para dojos.",
    trustItems: [
      "🥋 Feito por faixa azul indie",
      "📚 1.500+ páginas wiki grátis sobre cada técnica",
      "🚫 Sem anúncios, spam ou venda de dados",
    ],
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
      // z202: trust-gap killer FAQs
      {
        q: "Vocês vendem ou usam meus dados para anúncios?",
        a: "Nunca. Seus dados de treino não são vendidos nem usados para anúncios. Não usamos rastreadores de terceiros. Apenas Stripe (pagamento) e Supabase (armazenamento).",
      },
      {
        q: "Têm VC ou investidores?",
        a: "Não. Projeto totalmente indie feito por um faixa azul. Construímos o que os usuários querem, sem pressão de monetização para vender dados.",
      },
      {
        q: "Posso exportar meus dados?",
        a: "Sim. Exporte todos seus logs de treino em CSV pela tela de Settings, a qualquer momento. Sem lock-in.",
      },
      {
        q: "E se o serviço encerrar, o que acontece com meus dados?",
        a: "Avisamos com antecedência e abrimos um período de exportação CSV. Seus dados são seus. Para assinantes Pro/Gym Pro, reembolsamos o período não usado.",
      },
    ],
  },
  en: {
    // z201: positional headline (lead with free, not "simple pricing")
    heroTitle: "Track your BJJ. Free, forever.",
    heroSub: "Free forever for individuals. Pro for serious analytics. Gym Pro for dojos.",
    trustItems: [
      "🥋 Built by an indie blue belt",
      "📚 1,500+ free wiki pages on every technique",
      "🚫 No ads, no spam, no data sold",
    ],
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
      // z202: trust-gap killer FAQs
      {
        q: "Will you sell my data or use it for ads?",
        a: "Never. Your training data is never sold or used for advertising. No third-party trackers. We only use Stripe (payments) and Supabase (storage).",
      },
      {
        q: "Are you VC-funded?",
        a: "No. This is a 100% indie project by a blue belt. We build what users want — no monetization pressure to sell your data.",
      },
      {
        q: "Can I export my data?",
        a: "Yes. Export all your training logs to CSV from the Settings screen anytime. No lock-in.",
      },
      {
        q: "What happens to my data if you shut down?",
        a: "We give advance notice and open a CSV export window. Your data is yours. Active Pro/Gym Pro subscribers get a refund for unused time.",
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
        <section className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
            {c.heroTitle}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
            {c.heroSub}
          </p>
        </section>

        {/* z201: Honest indie trust signals (replaces fake "15+ countries" claim) */}
        <section className="mb-12 max-w-3xl mx-auto">
          <ul className="grid sm:grid-cols-3 gap-3 text-center">
            {c.trustItems.map((item, i) => (
              <li
                key={i}
                className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-xl px-4 py-3 text-sm text-zinc-300"
              >
                {item}
              </li>
            ))}
          </ul>
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
