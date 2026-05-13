/**
 * /legal/dpa — z255d: 3 言語対応 (EN canonical / JA / PT — translated via Gemini)
 * 翻訳キー: messages/{en,ja,pt}.json の dpa.* 配下、scripts/translate_legal_pages.py で生成
 */
import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";

// z260h: locale-aware metadata + og:image
// 旧: static EN-only → JA/PT user の SERP に英語表示、og:locale 欠落、
//     og:image 欠落で X/Slack share preview が text-only に
const DPA_OG_IMAGE = "https://bjj-app.net/api/og?belt=white&count=0&months=0&streak=0&mode=lp";

const DPA_META = {
  en: {
    title: "Data Processing Agreement (DPA)",
    desc: "Summary of our Data Processing Agreement pursuant to GDPR Article 28.",
    ogTitle: "Data Processing Agreement (DPA) | BJJ App",
  },
  ja: {
    title: "データ処理契約 (DPA)",
    desc: "GDPR 第 28 条に基づくデータ処理契約 (DPA) の概要。",
    ogTitle: "データ処理契約 (DPA) | BJJ App",
  },
  pt: {
    title: "Contrato de Processamento de Dados (DPA)",
    desc: "Resumo do nosso Contrato de Processamento de Dados conforme o Artigo 28 do GDPR.",
    ogTitle: "Contrato de Processamento de Dados (DPA) | BJJ App",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectServerLocale();
  const m = DPA_META[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  return {
    title: m.title,
    description: m.desc,
    robots: { index: true, follow: true },
    alternates: { canonical: "https://bjj-app.net/legal/dpa" },
    openGraph: {
      title: m.ogTitle,
      description: m.desc,
      url: "https://bjj-app.net/legal/dpa",
      siteName: "BJJ App",
      type: "article",
      images: [{ url: DPA_OG_IMAGE, width: 1200, height: 630, alt: "BJJ App DPA" }],
      locale: locale === "ja" ? "ja_JP" : locale === "pt" ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: m.ogTitle,
      description: m.desc,
      images: [DPA_OG_IMAGE],
    },
  };
}

// z260i: Article / BreadcrumbList JSON-LD で legal page を crawler に明示
const dpaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Data Processing Agreement (DPA)",
      description: "Summary of our Data Processing Agreement pursuant to GDPR Article 28.",
      url: "https://bjj-app.net/legal/dpa",
      author: { "@type": "Organization", name: "BJJ App Inc.", url: "https://bjj-app.net" },
      publisher: { "@type": "Organization", name: "BJJ App Inc.", url: "https://bjj-app.net" },
      inLanguage: ["en", "ja", "pt"],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "BJJ App", item: "https://bjj-app.net" },
        { "@type": "ListItem", position: 2, name: "Legal", item: "https://bjj-app.net/legal/dpa" },
        { "@type": "ListItem", position: 3, name: "DPA", item: "https://bjj-app.net/legal/dpa" },
      ],
    },
  ],
};

