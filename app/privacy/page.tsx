/**
 * /privacy — z255d: 3 言語対応 (EN canonical / JA / PT — translated via Gemini)
 *
 * 経緯: MCP UI 巡回で完全英語と判明、JA/PT user に対して GDPR Art 12
 * (concise/clear/intelligible) や日本個人情報保護法的に問題。z255d で 3 lang 化。
 *
 * 翻訳キー: messages/{en,ja,pt}.json の privacy.* 配下、scripts/translate_legal_pages.py で生成
 */
import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for BJJ App — how we collect, use, and protect your data.",
  robots: { index: false },
  alternates: {
    canonical: "https://bjj-app.net/privacy",
  },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/privacy",
    siteName: "BJJ App",
    title: "Privacy Policy | BJJ App",
    description: "Privacy Policy for BJJ App — how we collect, use, and protect your data.",
  },
};

const TOC_IDS = [
  "collect", "use", "storage", "thirdParty", "cookies", "sharing",
  "rights", "portability", "retention", "children", "securityIncident",
  "ccpa", "changes", "contact",
] as const;

const TOC_KEY_MAP: Record<typeof TOC_IDS[number], string> = {
  collect: "collect",
  use: "use",
  storage: "storage",
  thirdParty: "thirdParty",
  cookies: "cookies",
  sharing: "sharing",
  rights: "rights",
  portability: "portability",
  retention: "retention",
  children: "children",
  securityIncident: "securityIncident",
  ccpa: "ccpa",
  changes: "changes",
  contact: "contact",
};

export default async function PrivacyPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-300 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white mb-8 inline-flex items-center gap-1 transition-colors">
          {t("privacy.back")}
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2 mt-4">{t("privacy.title")}</h1>
        <p className="text-zinc-400 text-sm mb-8">{t("privacy.lastUpdated")}</p>

        <nav className="bg-zinc-900/60 border border-white/8 rounded-xl px-5 py-4 mb-10">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t("privacy.tocLabel")}</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {TOC_IDS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  {t(`privacy.toc.${TOC_KEY_MAP[id]}`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10 text-sm leading-relaxed">
          <section id="collect">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.collect")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.collect.intro")}</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.collect.accountTitle")}</span>{" "}
                {t("privacy.collect.accountDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.collect.trainingTitle")}</span>{" "}
                {t("privacy.collect.trainingDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.collect.profileTitle")}</span>{" "}
                {t("privacy.collect.profileDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.collect.usageTitle")}</span>{" "}
                {t("privacy.collect.usageDesc")}
              </li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.use")}
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>{t(`privacy.use.items.${i}`)}</li>
              ))}
            </ul>
          </section>

          <section id="storage">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.storage")}
            </h2>
            <p className="text-zinc-400">{t("privacy.storage")}</p>
          </section>

          <section id="thirdParty">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.thirdParty")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.thirdParty.intro")}</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>{t("privacy.thirdParty.supabase")}</li>
              <li>{t("privacy.thirdParty.vercel")}</li>
              <li>{t("privacy.thirdParty.stripe")}</li>
              <li>{t("privacy.thirdParty.analytics")}</li>
            </ul>
            <p className="mt-3 text-zinc-400">{t("privacy.thirdParty.outro")}</p>
          </section>

          <section id="cookies">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.cookies")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.cookies.intro")}</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400 mb-3">
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.cookies.essentialTitle")}</span>{" "}
                {t("privacy.cookies.essentialDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.cookies.analyticsTitle")}</span>{" "}
                {t("privacy.cookies.analyticsDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.cookies.marketingTitle")}</span>{" "}
                {t("privacy.cookies.marketingDesc")}
              </li>
            </ul>
            <p className="text-zinc-400">{t("privacy.cookies.outro")}</p>
          </section>

          <section id="sharing">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.sharing")}
            </h2>
            <p className="text-zinc-400">{t("privacy.sharing")}</p>
          </section>

          <section id="rights">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.rights")}
            </h2>
            <p className="text-zinc-400 mb-2">{t("privacy.rights.intro")}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i}>{t(`privacy.rights.items.${i}`)}</li>
              ))}
            </ul>
          </section>

          <section id="portability">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.portability")}
            </h2>
            <p className="text-zinc-400 mb-2">{t("privacy.portability.intro")}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              <li>{t("privacy.portability.csv")}</li>
              <li>{t("privacy.portability.pdf")}</li>
            </ul>
            <p className="text-zinc-400">{t("privacy.portability.outro")}</p>
          </section>

          <section id="retention">
            <h2 id="retention-heading" className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.retention")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.retention.intro")}</p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse" aria-labelledby="retention-heading">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-2 pr-4 text-zinc-300 font-semibold">{t("privacy.retention.tableHeader1")}</th>
                    <th className="py-2 pr-4 text-zinc-300 font-semibold">{t("privacy.retention.tableHeader2")}</th>
                    <th className="py-2 text-zinc-300 font-semibold">{t("privacy.retention.tableHeader3")}</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <tr key={n} className="border-b border-white/5">
                      <td className="py-2 pr-4">{t(`privacy.retention.row${n}Cat`)}</td>
                      <td className="py-2 pr-4">{t(`privacy.retention.row${n}Active`)}</td>
                      <td className="py-2">{t(`privacy.retention.row${n}After`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-zinc-400">{t("privacy.retention.outro")}</p>
          </section>

          <section id="children">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.children")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.children.p1")}</p>
            <p className="text-zinc-400 mb-3">
              {t("privacy.children.p2_a")}{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              {t("privacy.children.p2_b")}
            </p>
            <p className="text-zinc-400">{t("privacy.children.p3")}</p>
          </section>

          <section id="securityIncident">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.securityIncident")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.securityIncident.intro")}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>{t(`privacy.securityIncident.items.${i}`)}</li>
              ))}
            </ul>
            <p className="text-zinc-400">{t("privacy.securityIncident.outro")}</p>
          </section>

          <section id="ccpa">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.ccpa")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("privacy.ccpa.intro")}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.ccpa.knowTitle")}</span>{" "}
                {t("privacy.ccpa.knowDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.ccpa.deleteTitle")}</span>{" "}
                {t("privacy.ccpa.deleteDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.ccpa.optOutTitle")}</span>{" "}
                {t("privacy.ccpa.optOutDesc")}
              </li>
              <li>
                <span className="text-zinc-200 font-medium">{t("privacy.ccpa.nonDiscTitle")}</span>{" "}
                {t("privacy.ccpa.nonDiscDesc")}
              </li>
            </ul>
            <p className="text-zinc-400">
              {t("privacy.ccpa.outro_a")}{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              {t("privacy.ccpa.outro_b")}
            </p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.changes")}
            </h2>
            <p className="text-zinc-400">{t("privacy.changes")}</p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("privacy.toc.contact")}
            </h2>
            <p className="text-zinc-400">
              {t("privacy.contact_a")}{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              {t("privacy.contact_b")}
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-zinc-400">
          <Link href="/terms" className="hover:text-zinc-400 transition-colors">{t("privacy.footerTerms")}</Link>
          <Link href="/legal/dpa" className="hover:text-zinc-400 transition-colors">{t("privacy.footerDpa")}</Link>
          <Link href="/legal/tokushoho" className="hover:text-zinc-400 transition-colors">{t("privacy.footerTokushoho")}</Link>
          <Link href="/" className="hover:text-zinc-400 transition-colors">{t("privacy.footerHome")}</Link>
        </div>
      </div>
    </main>
  );
}
