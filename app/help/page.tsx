import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Frequently asked questions about BJJ App — training logs, technique tracking, streaks, gym features, and more.",
  alternates: {
    canonical: "https://bjj-app.net/help",
  },
};

type FaqItem = { q: string; a: string };

export default async function HelpPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  const faqs: FaqItem[] = [
    { q: t("help.faq1Q"), a: t("help.faq1A") },
    { q: t("help.faq2Q"), a: t("help.faq2A") },
    { q: t("help.faq3Q"), a: t("help.faq3A") },
    { q: t("help.faq4Q"), a: t("help.faq4A") },
    { q: t("help.faq5Q"), a: t("help.faq5A") },
    { q: t("help.faq6Q"), a: t("help.faq6A") },
    { q: t("help.faq7Q"), a: t("help.faq7A") },
    { q: t("help.faq8Q"), a: t("help.faq8A") },
  ];

  const troubleshooting: FaqItem[] = [
    { q: t("help.faq9Q"), a: t("help.faq9A") },
    { q: t("help.faq10Q"), a: t("help.faq10A") },
    { q: t("help.faq11Q"), a: t("help.faq11A") },
    { q: t("help.faq12Q"), a: t("help.faq12A") },
    { q: t("help.faq13Q"), a: t("help.faq13A") },
    { q: t("help.faq14Q"), a: t("help.faq14A") },
  ];

  const allFaqs = [...faqs, ...troubleshooting];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "BJJ App", url: "https://bjj-app.net" },
    { name: "Help & FAQ", url: "https://bjj-app.net/help" },
  ]);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t("help.back")}
        </Link>

        <h1 className="text-2xl font-black tracking-tight mb-2">
          {t("help.title")}
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          {t("help.subtitle")}
        </p>

        {/* FAQ accordion (CSS-only via details/summary) */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-zinc-900/60 border border-white/10 rounded-xl overflow-hidden"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-white list-none flex items-center justify-between gap-2 select-none">
                {faq.q}
                <svg
                  className="w-4 h-4 text-zinc-500 shrink-0 transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* Troubleshooting */}
        <h2 className="text-lg font-bold mt-10 mb-4">{t("help.troubleshootingTitle")}</h2>
        <p className="text-zinc-400 text-sm mb-4">{t("help.troubleshootingSubtitle")}</p>
        <div className="space-y-3">
          {troubleshooting.map((faq, i) => (
            <details
              key={`ts-${i}`}
              className="group bg-zinc-900/60 border border-white/10 rounded-xl overflow-hidden"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-white list-none flex items-center justify-between gap-2 select-none">
                {faq.q}
                <svg
                  className="w-4 h-4 text-zinc-500 shrink-0 transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-10 bg-zinc-900/40 border border-white/10 rounded-xl p-5 text-center">
          <p className="text-sm text-zinc-300 mb-3">{t("help.contactTitle")}</p>
          <a
            href="mailto:307239t777@gmail.com?subject=BJJ%20App%20Support"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {t("help.contactBtn")}
          </a>
        </div>
      </div>
    </div>
  );
}
