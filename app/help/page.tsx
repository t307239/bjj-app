import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/safeJsonLd";
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
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/help",
    siteName: "BJJ App",
    title: "Help & FAQ | BJJ App",
    description: "Frequently asked questions about BJJ App — training logs, technique tracking, streaks, gym features, and more.",
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t("help.back")}
        </Link>

        <h1 className="text-2xl font-black tracking-tight mb-2">
          {t("help.title")}
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          {t("help.subtitle")}
        </p>

        {/* Quick self-serve actions — §11 CS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
          {[
            { href: "/settings", icon: "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z", label: t("help.quickSettings") },
            { href: "/settings", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3", label: t("help.quickExport") },
            { href: "/profile", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z", label: t("help.quickProfile") },
          ].map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex flex-col items-center gap-2 bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-4 hover:bg-white/[0.04] transition-colors text-center"
            >
              <svg aria-hidden="true" className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-xs text-zinc-300 leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>

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
aria-hidden="true"                   className="w-4 h-4 text-zinc-500 shrink-0 transition-transform group-open:rotate-180"
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
aria-hidden="true"                   className="w-4 h-4 text-zinc-500 shrink-0 transition-transform group-open:rotate-180"
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
