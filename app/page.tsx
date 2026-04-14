import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PricingSection from "@/components/PricingSection";
import IABSafeLink from "@/components/IABSafeLink";
import { detectServerLocale, makeT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "BJJ App - Brazilian Jiu-Jitsu Training Tracker | 練習トラッカー",
  description: "Track your BJJ training sessions, techniques, and streaks in one place. Free training log for Brazilian Jiu-Jitsu practitioners. 柔術の練習記録・テクニック管理・スキルマップ・成長の可視化。",
  keywords: ["BJJ", "Brazilian Jiu-Jitsu", "training tracker", "BJJ app", "grappling log", "technique tracker", "skill map", "ブラジリアン柔術", "練習記録", "テクニック管理"],
  openGraph: {
    type: "website",
    title: "BJJ App - Track Your Brazilian Jiu-Jitsu Journey",
    description: "Log every session. Track every technique. Build your skill map. Free BJJ training tracker.",
    url: "https://bjj-app.net",
    siteName: "BJJ App",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "BJJ App",
  "description": "Track your Brazilian Jiu-Jitsu training sessions, techniques, and streaks. Free BJJ training log app. 柔術の練習記録・テクニック管理・成長可視化アプリ。",
  "url": "https://bjj-app.net",
  "applicationCategory": "SportsApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
    { "@type": "Offer", "name": "Pro Monthly", "price": "9.99", "priceCurrency": "USD", "billingIncrement": "P1M" },
    { "@type": "Offer", "name": "Pro Annual", "price": "79.99", "priceCurrency": "USD", "billingIncrement": "P1Y" },
  ],
  "inLanguage": ["ja", "en"],
  "audience": { "@type": "Audience", "audienceType": "Brazilian Jiu-Jitsu practitioners" },
};

