import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
// TrainingChart moved to Profile/Analytics tab (③-4)
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
import InviteCard from "@/components/InviteCard";
import TimeGreeting from "@/components/TimeGreeting";
import AICoachCard from "@/components/AICoachCard";
import {
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { getLogicalTrainingDate } from "@/lib/logicalDate";
import { serverT as t } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

// ── Dynamic motivational message based on last training date ─────────────────
function DashboardMotivation({ daysSince }: { daysSince: number | null }) {
  if (daysSince === null) return null;

  const config: { emoji: string; msg: string; color: string } =
    daysSince === 0
      ? { emoji: "🏆", msg: t("dashboard.motivationTrainedToday"), color: "text-emerald-300" }
      : daysSince === 1
      ? { emoji: "💪", msg: t("dashboard.motivationTrainedYesterday"), color: "text-emerald-400" }
      : daysSince <= 3
      ? { emoji: "🎯", msg: t("dashboard.motivationGapDays", { n: daysSince }), color: "text-yellow-300" }
      : daysSince <= 7
      ? { emoji: "🥋", msg: t("dashboard.motivationGapWeek"), color: "text-orange-300" }
      : { emoji: "👊", msg: t("dashboard.motivationGapLong"), color: "text-red-300" };

  return (
    <div className="rounded-2xl border border-white/8 bg-zinc-900/40 px-5 py-4 flex items-center gap-4 mb-5">
      <span className="text-2xl flex-shrink-0">{config.emoji}</span>
      <p className={`text-sm font-medium leading-relaxed ${config.color}`}>{config.msg}</p>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Dashboard" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("belt, stripe, start_date")
    .eq("id", user.id)
    .single();

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
  const metaToday = getLogicalTrainingDate();
  if (recentLogsForStreak && recentLogsForStreak.length > 0) {
    const uniqueDates = [
      ...new Set(recentLogsForStreak.map((l: { date: string }) => l.date)),
    ].sort().reverse() as string[];
    let checkDateMs = new Date(metaToday + "T00:00:00Z").getTime();
    for (const dateStr of uniqueDates) {
      const check = new Date(checkDateMs).toISOString().slice(0, 10);
      if (dateStr === check) {
        metaStreak++;
        checkDateMs -= 86400000;
      } else if (dateStr < check) {
        break;
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select(
      "belt, stripe, start_date, is_pro, gym_name, weekly_goal, gym_id, gym_kick_notified, share_data_with_gym, referral_code, ai_coach_cache, ai_coach_last_generated"
    )
    .eq("id", user.id)
    .single();

  // ── Aggregated dashboard metrics (single RPC instead of 6 separate queries) ──
  // Fallback: if the RPC function is not deployed yet, run direct count queries.
  const [rpcRes, { data: recentLogs }, { data: recentTechniques }, { data: typeBreakdownRaw }] =
    await Promise.all([
      supabase.rpc("get_dashboard_metrics", {
        p_user_id: user.id,
        p_month_start: firstDayOfMonth,
        p_prev_month_start: firstDayOfPrevMonth,
        p_week_start: firstDayOfWeek,
      }),
      supabase
        .from("training_logs")
        .select("date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(60),
      supabase
        .from("techniques")
        .select("name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("training_logs")
        .select("type")
        .eq("user_id", user.id)
        .gte("date", firstDayOfMonth),
    ]);

  // Use RPC result if available; otherwise fall back to direct count queries
  let metrics = rpcRes.data;
  if (!metrics || (Array.isArray(metrics) && metrics.length === 0)) {
    const [mRes, pmRes, wRes, tRes, totRes, mMinsRes] = await Promise.all([
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfMonth),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfPrevMonth).lt("date", firstDayOfMonth),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfWeek),
      supabase.from("techniques").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("training_logs").select("duration_min").eq("user_id", user.id).gte("date", firstDayOfMonth),
    ]);
    metrics = [{
      month_count: mRes.count ?? 0,
      prev_month_count: pmRes.count ?? 0,
      week_count: wRes.count ?? 0,
      technique_count: tRes.count ?? 0,
      total_count: totRes.count ?? 0,
      month_total_mins: (mMinsRes.data ?? []).reduce((s: number, r: { duration_min: number }) => s + (r.duration_min || 0), 0),
    }];
  }

  const m = Array.isArray(metrics) ? metrics[0] : metrics;
  const monthCount = Number(m?.month_count ?? 0);
  const prevMonthCount = Number(m?.prev_month_count ?? 0);
  const weekCount = Number(m?.week_count ?? 0);
  const techniqueCount = Number(m?.technique_count ?? 0);
  const totalCount = Number(m?.total_count ?? 0);
  const monthTotalMins = Number(m?.month_total_mins ?? 0);
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

  // Training type breakdown (Gi / No-Gi / Drilling / etc.)
  const typeBreakdown: Record<string, number> = {};
  if (typeBreakdownRaw && typeBreakdownRaw.length > 0) {
    for (const row of typeBreakdownRaw as { type: string }[]) {
      const t = row.type || "Other";
      typeBreakdown[t] = (typeBreakdown[t] ?? 0) + 1;
    }
  }

  const isPro = profileData?.is_pro ?? false;
  const gymName = profileData?.gym_name ?? null;
  const belt = profileData?.belt ?? "white";
  const stripeCount = profileData?.stripe ?? 0;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  const showKickBanner =
    profileData?.gym_kick_notified === false && !profileData?.gym_id;
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;
  const referralCode = (profileData as { referral_code?: string | null })?.referral_code ?? null;

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

  // Days since last training log (for dynamic motivational message)
  const todayStr = getLogicalTrainingDate();
  const lastLogDate = recentLogs?.[0]?.date ?? null;
  const daysSinceLastLog: number | null = lastLogDate
    ? Math.round((new Date(todayStr).getTime() - new Date(lastLogDate).getTime()) / 86400000)
    : null;

  // Calculate streak + trainedToday (same algorithm as NavBar — uses logical training date)
  const trainedToday = recentLogs?.some((l: { date: string }) => l.date === todayStr) ?? false;
  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const uniqueDates = [
      ...new Set(recentLogs.map((l: { date: string }) => l.date)),
    ].sort().reverse() as string[];
    let checkDateMs = new Date(todayStr + "T00:00:00Z").getTime();
    for (const dateStr of uniqueDates) {
      const check = new Date(checkDateMs).toISOString().slice(0, 10);
      if (dateStr === check) {
        streak++;
        checkDateMs -= 86400000;
      } else if (dateStr < check) {
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />
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
            HERO CARD — greeting + avatar (row1) + Log CTA (row2, 未記録時のみ)
            ═══════════════════════════════════════════ */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-4 mb-5">
          {/* Row 1: identity + avatar/belt pill */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shrink-0">
                <span className="text-base font-black text-zinc-900">柔</span>
              </div>
              <div className="min-w-0">
                <TimeGreeting displayName={displayName} />
                <p className="text-gray-400 text-xs mt-0.5 truncate">
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
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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
              {t("training.logSession")}
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
            <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
              {t("dashboard.streak")}
            </span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                {streak}
              </span>
              <span className="text-zinc-400 text-xs mb-0.5">
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
                      : (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-yellow-400">
                          {t("dashboard.streakCardStart")}
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      )}
            </span>
          </Link>

          {/* This week */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-emerald-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
            <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
              {t("dashboard.weekTraining")}
            </span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {weekCount ?? 0}
              </span>
              <span className="text-zinc-400 text-xs mb-0.5">
                {t("dashboard.sessionsUnit")}
              </span>
            </div>
            {weeklyGoal > 0 && (
              <span className="mt-1.5 block text-xs text-emerald-400/80">
                {t("dashboard.bentoGoalLabel", {
                  done: weekCount ?? 0,
                  goal: weeklyGoal,
                })}
              </span>
            )}
          </div>

          {/* This month — wide */}
          <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-emerald-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest">
                {t("dashboard.monthTraining")}
              </span>
              {prevMonthCount !== null && prevMonthCount !== undefined && prevMonthCount > 0 && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    (monthCount ?? 0) >= prevMonthCount
                      ? "text-emerald-400 bg-emerald-400/10"
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
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {monthCount ?? 0}
              </span>
              <span className="text-zinc-400 text-sm mb-0.5">
                {t("dashboard.sessionsUnit")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {monthHoursStr && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium">
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
                <span className="text-xs text-zinc-400">
                  {t("dashboard.bentoDaysLeft", { n: remainingDays })}
                  {(monthCount ?? 0) > 0 && dayOfMonth > 0 && (
                    <span className="text-emerald-400 ml-1">
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

          {/* Avg session — col-span-2, BeltProgressと同じ行に横並び（dead space解消）*/}
          {avgSessionMin > 0 && (
            <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                {t("dashboard.bentoAvgSession")}
              </span>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  {avgSessionMin}
                </span>
                <span className="text-zinc-400 text-xs mb-0.5">
                  {t("dashboard.bentoMinPerSession")}
                </span>
              </div>
            </div>
          )}

          {/* Training Type Breakdown — data moat: insights from accumulated logs */}
          {Object.keys(typeBreakdown).length > 1 && monthCount > 2 && (
            <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-2">
                {t("dashboard.typeBreakdownTitle")}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(typeBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const pct = Math.round((count / monthCount) * 100);
                    return (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1 bg-zinc-800/80 text-xs text-zinc-300 px-2.5 py-1.5 rounded-lg border border-white/5"
                      >
                        <span className="font-semibold">{type}</span>
                        <span className="text-zinc-500">{pct}%</span>
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Techniques */}
          <Link
            href="/techniques"
            className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 active:scale-95 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                  {t("dashboard.techniques")}
                </span>
                <div className="flex items-end gap-1.5">
                  <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                    {techniqueCount ?? 0}
                  </span>
                  <span className="text-zinc-400 text-xs mb-0.5">
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
                {(recentTechniques as { name: string }[])
                  .filter((tech) => tech.name && tech.name.length > 1)
                  .slice(0, 2)
                  .map((tech) => (
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

          {/* ── Items 28/32: Pro upsell hook cards (free users only) ── */}
          {/* Honest text CTAs — no fake data visualizations */}
          {!isPro && (
            <>
              {/* Item 28: 12-Month Training Graph teaser */}
              <Link
                href="/profile#upgrade"
                className="col-span-2 md:col-span-1 relative bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:border-amber-400/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 to-transparent pointer-events-none" />
                <div className="relative">
                  <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                    {t("dashboard.upsellWinRateLabel")}
                  </span>
                  <p className="text-sm text-zinc-300 mt-1 leading-snug">
                    {t("dashboard.upsellGraphDesc")}
                  </p>
                  <span className="mt-2 block text-xs text-amber-500/80 font-semibold group-hover:text-amber-400 transition-colors">
                    {t("dashboard.upsellUpgradeCta")} →
                  </span>
                </div>
              </Link>

              {/* Item 32: Body Management teaser */}
              <Link
                href="/profile"
                className="col-span-2 md:col-span-1 relative bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:border-rose-400/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-900/10 to-transparent pointer-events-none" />
                <div className="relative">
                  <span className="text-xs font-semibold text-zinc-400 tracking-widest block mb-1">
                    {t("dashboard.upsellInjuryLabel")}
                  </span>
                  <p className="text-sm text-zinc-300 mt-1 leading-snug">
                    {t("dashboard.upsellBodyDesc")}
                  </p>
                  <span className="mt-2 block text-xs text-rose-500/80 font-semibold group-hover:text-rose-400 transition-colors">
                    {t("dashboard.upsellUpgradeCta")} →
                  </span>
                </div>
              </Link>
            </>
          )}

        </div>

        {/* ═══════════════════════════════════════════
            SECTION 3 — THIS WEEK
            ═══════════════════════════════════════════ */}
        <section className="mb-7">
          <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
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

        {/* ═══════════════════════════════════════════
            SECTION 5 — GYM LEADERBOARD (opt-in only)
            ═══════════════════════════════════════════ */}
        {gymId && shareDataWithGym && (
          <section className="mb-7">
            <p className="text-xs font-semibold text-zinc-400 tracking-widest px-0.5 mb-3 uppercase">
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
            Hidden for new users with no logs yet
            ═══════════════════════════════════════════ */}
        {hasFirstLog ? (
          <>
            {/* Dynamic motivational message — streak危機バナー表示中は非表示（メッセージ重複防止）*/}
            {streak < 3 && <DashboardMotivation daysSince={daysSinceLastLog} />}
            <CollapsibleSection
              label={t("dashboard.analyticsLabel")}
              defaultOpen={false}
              contentHint={t("dashboard.analyticsHint")}
              cardTrigger
            >
              <TrainingBarChart userId={user.id} isPro={isPro} />
              <TrainingTypeChart userId={user.id} isPro={isPro} />
              <CompetitionStats userId={user.id} />
              {/* TrainingChart (heatmap) moved to Profile → Analytics tab */}
            </CollapsibleSection>

            {/* AI Micro-Coach (Pro + all users see gate) */}
            <AICoachCard
              userId={user.id}
              isPro={isPro}
              initialCoaching={(profileData as { ai_coach_cache?: string | null })?.ai_coach_cache ?? null}
              initialGeneratedAt={(profileData as { ai_coach_last_generated?: string | null })?.ai_coach_last_generated ?? null}
            />
          </>
        ) : (
          /* Empty state: Day 1 ユーザー向けCTA */
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-8 text-center mb-7">
            <div className="text-5xl mb-4">🔥</div>
            <h2 className="text-white font-bold text-lg mb-2">
              {t("dashboard.emptyStateTitle")}
            </h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              {t("dashboard.emptyStateDesc")}
            </p>
            <a
              href="#training-log-form"
              className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#10B981]/20"
            >
              <span>+</span> {t("dashboard.emptyStateCta")}
            </a>
            {/* Wiki 初心者リンク */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <p className="text-zinc-400 text-xs mb-3">{t("dashboard.emptyStateNewToBjj")}</p>
              <a
                href="https://wiki.bjj-app.net/wiki/en/bjj-basics"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-white/20 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-all"
              >
                <span>📚</span>
                <span>{t("dashboard.emptyStateWikiLink")}</span>
              </a>
            </div>
          </div>
        )}

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

        {/* ═══════════════════════════════════════════
            SECTION 9 — INVITE FRIENDS (referral system)
            ═══════════════════════════════════════════ */}
        {referralCode && hasFirstLog && (
          <section className="mb-7">
            <InviteCard referralCode={referralCode} />
          </section>
        )}
      </main>
    </div>
  );
}
