import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
import TrainingChart from "@/components/TrainingChart";
import TrainingBarChart from "@/components/TrainingBarChart";
import TrainingTypeChart from "@/components/TrainingTypeChart";
import CompetitionStats from "@/components/CompetitionStats";
import GoalTracker from "@/components/GoalTracker";
import WeeklyStrip from "@/components/WeeklyStrip";
import GuestDashboard from "@/components/GuestDashboard";
import GuestMigration from "@/components/GuestMigration";
import StreakProtect from "@/components/StreakProtect";
import StreakFreeze from "@/components/StreakFreeze";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";
import InsightsBanner from "@/components/InsightsBanner";
import CollapsibleSection from "@/components/CollapsibleSection";
import BeltProgressCard from "@/components/BeltProgressCard";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import GymKickBanner from "@/components/GymKickBanner";
import GymRanking from "@/components/GymRanking";
import GymCurriculumCard from "@/components/GymCurriculumCard";
import TimeGreeting from "@/components/TimeGreeting";
import {
  getLocalDateString,
  getYesterdayDateString,
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { serverT as t } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "belt, stripe, start_date, is_pro, gym_name, weekly_goal, subscription_status, gym_id, gym_kick_notified, share_data_with_gym"
    )
    .eq("id", userId)
    .single();
  return data as {
    belt: string;
    stripe: number;
    start_date: string | null;
    is_pro: boolean;
    gym_name: string | null;
    weekly_goal?: number | null;
    subscription_status?: string | null;
    gym_id?: string | null;
    gym_kick_notified?: boolean | null;
    share_data_with_gym?: boolean | null;
  } | null;
});

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Dashboard" };

  const profile = await getCachedProfile(user.id);
  const [{ count: totalCount }, { data: recentLogsForStreak }] =
    await Promise.all([
      supabase
        .from("training_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("training_logs")
        .select("date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(60),
    ]);

  const belt = profile?.belt ?? "white";
  const count = totalCount ?? 0;
  let months = 0;
  if (profile?.start_date) {
    months = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(profile.start_date).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    );
  }
  const BELT_LABELS: Record<string, string> = {
    white: t("dashboard.beltWhite"),
    blue: t("dashboard.beltBlue"),
    purple: t("dashboard.beltPurple"),
    brown: t("dashboard.beltBrown"),
    black: t("dashboard.beltBlack"),
  };
  const beltLabel = BELT_LABELS[belt] ?? t("dashboard.beltWhite");

  let metaStreak = 0;
  const metaToday = getLocalDateString();
  const trainedToday = recentLogsForStreak?.some((l: { date: string }) => l.date === metaToday) ?? false;
  if (recentLogsForStreak && recentLogsForStreak.length > 0) {
    const dates = [
      ...new Set(recentLogsForStreak.map((l: { date: string }) => l.date)),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const today = getLocalDateString();
    const yesterday = getYesterdayDateString();
    if (dates[0] === today || dates[0] === yesterday) {
      metaStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.round(
          (new Date(dates[i - 1] as string).getTime() -
            new Date(dates[i] as string).getTime()) /
            86400000
        );
        if (diff === 1) metaStreak++;
        else break;
      }
    }
  }

  const ogImageUrl = `${BASE_URL}/api/og?belt=${belt}&count=${count}&months=${months}&streak=${metaStreak}`;
  const title = `BJJ Training Log — ${count} Sessions! | BJJ App`;
  const description = `${beltLabel} · ${count} total sessions · ${months} months of BJJ — tracking every roll with BJJ App`;

  return {
    title: count > 0 ? `Dashboard — ${count} sessions` : "Dashboard",
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "BJJ App Training Record",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const isWelcomeRedirect = resolvedParams?.welcome === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <GuestDashboard />;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const firstDayOfMonth = getMonthStartDate();
  const firstDayOfWeek = getWeekStartDate();
  const { year, month, day: dayOfMonth } = getLocalDateParts();
  const daysInMonth = new Date(year, month, 0).getDate();
  const remainingDays = daysInMonth - dayOfMonth;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const firstDayOfPrevMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

  const profileData = await getCachedProfile(user.id);

  const [
    { count: monthCount },
    { count: prevMonthCount },
    { count: weekCount },
    { count: techniqueCount },
    { count: totalCount },
    { data: recentLogs },
    { data: monthMinData },
    { data: recentTechniques },
  ] = await Promise.all([
    supabase
      .from("training_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date", firstDayOfMonth),
    supabase
      .from("training_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date", firstDayOfPrevMonth)
      .lt("date", firstDayOfMonth),
    supabase
      .from("training_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date", firstDayOfWeek),
    supabase
      .from("techniques")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("training_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("training_logs")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(60),
    supabase
      .from("training_logs")
      .select("duration_min")
      .eq("user_id", user.id)
      .gte("date", firstDayOfMonth),
    supabase
      .from("techniques")
      .select("name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const monthTotalMins = (monthMinData ?? []).reduce(
    (sum: number, r: { duration_min: number }) => sum + (r.duration_min ?? 0),
    0
  );
  const monthHoursStr =
    monthTotalMins >= 60
      ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
      : monthTotalMins > 0
        ? `${monthTotalMins}m`
        : null;

  const monthSessionCount = monthCount ?? 0;
  const avgSessionMin =
    monthSessionCount > 0
      ? Math.round(monthTotalMins / monthSessionCount)
      : 0;

  const isPro = profileData?.is_pro ?? false;
  const gymName = profileData?.gym_name ?? null;
  const belt = profileData?.belt ?? "white";
  const stripeCount = profileData?.stripe ?? 0;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  const showKickBanner =
    profileData?.gym_kick_notified === false && !profileData?.gym_id;
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;

  let gymCurriculum: {
    curriculum_url: string;
    curriculum_set_at: string;
  } | null = null;
  if (gymId && shareDataWithGym) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: gymData } = await supabase
      .from("gyms")
      .select("curriculum_url, curriculum_set_at")
      .eq("id", gymId)
      .not("curriculum_url", "is", null)
      .gte("curriculum_set_at", sevenDaysAgo)
      .single();
    if (gymData?.curriculum_url && gymData?.curriculum_set_at) {
      gymCurriculum = {
        curriculum_url: gymData.curriculum_url,
        curriculum_set_at: gymData.curriculum_set_at,
      };
    }
  }

  const hasFirstLog = (totalCount ?? 0) > 0;
  const hasGoal = (weeklyGoal ?? 0) > 0;
  const hasTechnique = (techniqueCount ?? 0) > 0;
  // Onboarding complete = all 3 steps done → show InsightsBanner, hide checklist
  const isOnboardingComplete = hasFirstLog && hasGoal && hasTechnique;

  let monthsAtBelt = 0;
  if (profileData?.start_date) {
    monthsAtBelt = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(profileData.start_date).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    );
  }

  // Calculate streak + trainedToday
  const todayStr = getLocalDateString();
  const trainedToday = recentLogs?.some((l: { date: string }) => l.date === todayStr) ?? false;
  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const dates = [
      ...new Set(recentLogs.map((l: { date: string }) => l.date)),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const today = getLocalDateString();
    const yesterday = getYesterdayDateString();
    if (dates[0] === today || dates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.round(
          (new Date(dates[i - 1] as string).getTime() -
            new Date(dates[i] as string).getTime()) /
            86400000
        );
        if (diff === 1) streak++;
        else break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      <GuestMigration userId={user.id} />
      <AchievementBadge userId={user.id} totalCount={totalCount ?? 0} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* ── Gym kick notification ── */}
        {showKickBanner && <GymKickBanner userId={user.id} />}

        {/* ── Onboarding checklist (new users) ── */}
        <OnboardingChecklist
          hasFirstLog={hasFirstLog}
          hasGoal={hasGoal}
          hasTechnique={hasTechnique}
        />

        {/* ═══════════════════════════════════════════
            HERO STRIP — greeting + key stats in one row
            ═══════════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════
            HERO CARD — greeting + Log CTA in one box
            ═══════════════════════════════════════════ */}
        {/* HERO CARD: greeting + avatar (row1) + Log CTA (row2, 未記録時のみ) */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-4 mb-5">
          {/* Row 1: identity + avatar/belt pill */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shrink-0">
                <span className="text-base font-black text-zinc-900">柔</span>
              </div>
              <div className="min-w-0">
                <TimeGreeting displayName={displayName} />
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {streak >= 7
                    ? `🔥 ${streak}-day streak`
                    : streak >= 3
                      ? `🎯 ${streak}-day streak`
                      : streak >= 1
                        ? t("dashboard.streakCardLogToday")
                        : hasFirstLog
                          ? t("dashboard.streakCardKeepRolling")
                          : t("dashboard.streakCardStartFresh")}
                </p>
              </div>
            </div>
            {/* Avatar or belt pill — always visible */}
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full border border-white/20 shrink-0 object-cover"
              />
            ) : (
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-zinc-900/60 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-xs font-bold text-zinc-400 tracking-widest uppercase">
                  {belt}
                </span>
                {stripeCount > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: stripeCount }).map((_, i) => (
                      <div key={i} className="w-1 h-3 bg-white/70 rounded-full" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Row 2: Log CTA — 未記録時のみ */}
          {!trainedToday && (
            <Link
              href={`?addLog=${todayStr}`}
              className="mt-3 flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/30"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t("dashboard.logSession")}
            </Link>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 1 — PRIMARY ACTION: Log a Session
            (プライマリアクション・ダッシュボード最上部)
            ═══════════════════════════════════════════ */}
        <section className="mb-7">
          <TrainingLog
            userId={user.id}
            isPro={isPro}
            initialOpen={isWelcomeRedirect && (totalCount ?? 0) === 0}
          />
        </section>

        {/* ═══════════════════════════════════════════
            SECTION 2 — COMPACT BENTO STATS
            ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">

          {/* Streak — hero */}
          <Link
            href="/profile"
            className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-yellow-400/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 active:scale-95 group relative"
          >
            <svg className="absolute top-3 right-3 w-3.5 h-3.5 text-zinc-500 group-hover:text-yellow-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-semibold text-zinc-500 tracking-widest block mb-1">
              {t("dashboard.streak")}
            </span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                {streak}
              </span>
              <span className="text-zinc-500 text-xs mb-0.5">
                {t("dashboard.streakDaysUnit")}
              </span>
            </div>
            <span className="mt-1.5 block text-xs text-yellow-400/80">
              {streak >= 14
                ? t("dashboard.streakCardExcellent")
                : streak >= 7
                  ? t("dashboard.streakCardOnARoll")
                  : streak >= 3
                    ? t("dashboard.streakCardKeepGoing")
                    : streak >= 1
                      ? t("dashboard.streakCardKeepRolling")
                      : t("dashboard.streakCardStart")}
            </span>
          </Link>

          {/* This week */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-blue-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
            <span className="text-xs font-semibold text-zinc-500 tracking-widest block mb-1">
              {t("dashboard.weekTraining")}
            </span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                {weekCount ?? 0}
              </span>
              <span className="text-zinc-500 text-xs mb-0.5">
                {t("dashboard.sessionsUnit")}
              </span>
            </div>
            {weeklyGoal > 0 && (
              <span className="mt-1.5 block text-xs text-blue-400/80">
                {t("dashboard.bentoGoalLabel", {
                  done: weekCount ?? 0,
                  goal: weeklyGoal,
                })}
              </span>
            )}
          </div>

          {/* This month — wide */}
          <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-rose-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 tracking-widest">
                {t("dashboard.monthTraining")}
              </span>
              {prevMonthCount !== null && prevMonthCount !== undefined && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    (monthCount ?? 0) >= prevMonthCount
                      ? "text-green-400 bg-green-400/10"
                      : "text-red-400 bg-red-400/10"
                  }`}
                >
                  {(monthCount ?? 0) >= prevMonthCount ? "▲" : "▼"}
                  {Math.abs((monthCount ?? 0) - prevMonthCount)}{" "}
                  {t("dashboard.bentoVsLastMonth")}
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                {monthCount ?? 0}
              </span>
              <span className="text-zinc-500 text-sm mb-0.5">
                {t("dashboard.sessionsUnit")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {monthHoursStr && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-400 font-medium">
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6l4 2"
                    />
                  </svg>
                  {monthHoursStr}
                </span>
              )}
              {remainingDays > 0 && (
                <span className="text-xs text-zinc-500">
                  {t("dashboard.bentoDaysLeft", { n: remainingDays })}
                  {(monthCount ?? 0) > 0 && dayOfMonth > 0 && (
                    <span className="text-blue-400 ml-1">
                      {t("dashboard.bentoOnPaceFor", {
                        n: Math.round(
                          ((monthCount ?? 0) / dayOfMonth) * daysInMonth
                        ),
                      })}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Belt progress */}
          <BeltProgressCard
            belt={belt}
            stripes={stripeCount}
            monthsAtBelt={monthsAtBelt}
            className="col-span-2"
          />

          {/* Techniques */}
          <Link
            href="/techniques"
            className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 active:scale-95 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-zinc-500 tracking-widest block mb-1">
                  {t("dashboard.techniques")}
                </span>
                <div className="flex items-end gap-1.5">
                  <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                    {techniqueCount ?? 0}
                  </span>
                  <span className="text-zinc-500 text-xs mb-0.5">
                    {t("dashboard.loggedUnit")}
                  </span>
                </div>
              </div>
              <svg
                className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 transition-colors flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            {recentTechniques && recentTechniques.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(recentTechniques as { name: string }[]).slice(0, 2).map((tech) => (
                  <span
                    key={tech.name}
                    className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700 truncate max-w-[120px]"
                  >
                    {tech.name}
                  </span>
                ))}
              </div>
            )}
          </Link>

          {/* Avg session — compact col-span-1 (no dead space) */}
          {avgSessionMin > 0 && (
            <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
              <span className="text-xs font-semibold text-zinc-500 tracking-widest block mb-1">
                {t("dashboard.bentoAvgSession")}
              </span>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-black leading-none tabular-nums text-zinc-300">
                  {avgSessionMin}
                </span>
                <span className="text-zinc-500 text-xs mb-0.5">
                  {t("dashboard.bentoMinPerSession")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 3 — THIS WEEK
            ═══════════════════════════════════════════ */}
        <section className="mb-7">
          <p className="text-xs font-semibold text-zinc-500 tracking-widest px-0.5 mb-3 uppercase">
            {t("dashboard.weekTraining")}
          </p>
          <div className="space-y-3">
            <WeeklyStrip userId={user.id} />
            {hasFirstLog && <GoalTracker userId={user.id} />}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SECTION 4 — GYM CURRICULUM (members only)
            ═══════════════════════════════════════════ */}
        {gymCurriculum && (
          <section className="mb-7">
            <p className="text-xs font-semibold text-zinc-500 tracking-widest px-0.5 mb-3 uppercase">
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

        {/* ═══════════════════════════════════════════
            SECTION 5 — GYM LEADERBOARD (opt-in only)
            ═══════════════════════════════════════════ */}
        {gymId && shareDataWithGym && (
          <section className="mb-7">
            <p className="text-xs font-semibold text-zinc-500 tracking-widest px-0.5 mb-3 uppercase">
              {t("dashboard.sectionYourGym")}
            </p>
            <GymRanking userId={user.id} gymId={gymId} />
          </section>
        )}

        {/* ═══════════════════════════════════════════
            SECTION 6 — STREAK NUDGE (streak ≥ 3 only)
            ProUpgradeBanner removed — no upsell on home screen
            ═══════════════════════════════════════════ */}
        {streak >= 3 && (
          <section className="space-y-3 mb-7">
            <StreakProtect userId={user.id} streak={streak} />
            <StreakFreeze userId={user.id} streak={streak} />
          </section>
        )}

        {/* ═══════════════════════════════════════════
            SECTION 7 — ANALYTICS (collapsed by default)
            ═══════════════════════════════════════════ */}
        <CollapsibleSection
          label={t("dashboard.analyticsLabel")}
          defaultOpen={false}
          contentHint={t("dashboard.analyticsHint")}
        >
          <TrainingBarChart userId={user.id} isPro={isPro} />
          <TrainingTypeChart userId={user.id} isPro={isPro} />
          <CompetitionStats userId={user.id} />
          <TrainingChart
            userId={user.id}
            isPro={isPro}
            onLogRoll={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
          />
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════
            SECTION 8 — INSIGHTS
            Exclusive with OnboardingChecklist:
            shown only after all 3 onboarding steps done
            ═══════════════════════════════════════════ */}
        {isOnboardingComplete && (
          <section className="mt-7 mb-4">
            <InsightsBanner userId={user.id} />
          </section>
        )}
      </main>
    </div>
  );
}
