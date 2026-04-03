import type { Metadata } from "next";
import Link from "next/link";
import GymWaitlistForm from "@/components/GymWaitlistForm";
import { detectServerLocale, makeT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "BJJ App for Academies - Keep Your Students Engaged",
  description:
    "Coach dashboard for BJJ academies. Track student engagement, send weekly curriculum, manage your team. $49-$99/month. No setup required.",
  keywords: [
    "BJJ academy management",
    "BJJ coach dashboard",
    "student engagement tracking",
    "BJJ gym software",
  ],
  openGraph: {
    type: "website",
    title: "BJJ App for Academies",
    description: "Keep your students engaged between classes. See who's training, push curriculum, build loyalty.",
    url: "https://bjj-app.net/gym",
    siteName: "BJJ App",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "BJJ App for Academies",
  description: "Academy management software for BJJ coaches and gym owners",
  url: "https://bjj-app.net/gym",
};

export default async function GymPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen flex flex-col bg-zinc-950">
        {/* Navigation */}
        <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥋</span>
            <span className="font-bold text-lg">BJJ App</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              {t("gymLanding.navIndividuals")}
            </Link>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              {t("gymLanding.navSignIn")}
            </Link>
            <Link
              href="/gym/dashboard"
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-1.5 rounded-full transition-colors"
            >
              {t("gymLanding.navDashboard")}
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-zinc-900 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {t("gymLanding.heroBadge")}
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-white">
              {t("gymLanding.heroTitle1")}
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t("gymLanding.heroTitle2")}
              </span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
              {t("gymLanding.heroDesc")}
            </p>

            <div className="flex flex-col items-center gap-3">
              <Link
                href="/gym/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
              >
                {t("gymLanding.heroCta")}
              </Link>
              <a
                href="#waitlist"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t("gymLanding.heroWaitlist")}
              </a>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="px-4 py-16 bg-zinc-900/50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12 text-zinc-100">
              {t("gymLanding.featuresTitle")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Attrition Risk */}
              <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">🔴</div>
                <h3 className="font-bold text-lg mb-3 text-zinc-100">
                  {t("gymLanding.feature1Title")}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {t("gymLanding.feature1Desc")}
                </p>
                <ul className="text-xs text-gray-400 space-y-2">
                  <li>✓ {t("gymLanding.feature1Point1")}</li>
                  <li>✓ {t("gymLanding.feature1Point2")}</li>
                  <li>✓ {t("gymLanding.feature1Point3")}</li>
                </ul>
              </div>

              {/* Feature 2: Curriculum Push */}
              <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">📚</div>
                <h3 className="font-bold text-lg mb-3 text-zinc-100">
                  {t("gymLanding.feature2Title")}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {t("gymLanding.feature2Desc")}
                </p>
                <ul className="text-xs text-gray-400 space-y-2">
                  <li>✓ {t("gymLanding.feature2Point1")}</li>
                  <li>✓ {t("gymLanding.feature2Point2")}</li>
                  <li>✓ {t("gymLanding.feature2Point3")}</li>
                </ul>
              </div>

              {/* Feature 3: QR Invite */}
              <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="font-bold text-lg mb-3 text-zinc-100">
                  {t("gymLanding.feature3Title")}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {t("gymLanding.feature3Desc")}
                </p>
                <ul className="text-xs text-gray-400 space-y-2">
                  <li>✓ {t("gymLanding.feature3Point1")}</li>
                  <li>✓ {t("gymLanding.feature3Point2")}</li>
                  <li>✓ {t("gymLanding.feature3Point3")}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 py-16 max-w-5xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center mb-12 text-zinc-100">
            {t("gymLanding.howTitle")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-xl font-bold text-blue-400 mb-4">
                1
              </div>
              <h3 className="font-bold text-lg text-zinc-100 mb-3">{t("gymLanding.step1Title")}</h3>
              <p className="text-gray-400 text-sm">
                {t("gymLanding.step1Desc")}
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-xl font-bold text-blue-400 mb-4">
                2
              </div>
              <h3 className="font-bold text-lg text-zinc-100 mb-3">{t("gymLanding.step2Title")}</h3>
              <p className="text-gray-400 text-sm">
                {t("gymLanding.step2Desc")}
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-xl font-bold text-blue-400 mb-4">
                3
              </div>
              <h3 className="font-bold text-lg text-zinc-100 mb-3">{t("gymLanding.step3Title")}</h3>
              <p className="text-gray-400 text-sm">
                {t("gymLanding.step3Desc")}
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="px-4 py-16 bg-zinc-900/50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12 text-zinc-100">
              {t("gymLanding.pricingTitle")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starter */}
              <div className="bg-zinc-900 rounded-2xl p-8 border border-blue-500/50 relative">
                <div className="absolute -top-3 right-6 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                  {t("gymLanding.pricingPopular")}
                </div>
                <h3 className="text-lg font-bold mb-2 text-zinc-100">{t("gymLanding.pricingStarter")}</h3>
                <div className="text-3xl font-bold text-zinc-100 mb-1">
                  $49<span className="text-sm font-normal text-gray-400">/{t("gymLanding.pricingMonth")}</span>
                </div>
                <p className="text-gray-400 text-xs mb-6">{t("gymLanding.pricingStarterLimit")}</p>
                <ul className="space-y-3 text-sm text-gray-400 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingStarterF1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingStarterF2")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingStarterF3")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingStarterF4")}
                  </li>
                </ul>
                <a
                  href="mailto:307239t777@gmail.com?subject=Starter%20Plan%20Inquiry"
                  className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-full transition-all"
                >
                  {t("gymLanding.pricingCta")}
                </a>
              </div>

              {/* Pro */}
              <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10">
                <h3 className="text-lg font-bold mb-2 text-zinc-100">{t("gymLanding.pricingPro")}</h3>
                <div className="text-3xl font-bold text-zinc-100 mb-1">
                  $99<span className="text-sm font-normal text-gray-400">/{t("gymLanding.pricingMonth")}</span>
                </div>
                <p className="text-gray-400 text-xs mb-6">{t("gymLanding.pricingProLimit")}</p>
                <ul className="space-y-3 text-sm text-gray-400 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingProF1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingProF2")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingProF3")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {t("gymLanding.pricingProF4")}
                  </li>
                </ul>
                <a
                  href="mailto:307239t777@gmail.com?subject=Pro%20Plan%20Inquiry"
                  className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-full transition-all"
                >
                  {t("gymLanding.pricingCta")}
                </a>
              </div>
            </div>
            <p className="text-gray-500 text-center text-xs mt-8">
              {t("gymLanding.pricingNote")}
            </p>
          </div>
        </section>

        {/* Waitlist Section */}
        <section id="waitlist" className="px-4 py-16 bg-zinc-900/20">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-zinc-100 mb-3">
                {t("gymLanding.waitlistTitle")}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                {t("gymLanding.waitlistDesc")}
              </p>
            </div>
            <GymWaitlistForm />
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16 max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center mb-10 text-zinc-100">
            {t("gymLanding.faqTitle")}
          </h2>
          <div className="space-y-4">
            {[
              {
                q: t("gymLanding.faq1Q"),
                a: t("gymLanding.faq1A"),
              },
              {
                q: t("gymLanding.faq2Q"),
                a: t("gymLanding.faq2A"),
              },
              {
                q: t("gymLanding.faq3Q"),
                a: t("gymLanding.faq3A"),
              },
              {
                q: t("gymLanding.faq4Q"),
                a: t("gymLanding.faq4A"),
              },
              {
                q: t("gymLanding.faq5Q"),
                a: t("gymLanding.faq5A"),
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl p-5 border border-white/10">
                <h3 className="font-semibold text-zinc-100 mb-2 text-sm">
                  {q}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-16 text-center bg-zinc-900/30">
          <h2 className="text-2xl font-bold mb-3 text-zinc-100">
            {t("gymLanding.finalCtaTitle")}
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            {t("gymLanding.finalCtaDesc")}
          </p>
          <a
            href="mailto:307239t777@gmail.com?subject=BJJ%20App%20Academy%20Demo%20Request"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
          >
            {t("gymLanding.finalCtaButton")}
          </a>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 text-center text-gray-400 text-sm border-t border-white/5">
          <p className="mb-3">{t("gymLanding.footerCopyright")}</p>
          <div className="flex justify-center flex-wrap gap-4 text-xs">
            <a href="/terms" className="hover:text-gray-400 transition-colors">{t("gymLanding.footerTerms")}</a>
            <a href="/privacy" className="hover:text-gray-400 transition-colors">{t("gymLanding.footerPrivacy")}</a>
            <a href="/legal/tokushoho" className="hover:text-gray-400 transition-colors">{t("gymLanding.footerTokushoho")}</a>
          </div>
        </footer>
      </main>
    </>
  );
}
