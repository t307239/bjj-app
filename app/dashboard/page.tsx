import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
// TrainingChart moved to Profile/Analytics tab (③-4)
import GoalTracker from "@/components/GoalTracker";
import WeeklyStrip from "@/components/WeeklyStrip";
import GuestMigration from "@/components/GuestMigration";
import StreakProtect from "@/components/StreakProtect";
import StreakFreeze from "@/components/StreakFreeze";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";
import InsightsBanner from "@/components/InsightsBanner";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import GymKickBanner from "@/components/GymKickBanner";
import GymCurriculumCard from "@/components/GymCurriculumCard";
import WeightGoalWidget from "@/components/WeightGoalWidget";
import InviteCard from "@/components/InviteCard";
import {
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { getLogicalTrainingDate } from "@/lib/logicalDate";
import { serverT, makeT, type Locale } from "@/lib/i18n";
import { calcBjjDuration, formatBjjDuration } from "@/lib/bjjDuration";
import ProStatusBanner from "@/components/ProStatusBanner";
import GuestDashboardClient from "@/components/GuestDashboardClient";

// ─── Extracted sub-components ─────────────────────────────────────────────────
import HeroCard from "@/components/dashboard/HeroCard";
import BentoStatsGrid from "@/components/dashboard/BentoStatsGrid";

// perf: 条件表示コンポーネント（gym 所属者のみ / Pro のみ）を遅延読み込み
// → 未所属ユーザーは GymRanking のコードを一切ダウンロードしない
const GymRanking = dynamic(() => import("@/components/GymRanking"), {
  loading: () => <div className="min-h-[120px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
// perf: AI Coach は Pro ユーザー向けかつ折り返し以下 → 遅延読み込み
const AICoachCard = dynamic(() => import("@/components/AICoachCard"), {
  loading: () => <div className="min-h-[128px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});

// perf: 折り返し以下の重いチャート群を遅延読み込み（初期JSバンドルから除外）
// CLS防御: loading skeleton の高さを実コンポーネントの内部 Skeleton と揃えて min-h で確保
// TrainingBarChart / TrainingTypeChart は Profile > 統計タブへ移動（T-25）
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Dashboard" };

  // perf: profile を単独 await → Promise.all 化して waterfall を解消
  const [{ data: profile }, { count: totalCount }, { data: recentLogsForStreak }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("belt, stripe, start_date")
        .eq("id", user.id)
        .single(),
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
  const { totalMonths: months } = profile?.start_date
    ? calcBjjDuration(profile.start_date)
    : { totalMonths: 0 };
  const BELT_LABELS: Record<string, string> = {
    white: serverT("dashboard.beltWhite"),
    blue: serverT("dashboard.beltBlue"),
    purple: serverT("dashboard.beltPurple"),
    brown: serverT("dashboard.beltBrown"),
    black: serverT("dashboard.beltBlack"),
  };
  const beltLabel = BELT_LABELS[belt] ?? serverT("dashboard.beltWhite");

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
  const bjjDurLabel = profile?.start_date ? formatBjjDuration(profile.start_date, serverT) : null;
  const description = bjjDurLabel
    ? `${beltLabel} · ${count} total sessions · ${bjjDurLabel} of BJJ — tracking every roll with BJJ App`
    : `${beltLabel} · ${count} total sessions — tracking every roll with BJJ App`;

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
  const { year, month, day: dayOfMonth } = getLocalDateParts();
  const daysInMonth = new Date(year, month, 0).getDate();
  const remainingDays = daysInMonth - dayOfMonth;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const firstDayOfPrevMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

  // ── 全データを並列フェッチ（profile + RPC metrics + logs を1ウェーブで取得）──
  // perf: profileData を単独 await から Promise.all に移動して waterfall を解消
  const [
    { data: profileData },
    rpcRes,
    { data: recentLogs },
    { data: recentTechniques },
    { data: typeBreakdownRaw },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "belt, stripe, start_date, is_pro, subscription_status, gym_name, weekly_goal, gym_id, gym_kick_notified, share_data_with_gym, referral_code, ai_coach_cache, ai_coach_last_generated, locale, target_weight, target_weight_date"
      )
      .eq("id", user.id)
      .single(),
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

  // ── Locale-aware translation for page body (metadata stays EN for SEO) ──
  // Priority: bjj_locale cookie → profile.locale (ja only) → Accept-Language → "en"
  // NOTE: pt disabled on server — pt.json is ~18% complete, would show mixed pt/en
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

  // Training type breakdown (Gi / No-Gi / Drilling / etc.)
  const typeBreakdown: Record<string, number> = {};
  if (typeBreakdownRaw && typeBreakdownRaw.length > 0) {
    for (const row of typeBreakdownRaw as { type: string }[]) {
      const tp = row.type || t("dashboard.typeOther");
      typeBreakdown[tp] = (typeBreakdown[tp] ?? 0) + 1;
    }
  }

  const isPro = profileData?.is_pro ?? false;
  const subscriptionStatus = profileData?.subscription_status ?? "active";
  const gymName = profileData?.gym_name ?? null;
  const belt = profileData?.belt ?? "white";
  const stripeCount = profileData?.stripe ?? 0;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  const showKickBanner =
    profileData?.gym_kick_notified === false && !profileData?.gym_id;
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;
  const referralCode = (profileData as { referral_code?: string | null })?.referral_code ?? null;
  const targetWeight = profileData?.target_weight != null ? Number(profileData.target_weight) : null;
  const targetWeightDate = (profileData as { target_weight_date?: string | null })?.target_weight_date ?? null;

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

  const monthsAtBelt = profileData?.start_date
    ? calcBjjDuration(profileData.start_date).totalMonths
    : 0;

  // Calculate streak (same algorithm as NavBar — uses logical training date)
  const todayStr = getLogicalTrainingDate();
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
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />
      <ProStatusBanner subscriptionStatus={subscriptionStatus} />
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
            HERO CARD — greeting + avatar/belt pill
            ═══════════════════════════════════════════ */}
        <HeroCard
          displayName={displayName}
          avatarUrl={avatarUrl}
          belt={belt}
          stripeCount={stripeCount}
          streak={streak}
          hasFirstLog={hasFirstLog}
          t={t}
        />

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
        <BentoStatsGrid
          streak={streak}
          weekCount={weekCount}
          monthCount={monthCount}
          prevMonthCount={prevMonthCount}
          weeklyGoal={weeklyGoal}
          monthHoursStr={monthHoursStr}
          remainingDays={remainingDays}
          dayOfMonth={dayOfMonth}
          daysInMonth={daysInMonth}
          avgSessionMin={avgSessionMin}
          typeBreakdown={typeBreakdown}
          techniqueCount={techniqueCount}
          recentTechniques={recentTechniques as { name: string }[] | null}
          belt={belt}
          stripeCount={stripeCount}
          monthsAtBelt={monthsAtBelt}
          isPro={isPro}
          t={t}
        />

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
            {targetWeight != null && isPro && (
              <WeightGoalWidget targetWeight={targetWeight} targetDate={targetWeightDate} />
            )}
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
            SECTION 7 — AI MICRO-COACH
            ═══════════════════════════════════════════ */}
        {hasFirstLog && (
          <AICoachCard
            userId={user.id}
            isPro={isPro}
            initialCoaching={profileData?.ai_coach_cache ?? null}
            initialGeneratedAt={profileData?.ai_coach_last_generated ?? null}
          />
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
