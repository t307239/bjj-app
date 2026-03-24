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
// PersonalBests はプロフィールページのみに表示
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
import ProUpgradeBanner from "@/components/ProUpgradeBanner";
import BeltProgressCard from "@/components/BeltProgressCard";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import GymKickBanner from "@/components/GymKickBanner";
import GymRanking from "@/components/GymRanking";
import GymCurriculumCard from "@/components/GymCurriculumCard";
import BackToTop from "@/components/BackToTop";
import TimeGreeting from "@/components/TimeGreeting";
import { getLocalDateString, getYesterdayDateString, getWeekStartDate, getMonthStartDate, getLocalDateParts } from "@/lib/timezone";
import { serverT as t } from "@/lib/i18n";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

// React.cache で プロフィール二重クエリを最適化
const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("belt, stripe, start_date, is_pro, gym_name, weekly_goal, subscription_status, gym_id, gym_kick_notified, share_data_with_gym")
    .eq("id", userId)
    .single();
  return data as { belt: string; stripe: number; start_date: string | null; is_pro: boolean; gym_name: string | null; weekly_goal?: number | null; subscription_status?: string | null; gym_id?: string | null; gym_kick_notified?: boolean | null; share_data_with_gym?: boolean | null } | null;
});

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "Dashboard" };
  }

  // プロフィールはキャッシュから、総練習数とストリーク用ログを並列取得
  const profile = await getCachedProfile(user.id);
  const [{ count: totalCount }, { data: recentLogsForStreak }] = await Promise.all([
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
  const isPro = profile?.is_pro ?? false;

  // BJJ歴（月）を計算
  let months = 0;
  if (profile?.start_date) {
    const start = new Date(profile.start_date);
    months = Math.max(
      0,
      Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
  }

  const BELT_LABELS: Record<string, string> = {
    white: t("dashboard.beltWhite"), blue: t("dashboard.beltBlue"), purple: t("dashboard.beltPurple"), brown: t("dashboard.beltBrown"), black: t("dashboard.beltBlack"),
  };
  const beltLabel = BELT_LABELS[belt] ?? t("dashboard.beltWhite");

  // メタデータ用ストリーク計算（簡易版）
  let metaStreak = 0;
  if (recentLogsForStreak && recentLogsForStreak.length > 0) {
    const dates = [...new Set(recentLogsForStreak.map((l: { date: string }) => l.date))].sort((a,b)=>new Date(b).getTime()-new Date(a).getTime());
    const today = getLocalDateString();
    const yesterday = getYesterdayDateString();
    if (dates[0] === today || dates[0] === yesterday) {
      metaStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.round((new Date(dates[i-1] as string).getTime() - new Date(dates[i] as string).getTime()) / 86400000);
        if (diff === 1) metaStreak++; else break;
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "BJJ App Training Record" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未認証はゲスタモードで表示
  if (!user) {
    return <GuestDashboard />;
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // サーバーサイドで統計データを取得（タイムゾーン対応関数を使用）
  const firstDayOfMonth = getMonthStartDate();
  const firstDayOfWeek = getWeekStartDate();

  // 今月の残り日数と予測用の日付データ取得
  const now = new Date();
  const { year, month, day: dayOfMonth, dayOfWeek } = getLocalDateParts();
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDayOfMonth = dayOfMonth;
  const remainingDays = daysInMonth - currentDayOfMonth;
  // 先月の開始日・終了日
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
      .limit(4),
  ]);
  // 今月の合計練習時間（分→時間表示）
  const monthTotalMins = (monthMinData ?? []).reduce(
    (sum: number, r: { duration_min: number }) => sum + (r.duration_min ?? 0), 0
  );
  const monthHoursStr = monthTotalMins >= 60
    ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
    : monthTotalMins > 0 ? `${monthTotalMins}m` : null;
  // 月間トレーニング強度バッジ（平均セッション時間ベース）
  const monthSessionCount = monthCount ?? 0;
  const avgSessionMin = monthSessionCount > 0 ? Math.round(monthTotalMins / monthSessionCount) : 0;
  const intensityBadge: { label: string; emoji: string; color: string } | null =
    monthSessionCount >= 2
      ? avgSessionMin >= 90
        ? { label: t("dashboard.intensityHard"), emoji: "⚡", color: "text-red-400" }
        : avgSessionMin >= 60
        ? { label: t("dashboard.intensityModerate"), emoji: "💪", color: "text-orange-400" }
        : avgSessionMin >= 30
        ? { label: t("dashboard.intensityLight"), emoji: "📈", color: "text-yellow-400" }
        : { label: t("dashboard.intensityGettingStarted"), emoji: "🌱", color: "text-green-400" }
      : null;

  const isPro = profileData?.is_pro ?? false;
  const gymName = profileData?.gym_name ?? null;
  const belt = profileData?.belt ?? "white";
  const stripeCount = profileData?.stripe ?? 0;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  // Show kick banner: gym_kick_notified === false (not null/true) AND gym_id is null
  const showKickBanner = profileData?.gym_kick_notified === false && !profileData?.gym_id;
  // Show gym ranking when user is an opt-in gym member
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;

  // Fetch gym curriculum (only if user is an opt-in member)
  let gymCurriculum: { curriculum_url: string; curriculum_set_at: string } | null = null;
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

  // Onboarding checklist state
  const hasFirstLog = (totalCount ?? 0) > 0;
  const hasGoal = weeklyGoal > 0;
  const hasTechnique = (techniqueCount ?? 0) > 0;
  // 帯在籍月数
  let monthsAtBelt = 0;
  if (profileData?.start_date) {
    const startMs = new Date(profileData.start_date).getTime();
    monthsAtBelt = Math.max(0, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24 * 30)));
  }

  // 連続練習日数を計算
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
        const prev = new Date(dates[i - 1] as string);
        const curr = new Date(dates[i] as string);
        const diffDays = Math.round(
          (prev.getTime() - curr.getTime()) / 86400000
        );
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      {/* ゲストデータの自動マージ（ログイン直後） */}
      <GuestMigration userId={user.id} />

      {/* アチーブメントバッジ（マイルストーン達成時） */}
      <AchievementBadge userId={user.id} totalCount={totalCount ?? 0} />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ── Gym kick notification (persistent until dismissed) ── */}
        {showKickBanner && <GymKickBanner userId={user.id} />}

        {/* ── Onboarding Checklist (new users only, auto-hides when complete) ── */}
        <OnboardingChecklist
          hasFirstLog={hasFirstLog}
          hasGoal={hasGoal}
          hasTechnique={hasTechnique}
        />

        {/* ── Welcome header ── */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shrink-0">
              <span className="text-lg font-black text-zinc-900">柔</span>
            </div>
            <div>
            <TimeGreeting displayName={displayName} />
            <p className="text-gray-500 text-sm mt-0.5">
              {streak >= 30
                ? `🔥 ${streak}-day streak — unstoppable!`
                : streak >= 14
                ? `💪 ${streak}-day streak — excellent pace`
                : streak >= 7
                ? `⚡ ${streak}-day streak — you're on a roll`
                : streak >= 3
                ? `🎯 ${streak}-day streak — great habit`
                : streak >= 1
                ? t("dashboard.streakCardLogToday")
                : t("dashboard.streakCardStartFresh")}
            </p>
          </div>
          </div>
          {intensityBadge && (
            <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 shrink-0 ${intensityBadge.color}`}>
              {intensityBadge.emoji} {intensityBadge.label}
            </span>
          )}
        </div>

        {/* ── Bento Grid Stats — Z-pattern: Streak(top-left hero) → This Week → This Month(wide) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">

          {/* Day Streak — Hero metric (top-left, most important per Z-pattern) */}
          <Link href="/profile" className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-yellow-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out active:scale-95 block group relative">
            <svg className="absolute top-3 right-3 w-4 h-4 text-zinc-700 group-hover:text-yellow-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[11px] font-semibold text-zinc-500 tracking-widest block mb-1">{t("dashboard.streak")}</span>
            <div className="flex items-end gap-1.5 mt-1">
              <span className="text-5xl font-black leading-none tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">{streak}</span>
              <span className="text-zinc-600 text-xs mb-1">{t("dashboard.streakDaysUnit")}</span>
            </div>
            <span className="mt-2 block text-[11px] text-yellow-400">
              {streak >= 30 ? t("dashboard.streakCardUnstoppable") : streak >= 14 ? t("dashboard.streakCardExcellent") : streak >= 7 ? t("dashboard.streakCardOnARoll") : streak >= 3 ? t("dashboard.streakCardKeepGoing") : streak >= 1 ? t("dashboard.streakCardKeepRolling") : t("dashboard.streakCardStart")}
            </span>
          </Link>

          {/* This Week */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-blue-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out">
            <span className="text-[11px] font-semibold text-zinc-500 tracking-widest block mb-1">{t("dashboard.weekTraining")}</span>
            <div className="flex items-end gap-1.5 mt-1">
              <span className="text-5xl font-black leading-none tabular-nums bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">{weekCount ?? 0}</span>
              <span className="text-zinc-600 text-xs mb-1">{t("dashboard.sessionsUnit")}</span>
            </div>
            {weeklyGoal > 0 && (
              <span className="mt-2 block text-[11px] text-blue-400">
                {t("dashboard.bentoGoalLabel", { done: weekCount ?? 0, goal: weeklyGoal })}
              </span>
            )}
          </div>

          {/* This Month — wide card (top-right, second priority) */}
          <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-rose-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out group flex flex-col justify-between">
            {/* Top: label + comparison badge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 tracking-widest">{t("dashboard.monthTraining")}</span>
              {prevMonthCount !== null && prevMonthCount !== undefined && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  (monthCount ?? 0) >= prevMonthCount
                    ? "text-green-400 bg-green-400/10"
                    : "text-red-400 bg-red-400/10"
                }`}>
                  {(monthCount ?? 0) >= prevMonthCount ? "▲" : "▼"}
                  {Math.abs((monthCount ?? 0) - prevMonthCount)} {t("dashboard.bentoVsLastMonth")}
                </span>
              )}
            </div>
            {/* Middle: hero number */}
            <div className="flex items-end gap-2 mt-2">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                {monthCount ?? 0}
              </span>
              <span className="text-zinc-600 text-sm mb-0.5">{t("dashboard.sessionsUnit")}</span>
            </div>
            {/* Bottom: hours + days left — anchored to bottom */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {monthHoursStr && (
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-400 font-medium">
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  </svg>
                  {monthHoursStr}
                </span>
              )}
              {remainingDays > 0 && (
                <span className="text-[11px] text-zinc-500">
                  {t("dashboard.bentoDaysLeft", { n: remainingDays })}
                  {(monthCount ?? 0) > 0 && currentDayOfMonth > 0 && (
                    <span className="text-blue-400 ml-1">
                      {t("dashboard.bentoOnPaceFor", { n: Math.round((monthCount ?? 0) / currentDayOfMonth * daysInMonth) })}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Belt Progress */}
          <BeltProgressCard
            belt={belt}
            stripes={stripeCount}
            monthsAtBelt={monthsAtBelt}
            className="col-span-2"
          />

          {/* Techniques — spans full width on mobile, 2 cols on md */}
          <Link href="/techniques" className="col-span-2 md:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out active:scale-95 group">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1">
                <span className="text-[11px] font-semibold text-zinc-500 tracking-widest block mb-1">{t("dashboard.techniques")}</span>
                <div className="flex items-end gap-1.5">
                  <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">{techniqueCount ?? 0}</span>
                  <span className="text-zinc-600 text-xs mb-0.5">{t("dashboard.loggedUnit")}</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {recentTechniques && recentTechniques.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(recentTechniques as { name: string }[]).map((tech) => (
                  <span key={tech.name} className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                    {tech.name}
                  </span>
                ))}
              </div>
            )}
          </Link>

          {/* Avg Session (md only, fills the remaining col) */}
          {avgSessionMin > 0 && (
            <div className="col-span-2 md:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out">
              <span className="text-[11px] font-semibold text-zinc-500 tracking-widest block mb-1">{t("dashboard.bentoAvgSession")}</span>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black leading-none tabular-nums text-zinc-300">
                  {avgSessionMin}
                </span>
                <span className="text-zinc-600 text-xs mb-0.5">{t("dashboard.bentoMinPerSession")}</span>
              </div>
            </div>
          )}

        </div>

        {/* ── Section 1: Training Log（プライマリアクション・最優先） ── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold text-zinc-600 tracking-widest px-0.5 mb-4">{t("dashboard.sectionLog")}</p>
          <TrainingLog userId={user.id} isPro={isPro} />
        </section>

        {/* ── Section 2: This Week ── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold text-zinc-600 tracking-widest px-0.5 mb-4">{t("dashboard.weekTraining")}</p>
          <div className="space-y-3">
            <WeeklyStrip userId={user.id} />
            {/* GoalTracker: 初回ログ後のみ表示（新規ユーザーノイズ削減） */}
            {hasFirstLog && <GoalTracker userId={user.id} />}
          </div>
        </section>

        {/* ── Section 3: Gym Curriculum (gym members only) ── */}
        {gymCurriculum && (
          <section className="mb-8">
            <p className="text-[11px] font-semibold text-zinc-600 tracking-widest px-0.5 mb-4">{t("dashboard.sectionToday")}</p>
            <GymCurriculumCard
              curriculumUrl={gymCurriculum.curriculum_url}
              curriculumSetAt={gymCurriculum.curriculum_set_at}
              gymName={gymName}
              userId={user.id}
            />
          </section>
        )}

        {/* ── Section 3.5: Gym Leaderboard (opt-in members only) ── */}
        {gymId && shareDataWithGym && (
          <section className="mb-8">
            <p className="text-[11px] font-semibold text-zinc-600 tracking-widest px-0.5 mb-4">{t("dashboard.sectionYourGym")}</p>
            <GymRanking userId={user.id} gymId={gymId} />
          </section>
        )}

        {/* ── Section 4: Streak Nudges + Pro Upsell（毎日目に触れる位置） ── */}
        {(streak >= 3 || !isPro) && (
          <section className="space-y-3 mb-8">
            {/* StreakProtect/Freeze: streak >= 3 から表示（初日ノイズ削減） */}
            {streak >= 3 && <StreakProtect userId={user.id} streak={streak} />}
            {streak >= 3 && <StreakFreeze userId={user.id} streak={streak} />}
            {/* Pro upsell: This Week直下の位置 = 毎日目に触れる（#16） */}
            <ProUpgradeBanner isPro={isPro} />
          </section>
        )}

        {/* ── Section 5: Analytics（デスクトップ: 展開済み / モバイル: 折りたたみ） ── */}
        <CollapsibleSection label={t("dashboard.analyticsLabel")} defaultOpen={false} contentHint={t("dashboard.analyticsHint")}>
          <TrainingBarChart userId={user.id} isPro={isPro} />
          <TrainingTypeChart userId={user.id} />
          <CompetitionStats userId={user.id} />
          <TrainingChart userId={user.id} onLogRoll={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        </CollapsibleSection>

        {/* ── Section 6: Insights & More（最下部・低緊急度） ── */}
        <section className="space-y-3 mb-8">
          <InsightsBanner userId={user.id} />
        </section>
      </main>
      {/* #145: Back to top FAB */}
      <BackToTop />
    </div>
  );
}
