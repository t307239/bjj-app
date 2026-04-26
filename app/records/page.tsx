// Phase 5: Tab-based IA redesign — Records (2 tabs: ログ / 統計)
import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/safeJsonLd";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
import GoalTracker from "@/components/GoalTracker";
import WeightGoalWidget from "@/components/WeightGoalWidget";
import GymCurriculumCard from "@/components/GymCurriculumCard";
import Link from "next/link";
import GymKickBanner from "@/components/GymKickBanner";
import RecordsTabsLayout from "@/components/records/RecordsTabsLayout";
import {
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { serverT, makeT, parseAcceptLanguage, type Locale } from "@/lib/i18n";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb";
import { logger } from "@/lib/logger";
import GuestDashboardClient from "@/components/GuestDashboardClient";

// perf: Heavy chart components lazy-loaded
const GymRanking = dynamic(() => import("@/components/GymRanking"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const AICoachCard = dynamic(() => import("@/components/AICoachCard"), {
  loading: () => <div className="min-h-[128px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});

// ─── Stats & analytics ───
const PersonalBests = dynamic(() => import("@/components/PersonalBests"), {
  loading: () => <div className="min-h-[100px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const TrainingChart = dynamic(() => import("@/components/TrainingChart"), {
  loading: () => <div className="min-h-[180px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const StatsAccordion = dynamic(() => import("@/components/records/StatsAccordion"), {
  loading: () => <div className="min-h-[80px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const ProGate = dynamic(() => import("@/components/ProGate"), {
  loading: () => <div className="min-h-[60px]" />,
});
const RollAnalyticsCard = dynamic(() => import("@/components/RollAnalyticsCard"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const PartnerStatsCard = dynamic(() => import("@/components/PartnerStatsCard"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});
const CompetitionSummaryCard = dynamic(() => import("@/components/CompetitionSummaryCard"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-2xl animate-pulse" />,
});

export const metadata: Metadata = {
  // layout.tsx の template "%s | BJJ App" が自動付与するので suffix 重複回避
  title: "Records",
  description: "View your BJJ training records, technique progress, competition results, and personal bests.",
  alternates: {
    canonical: "https://bjj-app.net/records",
  },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/records",
    siteName: "BJJ App",
    title: "Records | BJJ App",
    description: "View your BJJ training records, technique progress, competition results, and personal bests.",
  },
};

export default async function RecordsPage({
  searchParams,
}: {
  // z183: ?welcome=1 で TrainingLog form を初期 open (auth/callback 経由)
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const welcomeMode = sp.welcome === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <GuestDashboardClient />;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    serverT("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const firstDayOfMonth = getMonthStartDate();
  const firstDayOfWeek = getWeekStartDate();
  const { year, month } = getLocalDateParts();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const firstDayOfPrevMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

  const [{ data: profileData }, rpcRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "belt, stripe, is_pro, subscription_status, gym_name, weekly_goal, gym_id, gym_kick_notified, share_data_with_gym, ai_coach_cache, ai_coach_last_generated, locale, target_weight, target_weight_date"
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("get_dashboard_metrics", {
      p_user_id: user.id,
      p_month_start: firstDayOfMonth,
      p_prev_month_start: firstDayOfPrevMonth,
      p_week_start: firstDayOfWeek,
    }),
  ]);

  let metrics = rpcRes.data;
  if (!metrics || (Array.isArray(metrics) && metrics.length === 0)) {
    const [mRes, wRes, tRes, totRes] = await Promise.all([
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfMonth),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfWeek),
      supabase.from("techniques").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    metrics = [{ month_count: mRes.count ?? 0, week_count: wRes.count ?? 0, technique_count: tRes.count ?? 0, total_count: totRes.count ?? 0 }];
  }

  const m = Array.isArray(metrics) ? metrics[0] : metrics;
  const totalCount = Number(m?.total_count ?? 0);

  // ── Locale detection ──────────────────────────────────────────────────────
  // dashboard/page.tsx と完全に同じ優先順位:
  // bjj_locale cookie → profile.locale → Accept-Language → "en"
  // 旧実装は "ja" のみをチェックしており PT 話者が JA/EN にフォールバックしていた。
  let userLocale: Locale = "en";
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("bjj_locale")?.value;
  if (cookieLocale === "ja" || cookieLocale === "pt" || cookieLocale === "en") {
    userLocale = cookieLocale as Locale;
  } else {
    const profileLocale = (profileData as { locale?: string | null })?.locale;
    if (profileLocale === "ja" || profileLocale === "pt" || profileLocale === "en") {
      userLocale = profileLocale as Locale;
    } else {
      const hdrs = await headers();
      const acceptLang = hdrs.get("accept-language") ?? "";
      const detected = parseAcceptLanguage(acceptLang);
      if (detected) userLocale = detected;
    }
  }
  const t = makeT(userLocale);

  const isPro = profileData?.is_pro ?? false;
  const gymName = profileData?.gym_name ?? null;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  const showKickBanner = profileData?.gym_kick_notified === false && !profileData?.gym_id;
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;
  const targetWeight = profileData?.target_weight != null ? Number(profileData.target_weight) : null;
  const targetWeightDate = (profileData as { target_weight_date?: string | null })?.target_weight_date ?? null;
  const hasFirstLog = totalCount > 0;

  // Gym curriculum
  let gymCurriculum: { curriculum_url: string; curriculum_set_at: string } | null = null;
  if (gymId && shareDataWithGym) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: gymData, error } = await supabase
      .from("gyms")
      .select("curriculum_url, curriculum_set_at")
      .eq("id", gymId)
      .not("curriculum_url", "is", null)
      .gte("curriculum_set_at", sevenDaysAgo)
      .single();
    if (error) logger.error("records.page_curriculum_query_error", { gymId }, error as Error);
    if (gymData?.curriculum_url && gymData?.curriculum_set_at) {
      gymCurriculum = { curriculum_url: gymData.curriculum_url, curriculum_set_at: gymData.curriculum_set_at };
    }
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "BJJ App", url: "https://bjj-app.net" },
    { name: "Records", url: "https://bjj-app.net/records" },
  ]);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {showKickBanner && <GymKickBanner userId={user.id} />}

        {/* ═══════════════════════════════════════════
            TAB LAYOUT: ログ / 統計
            ═══════════════════════════════════════════ */}
        <RecordsTabsLayout
          logSlot={
            <>
              {/* Training Log (full list, search, filters) */}
              <section className="mb-7">
                <TrainingLog userId={user.id} isPro={isPro} initialOpen={welcomeMode} />
              </section>

              {/* Competition Summary */}
              <section className="mb-7">
                <CompetitionSummaryCard userId={user.id} isPro={isPro} />
              </section>

              {/* AI Coach (≥10 logs, Pro) */}
              {totalCount >= 10 && (
                <AICoachCard
                  userId={user.id}
                  isPro={isPro}
                  initialCoaching={profileData?.ai_coach_cache ?? null}
                  initialGeneratedAt={profileData?.ai_coach_last_generated ?? null}
                />
              )}

              {/* Goals & Weight Tracking */}
              {hasFirstLog && (
                <section className="mb-7">
                  <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
                    {t("dashboard.weekTraining")}
                  </p>
                  <div className="space-y-3">
                    <GoalTracker userId={user.id} />
                    {targetWeight != null && isPro && (
                      <WeightGoalWidget targetWeight={targetWeight} targetDate={targetWeightDate} />
                    )}
                  </div>
                </section>
              )}

              {/* Gym Features (members only) */}
              {gymCurriculum && (
                <section className="mb-7">
                  <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
                    {t("dashboard.sectionToday")}
                  </p>
                  <GymCurriculumCard
                    curriculumUrl={gymCurriculum.curriculum_url}
                    curriculumSetAt={gymCurriculum.curriculum_set_at}
                    gymName={gymName}
                    userId={user.id}
                  />
                </section>
              )}

              {gymId && shareDataWithGym && (
                <section className="mb-7">
                  <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
                    {t("dashboard.sectionYourGym")}
                  </p>
                  <GymRanking userId={user.id} gymId={gymId} />
                </section>
              )}
            </>
          }
          statsSlot={
            hasFirstLog ? (
              <>
                <section className="mb-7">
                  <PersonalBests userId={user.id} />
                  <div className="mt-4">
                    <TrainingChart userId={user.id} isPro={isPro} />
                  </div>
                  <StatsAccordion userId={user.id} isPro={isPro} />
                </section>

                <section className="mb-7">
                  <ProGate isPro={isPro} feature="ロール分析 & パートナー統計" userId={user.id}>
                    <div className="md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0">
                      <RollAnalyticsCard userId={user.id} />
                      <PartnerStatsCard userId={user.id} />
                    </div>
                  </ProGate>
                </section>

                {/* Data portability hint — §18 Brand trust */}
                <a
                  href="/settings"
                  className="flex items-center gap-3 bg-zinc-900/40 border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors group"
                >
                  <svg aria-hidden="true" className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {t("records.dataPortability")}
                    </p>
                  </div>
                  <svg aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-base font-semibold text-white">
                  {t("records.noStatsTitle")}
                </p>
                <p className="text-sm text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                  {t("records.noStatsYet")}
                </p>
                <Link
                  href="/records?tab=log"
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-95"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {t("records.noStatsCta")}
                </Link>
              </div>
            )
          }
        />
      </main>
    </div>
  );
}
