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
import TrainingCalendar from "@/components/TrainingCalendar";
import GoalTracker from "@/components/GoalTracker";
import WeeklyStrip from "@/components/WeeklyStrip";
import GuestDashboard from "@/components/GuestDashboard";
import GuestMigration from "@/components/GuestMigration";
import StreakProtect from "@/components/StreakProtect";
import DailyRecommend from "@/components/DailyRecommend";
import StreakFreeze from "@/components/StreakFreeze";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";
import InsightsBanner from "@/components/InsightsBanner";
import DailyWikiTip from "@/components/DailyWikiTip";
import WikiQuickLinks from "@/components/WikiQuickLinks";
import CollapsibleSection from "@/components/CollapsibleSection";
import ProUpgradeBanner from "@/components/ProUpgradeBanner";
import BeltProgressCard from "@/components/BeltProgressCard";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import ProStatusBanner from "@/components/ProStatusBanner";
import GymKickBanner from "@/components/GymKickBanner";
import GymRanking from "@/components/GymRanking";
import { getLocalDateString, getYesterdayDateString } from "@/lib/timezone";

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
    return { title: "Dashboard | BJJ App" };
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
    white: "White Belt", blue: "Blue Belt", purple: "Purple Belt", brown: "Brown Belt", black: "Black Belt",
  };
  const beltLabel = BELT_LABELS[belt] ?? "White Belt";

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
    title: count > 0 ? `Dashboard — ${count} sessions` : "Dashboard | BJJ App",
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
    "Athlete";

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // サーバーサイドで統計データを取得（JST = UTC+9 補正）
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + JST_OFFSET); // JST時刻
  const toJSTStr = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const firstDayOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  // 今月の残り日数と予測
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const currentDayOfMonth = now.getUTCDate();
  const remainingDays = daysInMonth - currentDayOfMonth;
  // 先月の開始日・終了日
  const prevMonthDate = new Date(now);
  prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
  const firstDayOfPrevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  // 今週の月曜日を計算
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstDayOfWeek = toJSTStr(new Date(now.getTime() - daysToMonday * 86400000));
  // 今週の残り日数（日曜=0残り、月=6残り）
  const daysLeftInWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const profileData = await getCachedProfile(user.id);

  const [
    { count: monthCount },
    { count: prevMonthCount },
    { count: weekCount },
    { count: techniqueCount },
    { count: totalCount },
    { data: recentLogs },
    { data: monthMinData },
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
        ? { label: "Hard intensity", emoji: "🔥", color: "text-red-400" }
        : avgSessionMin >= 60
        ? { label: "Moderate intensity", emoji: "💪", color: "text-orange-400" }
        : avgSessionMin >= 30
        ? { label: "Light training", emoji: "📈", color: "text-yellow-400" }
        : { label: "Getting started", emoji: "🌱", color: "text-green-400" }
      : null;

  const isPro = profileData?.is_pro ?? false;
  const gymName = profileData?.gym_name ?? null;
  const belt = profileData?.belt ?? "white";
  const stripeCount = profileData?.stripe ?? 0;
  const weeklyGoal = profileData?.weekly_goal ?? 0;
  const subscriptionStatus = profileData?.subscription_status ?? null;
  // Show kick banner: gym_kick_notified === false (not null/true) AND gym_id is null
  const showKickBanner = profileData?.gym_kick_notified === false && !profileData?.gym_id;
  // Show gym ranking when user is an opt-in gym member
  const gymId = profileData?.gym_id ?? null;
  const shareDataWithGym = profileData?.share_data_with_gym ?? false;

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
    const today = toJSTStr(now);
    const yesterday = toJSTStr(new Date(now.getTime() - 86400000));

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
        {/* ── Pro Status Banner (payment issue alert / PRO badge) ── */}
        <ProStatusBanner isPro={isPro} subscriptionStatus={subscriptionStatus} />

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
            <h2 className="text-xl font-bold tracking-tight">
              Welcome back, {displayName}
            </h2>
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
                ? "Log today's session to keep the streak"
                : "Start fresh — log your first session"}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

          {/* Day Streak — Hero metric (top-left, most important per Z-pattern) */}
          <Link href="/profile" className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-yellow-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out active:scale-95 block">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-1">Streak</span>
            <div className="flex items-end gap-1.5 mt-1">
              <span className="text-5xl font-black leading-none tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">{streak}</span>
              <span className="text-zinc-600 text-xs mb-1">days</span>
            </div>
            <span className="mt-2 block text-[11px] text-yellow-600/80">
              {streak >= 30 ? "🔥 Unstoppable" : streak >= 14 ? "💪 Excellent" : streak >= 7 ? "⚡ On a roll" : streak >= 3 ? "🎯 Keep going" : streak >= 1 ? "🔥 Keep rolling" : "Start your streak"}
            </span>
          </Link>

          {/* This Week */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-blue-400/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-1">This Week</span>
            <div className="flex items-end gap-1.5 mt-1">
              <span className="text-5xl font-black leading-none tabular-nums bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">{weekCount ?? 0}</span>
              <span className="text-zinc-600 text-xs mb-1">sessions</span>
            </div>
            {weeklyGoal > 0 && (
              <span className="mt-2 block text-[11px] text-blue-400/70">
                Goal: {weekCount ?? 0}/{weeklyGoal}
              </span>
            )}
          </div>

          {/* This Month — wide card (top-right, second priority) */}
          <div className="col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-rose-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">This Month</span>
              {prevMonthCount !== null && prevMonthCount !== undefined && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  (monthCount ?? 0) >= prevMonthCount
                    ? "text-green-400 bg-green-400/10"
                    : "text-red-400 bg-red-400/10"
                }`}>
                  {(monthCount ?? 0) >= prevMonthCount ? "▲" : "▼"}
                  {Math.abs((monthCount ?? 0) - prevMonthCount)} vs last
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                {monthCount ?? 0}
              </span>
              <span className="text-zinc-600 text-sm mb-0.5">sessions</span>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {monthHoursStr && (
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-400/80 font-medium">
                  ⏱ {monthHoursStr}
                </span>
              )}
              {remainingDays > 0 && (
                <span className="text-[11px] text-zinc-600">
                  {remainingDays}d left
                  {(monthCount ?? 0) > 0 && currentDayOfMonth > 0 && (
                    <span className="text-blue-400/70 ml-1">
                      · proj.&nbsp;{Math.round((monthCount ?? 0) / currentDayOfMonth * daysInMonth)}
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
          <Link href="/techniques" className="col-span-2 md:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out active:scale-95 flex items-center gap-4 group">
            <div className="flex-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-1">Techniques</span>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black leading-none tabular-nums bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">{techniqueCount ?? 0}</span>
                <span className="text-zinc-600 text-xs mb-0.5">logged</span>
              </div>
            </div>
            <svg className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Avg Session (md only, fills the remaining col) */}
          {avgSessionMin > 0 && (
            <div className="col-span-2 md:col-span-2 bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 ease-out">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-1">Avg Session</span>
              <div className="flex items-end gap-1.5">
                <span className={`text-3xl font-black leading-none tabular-nums ${intensityBadge?.color ?? "text-zinc-300"}`}>
                  {avgSessionMin}
                </span>
                <span className="text-zinc-600 text-xs mb-0.5">min / session</span>
              </div>
              {intensityBadge && (
                <span className={`mt-2 block text-[11px] font-semibold ${intensityBadge.color}`}>
                  {intensityBadge.emoji} {intensityBadge.label}
                </span>
              )}
            </div>
          )}

        </div>

        {/* ── Section 1: Training Log（プライマリアクション・最優先） ── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest px-0.5 mb-3">Log</p>
          <TrainingLog userId={user.id} isPro={isPro} />
        </section>

        {/* ── Section 2: This Week ── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest px-0.5 mb-3">This Week</p>
          <div className="space-y-3">
            {/* 週間ペース通知 */}
            {((): React.ReactNode => {
              const wGoal = weeklyGoal;
              const wCount = weekCount ?? 0;
              if (wGoal <= 0) return null;
              const needed = Math.max(0, wGoal - wCount);
              if (needed === 0) return (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                  <span className="text-lg">🎯</span>
                  <div>
                    <p className="text-green-400 text-sm font-semibold">Weekly goal reached!</p>
                    <p className="text-gray-400 text-xs">Goal: {wGoal} · Done: {wCount}</p>
                  </div>
                </div>
              );
              const onPace = daysLeftInWeek >= needed;
              return (
                <div className={`${onPace ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"} border rounded-2xl px-4 py-2.5 flex items-center gap-3`}>
                  <span className="text-lg">{onPace ? "📅" : "⚡"}</span>
                  <div className="flex-1">
                    <p className={`${onPace ? "text-blue-300" : "text-yellow-300"} text-sm font-semibold`}>
                      {needed} more session{needed !== 1 ? "s" : ""} to hit your weekly goal
                    </p>
                    <p className="text-gray-400 text-xs">
                      {wCount}/{wGoal} done · {daysLeftInWeek}d left
                      {onPace ? " ✓ on pace" : " ⚠ pick up the pace"}
                    </p>
                  </div>
                </div>
              );
            })()}
            <WeeklyStrip userId={user.id} />
            <GoalTracker userId={user.id} />
          </div>
        </section>

        {/* ── Section 3: Today's Learning ── */}
        <section className="mb-8">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest px-0.5 mb-3">Today</p>
          <div className="space-y-3">
            <DailyRecommend userId={user.id} />
            <DailyWikiTip />
            <WikiQuickLinks />
          </div>
        </section>

        {/* ── Section 3.5: Gym Leaderboard (opt-in members only) ── */}
        {gymId && shareDataWithGym && (
          <section className="mb-8">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest px-0.5 mb-3">Your Gym</p>
            <GymRanking userId={user.id} gymId={gymId} />
          </section>
        )}

        {/* ── Section 4: Streak Nudges（最大2つ・条件付き表示） ── */}
        {(streak >= 1 || !isPro) && (
          <section className="space-y-3 mb-8">
            {/* StreakProtect/Freeze は自己管理（内部で表示条件を判断） */}
            <StreakProtect userId={user.id} streak={streak} />
            <StreakFreeze userId={user.id} streak={streak} />
            {/* Pro upsell は streak がない時のみ（競合CTAを避ける） */}
            {streak === 0 && <ProUpgradeBanner isPro={isPro} />}
          </section>
        )}

        {/* ── Section 5: Analytics（デスクトップ: 展開済み / モバイル: 折りたたみ） ── */}
        <CollapsibleSection label="Analytics" defaultOpen={true}>
          <TrainingCalendar userId={user.id} />
          <TrainingBarChart userId={user.id} isPro={isPro} />
          <TrainingTypeChart userId={user.id} />
          <CompetitionStats userId={user.id} />
          <TrainingChart userId={user.id} />
        </CollapsibleSection>

        {/* ── Section 6: Insights & More（最下部・低緊急度） ── */}
        <section className="space-y-3 mb-8">
          <InsightsBanner userId={user.id} />
          {streak > 0 && <ProUpgradeBanner isPro={isPro} />}
        </section>
      </main>
    </div>
  );
}
