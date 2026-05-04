/**
 * /terms — z255d: 3 言語対応 (EN canonical / JA / PT — translated via Gemini)
 * 翻訳キー: messages/{en,ja,pt}.json の terms.* 配下、scripts/translate_legal_pages.py で生成
 */
import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for BJJ App — Brazilian Jiu-Jitsu training tracker.",
  robots: { index: false },
  alternates: {
    canonical: "https://bjj-app.net/terms",
  },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/terms",
    siteName: "BJJ App",
    title: "Terms of Service | BJJ App",
    description: "Terms of Service for BJJ App — Brazilian Jiu-Jitsu training tracker.",
  },
};

const TOC_IDS = [
  "acceptance", "description", "accounts", "content", "subscription",
  "conduct", "disclaimers", "liability", "deletion", "changes",
  "contact", "governing",
] as const;

export default async function TermsPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-300 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white mb-8 inline-flex items-center gap-1 transition-colors">
          {t("terms.back")}
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2 mt-4">{t("terms.title")}</h1>
        <p className="text-zinc-500 text-sm mb-8">{t("terms.lastUpdated")}</p>

        <nav className="bg-zinc-900/60 border border-white/8 rounded-xl px-5 py-4 mb-10">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t("terms.tocLabel")}</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {TOC_IDS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  {t(`terms.toc.${id}`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10 text-sm leading-relaxed">
          <section id="acceptance">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.acceptance")}
            </h2>
            <p className="text-zinc-400">{t("terms.acceptance")}</p>
          </section>

          <section id="description">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.description")}
            </h2>
            <p className="text-zinc-400">{t("terms.description")}</p>
          </section>

          <section id="accounts">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.accounts")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("terms.accounts.p1")}</p>
            <p className="text-zinc-400">{t("terms.accounts.p2")}</p>
          </section>

          <section id="content">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.content")}
            </h2>
            <p className="text-zinc-400">{t("terms.content")}</p>
          </section>

          <section id="subscription">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.subscription")}
            </h2>
            <p className="text-zinc-400 mb-3">{t("terms.subscription.p1")}</p>
            <p className="text-zinc-400 mb-3">{t("terms.subscription.p2")}</p>
            <p className="text-zinc-400 mb-3">
              {t("terms.subscription.p3_a")}{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              {t("terms.subscription.p3_b")}
            </p>
            <p className="text-zinc-400">{t("terms.subscription.p4")}</p>
          </section>

          <section id="conduct">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.conduct")}
            </h2>
            <p className="text-zinc-400 mb-2">{t("terms.conduct.intro")}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>{t(`terms.conduct.items.${i}`)}</li>
              ))}
            </ul>
          </section>

          <section id="disclaimers">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.disclaimers")}
            </h2>
            <p className="text-zinc-400">{t("terms.disclaimers")}</p>
          </section>

          <section id="liability">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.liability")}
            </h2>
            <p className="text-zinc-400">{t("terms.liability")}</p>
          </section>

          <section id="deletion">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.deletion")}
            </h2>
            <p className="text-zinc-400">{t("terms.deletion")}</p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.changes")}
            </h2>
            <p className="text-zinc-400">{t("terms.changes")}</p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.contact")}
            </h2>
            <p className="text-zinc-400">
              {t("terms.contact_a")}{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              {t("terms.contact_b")}
            </p>
          </section>

          <section id="governing">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              {t("terms.toc.governing")}
            </h2>
            <p className="text-zinc-400">{t("terms.governing")}</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-zinc-400 transition-colors">{t("terms.footerPrivacy")}</Link>
          <Link href="/legal/tokushoho" className="hover:text-zinc-400 transition-colors">{t("terms.footerTokushoho")}</Link>
          <Link href="/" className="hover:text-zinc-400 transition-colors">{t("terms.footerHome")}</Link>
        </div>
      </div>
    </main>
  );
}