export default async function DPAPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white py-12 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(dpaJsonLd) }}
      />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t("dpa.title")}</h1>
        <p className="text-zinc-400 text-sm mb-8">{t("dpa.subtitle")}</p>

        <div className="space-y-8 text-zinc-300 text-sm leading-relaxed">
          {/* §1 Parties */}
          <Section title={t("dpa.section1.title")}>
            <p>
              <strong className="text-white">{t("dpa.section1.controllerLabel")}</strong>{" "}
              {t("dpa.section1.controllerDesc")}
            </p>
            <p className="mt-2">
              <strong className="text-white">{t("dpa.section1.processorLabel")}</strong>{" "}
              {t("dpa.section1.processorDesc")}
            </p>
          </Section>

          {/* §2 Scope */}
          <Section title={t("dpa.section2.title")}>
            <p>{t("dpa.section2.intro")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("dpa.section2.item1")}</li>
              <li>{t("dpa.section2.item2")}</li>
              <li>{t("dpa.section2.item3")}</li>
              <li>{t("dpa.section2.item4")}</li>
            </ul>
          </Section>

          {/* §3 Sub-processors */}
          <Section title={t("dpa.section3.title")}>
            <p>{t("dpa.section3.intro")}</p>
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="text-left py-2">{t("dpa.section3.headerService")}</th>
                  <th className="text-left py-2">{t("dpa.section3.headerPurpose")}</th>
                  <th className="text-left py-2">{t("dpa.section3.headerLocation")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <SubRow service="Supabase (AWS)" purpose={t("dpa.section3.supabasePurpose")} location={t("dpa.section3.supabaseLocation")} />
                <SubRow service="Vercel" purpose={t("dpa.section3.vercelPurpose")} location={t("dpa.section3.vercelLocation")} />
                <SubRow service="Stripe" purpose={t("dpa.section3.stripePurpose")} location={t("dpa.section3.stripeLocation")} />
                <SubRow service="Sentry" purpose={t("dpa.section3.sentryPurpose")} location={t("dpa.section3.sentryLocation")} />
                <SubRow service="Resend" purpose={t("dpa.section3.resendPurpose")} location={t("dpa.section3.resendLocation")} />
                <SubRow service="OpenAI" purpose={t("dpa.section3.openaiPurpose")} location={t("dpa.section3.openaiLocation")} />
              </tbody>
            </table>
          </Section>

          {/* §4 Security */}
          <Section title={t("dpa.section4.title")}>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("dpa.section4.item1")}</li>
              <li>{t("dpa.section4.item2")}</li>
              <li>{t("dpa.section4.item3")}</li>
              <li>{t("dpa.section4.item4")}</li>
              <li>{t("dpa.section4.item5")}</li>
              <li>{t("dpa.section4.item6")}</li>
            </ul>
          </Section>

          {/* §5 Data Subject Rights */}
          <Section title={t("dpa.section5.title")}>
            <p>{t("dpa.section5.intro")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">{t("dpa.section5.accessLabel")}</strong> {t("dpa.section5.accessDesc")}</li>
              <li><strong className="text-white">{t("dpa.section5.erasureLabel")}</strong> {t("dpa.section5.erasureDesc")}</li>
              <li><strong className="text-white">{t("dpa.section5.rectifyLabel")}</strong> {t("dpa.section5.rectifyDesc")}</li>
              <li><strong className="text-white">{t("dpa.section5.restrictLabel")}</strong> {t("dpa.section5.restrictDesc")}</li>
            </ul>
          </Section>

          {/* §6 Retention */}
          <Section title={t("dpa.section6.title")}>
            <p>
              {t("dpa.section6.intro_a")}{" "}
              <Link href="/privacy" className="text-emerald-400 underline underline-offset-2">
                {t("dpa.section6.linkLabel")}
              </Link>{" "}
              {t("dpa.section6.intro_b")}
            </p>
          </Section>

          {/* §7 Breach */}
          <Section title={t("dpa.section7.title")}>
            <p>
              {t("dpa.section7.intro_a")}{" "}
              <Link href="/privacy" className="text-emerald-400 underline underline-offset-2">
                {t("dpa.section7.linkLabel")}
              </Link>{" "}
              {t("dpa.section7.intro_b")}
            </p>
          </Section>

          {/* §8 Contact */}
          <Section title={t("dpa.section8.title")}>
            <p>{t("dpa.section8.intro")}</p>
            <p className="mt-2">
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 underline underline-offset-2">
                307239t777@gmail.com
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-white transition-colors">{t("dpa.footerPrivacy")}</Link>
          <Link href="/terms" className="hover:text-white transition-colors">{t("dpa.footerTerms")}</Link>
          <Link href="/legal/tokushoho" className="hover:text-white transition-colors">{t("dpa.footerTokushoho")}</Link>
          <Link href="/" className="hover:text-white transition-colors">{t("dpa.back")}</Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-white font-semibold text-base mb-2">{title}</h2>
      {children}
    </section>
  );
}

function SubRow({ service, purpose, location }: { service: string; purpose: string; location: string }) {
  return (
    <tr>
      <td className="py-1.5 text-zinc-300">{service}</td>
      <td className="py-1.5 text-zinc-400">{purpose}</td>
      <td className="py-1.5 text-zinc-400">{location}</td>
    </tr>
  );
}
