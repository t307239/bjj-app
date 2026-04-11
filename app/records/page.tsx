import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
import GoalTracker from "@/components/GoalTracker";
import WeightGoalWidget from "@/components/WeightGoalWidget";
import GymCurriculumCard from "@/components/GymCurriculumCard";
import GymKickBanner from "@/components/GymKickBanner";
import {
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { serverT, makeT, type Locale } from "@/lib/i18n";
import GuestDashboardClient from "@/components/GuestDashboardClient";

// perf: Heavy chart components lazy-loaded
const GymRanking = dynamic(() => import("@/components/GymRanking"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const AICoachCard = dynamic(() => import("@/components/AICoachCard"), {
  loading: () => <div className="min-h-[128px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});

// ─── Stats & analytics (moved from ProfileTabs Phase 3) ───
const PersonalBests = dynamic(() => import("@/components/PersonalBests"), {
  loading: () => <div className="min-h-[100px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const TrainingChart = dynamic(() => import("@/components/TrainingChart"), {
  loading: () => <div className="min-h-[180px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const MilestoneBadgeGrid = dynamic(() => import("@/components/MilestoneBadgeGrid"), {
  loading: () => <div className="min-h-[100px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const StatsAccordion = dynamic(() => import("@/components/records/StatsAccordion"));
const ProGate = dynamic(() => import("@/components/ProGate"));
const RollAnalyticsCard = dynamic(() => import("@/components/RollAnalyticsCard"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const PartnerStatsCard = dynamic(() => import("@/components/PartnerStatsCard"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});

export const metadata: Metadata = {
  title: "Records | BJJ App",
};

export default async function RecordsPage() {
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

  // Locale
  let userLocale: Locale = "en";
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("bjj_locale")?.value;
  if (cookieLocale === "ja") {
    userLocale = "ja";
  } else {
    const profileLocale = (profileData as { locale?: string | null })?.locale;
    if (profileLocale === "ja") {
      userLocale = "ja";
    } else {
      const hdrs = await headers();
      const acceptLang = hdrs.get("accept-language") ?? "";
      if (acceptLang.toLowerCase().startsWith("ja")) userLocale = "ja";
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
  const hasGoal = (weeklyGoal ?? 0) > 0;

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
    if (error) console.error("records/page.tsx:query", error);
    if (gymData?.curriculum_url && gymData?.curriculum_set_at) {
      gymCurriculum = { curriculum_url: gymData.curriculum_url, curriculum_set_at: gymData.curriculum_set_at };
    }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {showKickBanner && <GymKickBanner userId={user.id} />}

        {/* ═══════════════════════════════════════════
            PRIMARY: Training Log (full list, search, filters)
            ═══════════════════════════════════════════ */}
        <section className="mb-7">
          <TrainingLog userId={user.id} isPro={isPro} />
        </section>

        {/* ═══════════════════════════════════════════
            AI Coach (≥10 logs, Pro)
            ═══════════════════════════════════════════ */}
        {totalCount >= 10 && (
          <AICoachCard
            userId={user.id}
            isPro={isPro}
            initialCoaching={profileData?.ai_coach_cache ?? null}
            initialGeneratedAt={profileData?.ai_coach_last_generated ?? null}
          />
        )}

        {/* ═══════════════════════════════════════════
            Goals & Weight Tracking
            ═══════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════
            Gym Features (members only)
            ═══════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════
            STATS & ANALYTICS (moved from ProfileTabs)
            ═══════════════════════════════════════════ */}
        {hasFirstLog && (
          <>
            <section className="mb-7">
              <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
                {t("profile.tabs.stats")}
              </p>
              <PersonalBests userId={user.id} />
              <div className="mt-4">
                <TrainingChart userId={user.id} isPro={isPro} />
              </div>
              <StatsAccordion userId={user.id} isPro={isPro} />
            </section>

            <section className="mb-7">
              <MilestoneBadgeGrid totalCount={totalCount} />
            </section>

            <section className="mb-7">
              <ProGate isPro={isPro} feature="ロール分析 & パートナー統計" userId={user.id}>
                <div className="space-y-4">
                  <RollAnalyticsCard userId={user.id} />
                  <PartnerStatsCard userId={user.id} />
                </div>
              </ProGate>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