// ---- Inline SVG icon helpers (avoids lucide-react dependency) ----
function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}
function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M18 9v9M12 5v13M6 13v5" />
    </svg>
  );
}
function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function IconFlame({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  );
}
function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );
}
function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}
function IconNetwork({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C10.343 2 9 3.343 9 5s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM5 15c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm14 0c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm-7-5l-4.5 3.5M12 10l4.5 3.5" />
    </svg>
  );
}
function IconLegs({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  );
}
// ---- End SVG helpers ----

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <main className="min-h-[100dvh] flex flex-col">
      {/* ナビゲーション — Fix 3: BETA badge + Get Started CTA */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥋</span>
          <span className="font-bold text-lg">BJJ App</span>
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider text-emerald-400">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t("landing.navLogin")}
          </Link>
          {/* Fix 13: Get Started primary CTA in nav */}
          <Link
            href="/login"
            className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-full transition-colors"
          >
            {t("landing.navGetStarted")}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-emerald-400/30 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("landing.heroBadge")}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            {t("landing.heroTitle1")}
            <br />
            <span className="bg-gradient-to-r from-[#10B981] to-cyan-400 bg-clip-text text-transparent">
              {t("landing.heroTitle2")}
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
            {t("landing.heroDesc").split("\n")[0]}<br className="hidden md:block" />
            {t("landing.heroDesc").split("\n")[1]}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            {/* Fix 15: CTA copy | UX3: IAB-safe link */}
            <IABSafeLink
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#10B981]/20"
            >
              {t("landing.heroCta")}
              <IconArrowRight className="w-5 h-5" />
            </IABSafeLink>
            <a
              href="#preview"
              className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-white/5 active:scale-95 text-gray-300 font-medium py-4 px-8 rounded-full text-lg transition-all border border-white/10"
            >
              {t("landing.heroSeeApp")}
            </a>
          </div>

          <p className="text-gray-400 text-sm">
            {t("landing.heroSubtext")}
          </p>
          {/* Fix 7: arrow → (not ↓) */}
          <p className="text-gray-500 text-xs mt-3">
            <Link href="/dashboard" className="hover:text-gray-300 underline transition-colors">
              {t("landing.heroGuest")}
            </Link>
          </p>

          {/* Hero mockup placeholder — replace with actual screenshot when available */}
          <div className="mt-16 w-full max-w-4xl mx-auto rounded-t-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden" style={{
            maskImage: "linear-gradient(to bottom, white 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, white 40%, transparent 100%)",
          }}>
            <div className="px-8 py-10 flex flex-col gap-3">
              <div className="h-3 w-2/3 rounded-full bg-zinc-700/60 animate-pulse" />
              <div className="h-3 w-1/2 rounded-full bg-zinc-700/40 animate-pulse" />
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-800/60 animate-pulse" />
                ))}
              </div>
              <div className="mt-4 h-32 rounded-xl bg-zinc-800/40 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* English Section — Fix 14: removed 🌐 badge | Fix 21: removed fake reviews */}
      <section id="english" className="px-4 py-16 bg-zinc-950 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight text-white">
            {t("landing.engTitle1")}
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {t("landing.engTitle2")}
            </span>
          </h2>

          <p className="text-gray-400 text-base md:text-lg mb-8 leading-relaxed">
            {t("landing.engDesc").split("\n")[0]}<br className="hidden md:block" />
            {t("landing.engDesc").split("\n")[1]}
          </p>

          {/* Feature pills — Fix 12: no native emoji | T-32: Added weight & belt */}
          <div className="flex flex-wrap gap-2 justify-center mb-10 text-sm">
            {[
              t("landing.engPillSession"),
              t("landing.engPillTechnique"),
              t("landing.engPillStreak"),
              t("landing.engPillGoals"),
              t("landing.engPillHeatmap"),
              t("landing.engPillComp"),
              t("landing.engPillSkillMap"),
              "Weight Management",
              "Belt Progress",
            ].map((f) => (
              <span key={f} className="bg-zinc-900 border border-white/10 text-zinc-300 px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* Fix 15: CTA copy | UX3: IAB-safe link */}
            <IABSafeLink
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-bold py-4 px-8 rounded-full text-base transition-all hover:scale-105 shadow-lg shadow-[#10B981]/25"
            >
              {t("landing.engCta")}
              <IconArrowRight className="w-4 h-4" />
            </IABSafeLink>
          </div>
          <p className="text-gray-500 text-xs mt-4">{t("landing.engSubtext")}</p>
          <p className="text-gray-500 text-xs mt-2">
            <Link href="/dashboard" className="hover:text-gray-300 underline transition-colors">
              {t("landing.engGuest")}
            </Link>
          </p>
        </div>
      </section>

      {/* Social Proof — Fix 5: traction numbers */}
      <section className="px-4 py-16 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            {/* Fix 5: "Trusted by grapplers worldwide" */}
            <div className="inline-flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-full px-4 py-2 mb-6">
              <span className="text-sm text-green-400">{t("landing.proofBadge")}</span>
            </div>
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <IconTrendingUp className="w-6 h-6 text-emerald-400" />
              {t("landing.proofTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-bold text-white mb-1">{t("landing.proofSessions")}</div>
              <p className="text-gray-400 text-xs">{t("landing.proofSessionsLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-bold text-white mb-1">{t("landing.proofTechniques")}</div>
              <p className="text-gray-400 text-xs">{t("landing.proofTechniquesLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-bold text-white mb-1">{t("landing.proofStreak")}</div>
              <p className="text-gray-400 text-xs">{t("landing.proofStreakLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 text-center">
              <div className="text-3xl font-bold text-white mb-1">{t("landing.proofFree")}</div>
              <p className="text-gray-400 text-xs">{t("landing.proofFreeLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-emerald-500/30 text-center">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{t("landing.socialProofUsers")}</div>
              <p className="text-gray-400 text-xs">{t("landing.socialProofUsersLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-purple-500/30 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">{t("landing.socialProofWiki")}</div>
              <p className="text-gray-400 text-xs">{t("landing.socialProofWikiLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-orange-500/30 text-center">
              <div className="text-3xl font-bold text-orange-400 mb-1">{t("landing.socialProofAvgStreak")}</div>
              <p className="text-gray-400 text-xs">{t("landing.socialProofAvgStreakLabel")}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-pink-500/30 text-center">
              <div className="text-3xl font-bold text-pink-400 mb-1">{t("landing.socialProofProSubscribers")}</div>
              <p className="text-gray-400 text-xs">{t("landing.socialProofProSubscribersLabel")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — Fix 12: no emoji heading */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-white">
          {t("landing.stepsTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full text-xl font-bold text-white mb-4">1</div>
            <h3 className="font-bold text-lg text-white mb-3">{t("landing.step1Title")}</h3>
            <p className="text-gray-400 text-sm">{t("landing.step1Desc")}</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#10B981]/20 rounded-full text-xl font-bold text-[#10B981] mb-4">2</div>
            <h3 className="font-bold text-lg text-white mb-3">{t("landing.step2Title")}</h3>
            <p className="text-gray-400 text-sm">{t("landing.step2Desc")}</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#10B981]/20 rounded-full text-xl font-bold text-[#10B981] mb-4">3</div>
            <h3 className="font-bold text-lg text-white mb-3">{t("landing.step3Title")}</h3>
            <p className="text-gray-400 text-sm">{t("landing.step3Desc")}</p>
          </div>
        </div>
      </section>

      {/* App Preview */}
      <section id="preview" className="px-4 py-16 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3 text-white">
            {t("landing.previewTitle")}
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12">{t("landing.previewSubtitle")}</p>

          <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            {/* スマホモックアップ */}
            <div className="mx-auto lg:mx-0 w-full max-w-[320px] bg-zinc-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="bg-zinc-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🥋</span>
                  <span className="text-sm font-semibold">BJJ App</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-xs text-gray-400">{t("dashboard.mockDashboardLog")}</span>
                  <span className="text-xs text-gray-400">{t("dashboard.mockDashboardTech")}</span>
                  <span className="text-xs text-gray-400">{t("dashboard.mockDashboardProfile")}</span>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-base font-bold">{t("dashboard.mockDashboardWelcome")}</h3>
                  <p className="text-xs text-gray-400">{t("dashboard.mockDashboardDate")}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-rose-400">12</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t("dashboard.mockDashboardMonth")}</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-blue-400">3</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t("dashboard.mockDashboardWeek")}</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-purple-400">47</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t("dashboard.mockDashboardTechniques")}</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    {/* Fix 12: remove 🔥 emoji from mockup */}
                    <div className="text-xl font-bold text-orange-400">5</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t("dashboard.mockDashboardStreak")}</div>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-xl border border-white/10 mb-3 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10">
                    <span className="text-xs font-medium text-gray-300">{t("dashboard.mockDashboardGoals")}</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">{t("dashboard.mockDashboardWeeklyGoal")}</span>
                        <span className="text-xs text-yellow-400">75%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: "75%" }} />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{t("dashboard.mockDashboardWeeklySessions")}</div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">{t("dashboard.mockDashboardMonthlyGoal")}</span>
                        <span className="text-xs text-green-400">{t("dashboard.mockDashboardMonthlyDone")}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: "100%" }} />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{t("dashboard.mockDashboardMonthlySessions")}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium mb-1">{t("dashboard.mockDashboardRecentSessions")}</div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/17</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Gi</span>
                          <span className="text-xs text-gray-400">1h 30m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/15</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">NoGi</span>
                          <span className="text-xs text-gray-400">1h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature highlights — Fix 12: replace emoji with SVG icons */}
            <div className="flex-1 max-w-md mx-auto lg:mx-0 space-y-4 pt-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconBarChart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureLogTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureLogDesc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#10B981]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconTarget className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureGoalsTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureGoalsDesc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconBook className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureWeakTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureWeakDesc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconFlame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureStreakTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureStreakDesc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconCalendar className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureCalendarTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureCalendarDesc")}</p>
                </div>
              </div>
              {/* Fix 20: Visual Skill Map highlight */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconNetwork className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t("landing.featureSkillMapTitle")}</h3>
                  <p className="text-gray-400 text-sm">{t("landing.featureSkillMapDesc")}</p>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 w-full text-center"
                >
                  {t("landing.featureStartCta")}
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — Fix 2: "Core features, always free" | Fix 10: Day Streak | Fix 12: SVG icons | Fix 20: Skill Map */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-white">
          {t("landing.coreTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-colors">
            <div className="mb-3"><IconBarChart className="w-8 h-8 text-emerald-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreLogTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreLogDesc")}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-colors">
            <div className="mb-3"><IconBook className="w-8 h-8 text-purple-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreTechTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreTechDesc")}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-colors">
            <div className="mb-3"><IconFlame className="w-8 h-8 text-orange-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreStreakTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreStreakDesc")}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-cyan-500/30 hover:border-cyan-500/50 transition-colors">
            <div className="mb-3"><IconNetwork className="w-8 h-8 text-cyan-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreSkillMapTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreSkillMapDesc")}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
            <div className="mb-3"><IconTrophy className="w-8 h-8 text-yellow-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreBeltTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreBeltDesc")}
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <div className="mb-3"><IconTrendingUp className="w-8 h-8 text-blue-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.coreWeightTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.coreWeightDesc")}
            </p>
          </div>
        </div>
      </section>

      {/* BJJ Wiki — Fix 8: remove (free) | Fix 12: SVG icons */}
      <section className="px-4 py-16 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 text-white flex items-center justify-center gap-2">
            <IconBook className="w-6 h-6 text-emerald-400" />
            {t("landing.wikiTitle")}
          </h2>
          <p className="text-gray-500 text-center text-sm mb-8">
            {t("landing.wikiSubtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: <IconLock className="w-6 h-6 text-emerald-400" />, title: t("landing.wikiGuardTitle"), desc: t("landing.wikiGuardDesc"), href: "https://wiki.bjj-app.net/en/bjj-guard-retention-advanced.html" },
              { icon: <IconLegs className="w-6 h-6 text-blue-400" />, title: t("landing.wikiLegTitle"), desc: t("landing.wikiLegDesc"), href: "https://wiki.bjj-app.net/en/bjj-leg-lock-system.html" },
              { icon: <IconTrophy className="w-6 h-6 text-yellow-400" />, title: t("landing.wikiCompTitle"), desc: t("landing.wikiCompDesc"), href: "https://wiki.bjj-app.net/en/bjj-competition-mindset.html" },
              { icon: <IconTrendingUp className="w-6 h-6 text-rose-400" />, title: t("landing.wikiNutritionTitle"), desc: t("landing.wikiNutritionDesc"), href: "https://wiki.bjj-app.net/en/bjj-nutrition-science.html" },
            ].map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-zinc-900 rounded-xl p-4 border border-white/10 hover:border-white/30 transition-colors block"
              >
                <div className="mb-2">{item.icon}</div>
                <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </a>
            ))}
          </div>
          {/* Fix 8: remove (free), use ArrowRight SVG */}
          <div className="text-center">
            <a
              href="https://wiki.bjj-app.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors text-sm font-medium"
            >
              {t("landing.wikiExplore")}
              <IconArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Pro Features — T-32: Roll Analysis, Badges, Goal Weight */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-white">
          {t("landing.coreTitle")} & <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t("landing.proFeatures")}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/50 transition-colors">
            <div className="mb-3"><IconNetwork className="w-8 h-8 text-purple-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.proRollAnalysisTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.proRollAnalysisDesc")}
            </p>
            <p className="text-purple-400 text-xs font-semibold mt-3">Pro</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-pink-500/30 hover:border-pink-500/50 transition-colors">
            <div className="mb-3"><IconTrophy className="w-8 h-8 text-pink-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.proBadgesTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.proBadgesDesc")}
            </p>
            <p className="text-pink-400 text-xs font-semibold mt-3">Pro</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <div className="mb-3"><IconTarget className="w-8 h-8 text-blue-400" /></div>
            <h3 className="font-bold text-lg mb-2">{t("landing.proGoalWeightTitle")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t("landing.proGoalWeightDesc")}
            </p>
            <p className="text-blue-400 text-xs font-semibold mt-3">Pro</p>
          </div>
        </div>
      </section>

      {/* Pricing — Annual/Monthly toggle via PricingSection client component */}
      <PricingSection userId={null} />

      {/* FAQ — Fix 17: brighter question text | Fix 19: remove "Offline support is also planned" */}
      <section className="px-4 py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-white">{t("landing.faqTitle")}</h2>
        <div className="space-y-4">
          {[
            { q: t("landing.faq1Q"), a: t("landing.faq1A") },
            { q: t("landing.faq2Q"), a: t("landing.faq2A") },
            { q: t("landing.faq3Q"), a: t("landing.faq3A") },
            { q: t("landing.faq4Q"), a: t("landing.faq4A") },
            { q: t("landing.faq5Q"), a: t("landing.faq5A") },
          ].map(({ q, a }, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-5 border border-white/10">
              {/* Fix 17: zinc-100 for stronger contrast */}
              <h3 className="font-semibold text-zinc-100 mb-2 text-sm">Q. {q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA — Fix 15 */}
      <section className="px-4 py-16 text-center bg-zinc-900/30">
        <h2 className="text-2xl font-bold mb-3 text-white">{t("landing.finalCtaTitle")}</h2>
        <p className="text-gray-500 text-sm mb-8">{t("landing.finalCtaSubtitle")}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#10B981]/20"
        >
          {t("landing.finalCtaButton")}
          <IconArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* フッター — Fix 9: SaaS standard footer */}
      <footer className="px-6 py-8 text-center text-gray-400 text-sm border-t border-white/5">
        <p className="mb-3">{t("landing.footerCopyright")}</p>
        <div className="flex justify-center flex-wrap gap-4 text-xs">
          <a href="/terms" className="hover:text-gray-400 transition-colors">{t("landing.footerTerms")}</a>
          <a href="/privacy" className="hover:text-gray-400 transition-colors">{t("landing.footerPrivacy")}</a>
          <a href="/legal/tokushoho" className="hover:text-gray-400 transition-colors">{t("landing.footerTokushoho")}</a>
        </div>
      </footer>
    </main>
    </>
  );
}
