// Phase 5: Tab-based IA redesign — Techniques (3 tabs: ジャーナル / スキルマップ / Wiki)
import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TechniqueLog from "@/components/TechniqueLog";
import TechniquesTabsLayout from "@/components/techniques/TechniquesTabsLayout";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { Suspense } from "react";
import Link from "next/link";
import SafetyBanner from "@/components/SafetyBanner";
import RustyTechniquesBanner from "@/components/techniques/RustyTechniquesBanner";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

// ─── React.cache: deduplicate auth + data queries between generateMetadata & Page ───
const getTechniquesBaseData = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: techniques }] = await Promise.all([
    supabase.from("profiles").select("is_pro, belt").eq("id", user.id).single(),
    supabase
      .from("techniques")
      .select("name, mastery_level, category, created_at")
      .eq("user_id", user.id),
  ]);

  return { user, profile, techniques: techniques ?? [] };
});

export async function generateMetadata(): Promise<Metadata> {
  const data = await getTechniquesBaseData();
  if (!data) return { title: "Technique Journal" };

  const n = data.techniques.length;
  const ogImage = `${BASE_URL}/api/og?belt=white&count=${n}&months=0&streak=0&mode=techniques`;
  const title = n > 0 ? `Technique Journal — ${n} Techniques | BJJ App` : "Technique Journal | BJJ App";
  const description = `${n} BJJ techniques logged. Track mastery levels, identify weak spots, and visualize your skill map.`;

  return {
    title: "Technique Journal",
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: "BJJ Technique Journal" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "BJJ Technique Journal",
  description:
    "A personal record of Brazilian Jiu-Jitsu techniques, organized by position and mastery level",
  url: "https://bjj-app.net/techniques",
  isPartOf: {
    "@type": "WebApplication",
    name: "BJJ App",
    url: "https://bjj-app.net",
  },
};

const WIKI_LINKS = [
  {
    href: "https://wiki.bjj-app.net/en/bjj-guard-passing-fundamentals.html",
    label: "Guard Passing",
  },
  {
    href: "https://wiki.bjj-app.net/en/bjj-sweep-fundamentals.html",
    label: "Sweeps",
  },
  {
    href: "https://wiki.bjj-app.net/en/bjj-triangle-choke-guide.html",
    label: "Triangle Choke",
  },
  {
    href: "https://wiki.bjj-app.net/en/bjj-leg-lock-system.html",
    label: "Leg Locks",
  },
  {
    href: "https://wiki.bjj-app.net/en/bjj-mount-system.html",
    label: "Mount System",
  },
  {
    href: "https://wiki.bjj-app.net/en/bjj-back-control-system.html",
    label: "Back Control",
  },
];


export default async function TechniquesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/techniques");

  const locale = await detectServerLocale();
  const t = makeT(locale);

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Fetch Pro status + belt + technique stats in parallel
  const [{ data: profile }, { data: techniques }] = await Promise.all([
    supabase.from("profiles").select("is_pro, belt").eq("id", user.id).single(),
    supabase
      .from("techniques")
      .select("name, mastery_level, category, created_at")
      .eq("user_id", user.id),
  ]);

  const isPro = profile?.is_pro ?? false;
  const userBelt = (profile?.belt as string) || "white";

  // Compute mastery breakdown from server data
  const totalTechniques = (techniques ?? []).length;
  const mastered = (techniques ?? []).filter((tc) => (tc.mastery_level ?? 0) >= 5).length;
  const learned  = (techniques ?? []).filter((tc) => (tc.mastery_level ?? 0) >= 3 && (tc.mastery_level ?? 0) < 5).length;
  const beginner = (techniques ?? []).filter((tc) => (tc.mastery_level ?? 0) < 3).length;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const tech of techniques ?? []) {
    const cat = tech.category ?? "other";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // B1: Rusty techniques — low mastery (0-2) + 30+ days since added
  const nowMs = Date.now() + 9 * 60 * 60 * 1000; // JST
  const RUSTY_THRESHOLD_DAYS = 30;
  const rustyTechniques = (techniques ?? [])
    .filter((tc) => {
      const mastery = tc.mastery_level ?? 0;
      if (mastery >= 3) return false; // already solid
      const createdMs = new Date(tc.created_at).getTime();
      const daysSince = Math.floor((nowMs - createdMs) / 86400000);
      return daysSince >= RUSTY_THRESHOLD_DAYS;
    })
    .map((tc) => ({
      name: tc.name ?? "",
      category: tc.category ?? null,
      mastery_level: tc.mastery_level ?? 0,
      daysSinceCreated: Math.floor((nowMs - new Date(tc.created_at).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* ═══════════════════════════════════════════
            HERO HEADER — title + stats strip
            ═══════════════════════════════════════════ */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {t("techniquesPage.title")}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {t("techniquesPage.subtitle")}
              </p>
            </div>
            {isPro && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full shrink-0 mt-1">
                ✦ PRO
              </span>
            )}
          </div>

          {/* Stats strip — only shown when techniques exist */}
          {totalTechniques > 0 && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* Total */}
              <div className="bg-zinc-900/50 border border-white/8 rounded-xl px-2 py-2.5 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  {totalTechniques}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 uppercase tracking-widest">
                  {t("techniquesPage.statsLogged")}
                </p>
              </div>
              {/* Solid+ */}
              <div className="bg-zinc-900/50 border border-white/8 rounded-xl px-2 py-2.5 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-black text-yellow-400 tabular-nums">
                  {learned + mastered}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 uppercase tracking-widest">
                  {t("techniquesPage.statsSolid")}
                </p>
              </div>
              {/* Mastered */}
              <div className="bg-zinc-900/50 border border-white/8 rounded-xl px-2 py-2.5 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-black text-green-400 tabular-nums">
                  {mastered}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 uppercase tracking-widest">
                  {t("techniquesPage.statsMastered")}
                </p>
              </div>
            </div>
          )}

          {/* Top categories */}
          {topCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topCategories.map(([cat, count]) => (
                <span
                  key={cat}
                  className="text-xs font-medium bg-zinc-800/60 border border-white/8 text-zinc-400 px-2.5 py-1 rounded-full capitalize"
                >
                  {cat} · {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            SAFETY NOTE — dangerous technique warning for white/blue belts
            ═══════════════════════════════════════════ */}
        {(userBelt === "white" || userBelt === "blue") && (
          <SafetyBanner
            title={t("techniquesPage.safetyTitle")}
            description={t("techniquesPage.safetyDesc")}
            wikiHref="https://wiki.bjj-app.net/en/heel-hook"
            wikiLabel={t("techniquesPage.safetyWikiLink")}
          />
        )}

        {/* ═══════════════════════════════════════════
            RUSTY TECHNIQUES — B1: highlight techniques needing review
            ═══════════════════════════════════════════ */}
        {rustyTechniques.length > 0 && (
          <RustyTechniquesBanner techniques={rustyTechniques} />
        )}

        {/* ═══════════════════════════════════════════
            TAB LAYOUT: ジャーナル / スキルマップ / Wiki
            ═══════════════════════════════════════════ */}
        <TechniquesTabsLayout
          journalSlot={
            <section className="mb-7">
              <Suspense>
                <TechniqueLog userId={user.id} isPro={isPro} userBelt={userBelt} />
              </Suspense>
            </section>
          }
          skillMapSlot={
            <section className="mb-7">
              <div className="flex items-center justify-between mb-3">
                {!isPro && (
                  <span className="text-xs text-zinc-400">
                    {t("techniquesPage.freeLimit")}
                  </span>
                )}
              </div>
              <Link
                href="/techniques/skillmap"
                className="group block bg-zinc-900/40 border border-white/8 hover:border-emerald-400/30 rounded-2xl p-5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {t("skillMapPage.cardTitle")}
                    </p>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {t("skillMapPage.cardDesc")}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0 ml-4 group-hover:bg-emerald-400/20 transition-colors">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </Link>
            </section>
          }
          wikiSlot={
            <section className="mb-7">
              <div className="bg-zinc-900/40 border border-white/8 rounded-2xl p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {WIKI_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs bg-zinc-800/60 hover:bg-zinc-700/60 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-white/8 hover:border-white/20 transition-all active:scale-95"
                    >
                      {link.label}
                      <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
                <p className="text-xs text-zinc-400">
                  {t("techniquesPage.wikiDesc")}
                </p>
              </div>
            </section>
          }
        />

      </main>
    </div>
  );
}
