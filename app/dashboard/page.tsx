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
import PersonalBests from "@/components/PersonalBests";
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
import ProUpgradeBanner from "@/components/ProUpgradeBanner";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app-one.vercel.app";

// React.cache で プロフィール二重クエリを最適化
const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("belt, start_date, is_pro, gym_name")
    .eq("id", userId)
    .single();
  return data as { belt: string; start_date: string | null; is_pro: boolean; gym_name: string | null } | null;
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
    const jstNow = new Date(Date.now() + 9 * 3600000);
    const toStr = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    const dates = [...new Set(recentLogsForStreak.map((l: { date: string }) => l.date))].sort((a,b)=>new Date(b).getTime()-new Date(a).getTime());
    const today = toStr(jstNow);
    const yesterday = toStr(new Date(jstNow.getTime() - 86400000));
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
    <div className="min-h-screen bg-[#1a1a2e] pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      {/* ゲストデータの自動マージ（ログイン直後） */}
      <GuestMigration userId={user.id} />

      {/* アチーブメントバッジ（マイルストーン達成時） */}
      <AchievementBadge userId={user.id} totalCount={totalCount ?? 0} />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Welcome back, {displayName} 👋</h2>
          <p className="text-gray-400 text-sm mt-1">
            {streak >= 30
              ? `🔥 ${streak}-day streak — unstoppable consistency!`
              : streak >= 14
              ? `💪 ${streak}-day streak — excellent pace!`
              : streak >= 7
              ? `⚡ ${streak}-day streak — you're on a roll!`
              : streak >= 3
              ? `🎯 ${streak}-day streak — great habit forming!`
              : streak >= 1
              ? "Keep it up — log today's session!"
              : "Start fresh — log your first session today!"}
          </p>
        </div>

        {/* クイックスタッツ */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-2xl font-bold text-[#e94560]">
              {monthCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">This Month</div>
            {prevMonthCount !== null && prevMonthCount !== undefined && (
              <div className={`text-[10px] mt-0.5 ${
                (monthCount ?? 0) >= prevMonthCount ? "text-green-400" : "text-red-400"
              }`}>
                {(monthCount ?? 0) >= prevMonthCount ? "▲" : "▼"}
                {Math.abs((monthCount ?? 0) - prevMonthCount)} vs last mo.
              </div>
            )}
            {monthHoursStr && (
              <div className="text-[10px] mt-0.5 text-purple-400/80 font-medium">
                ⏱️ {monthHoursStr}
              </div>
            )}
            {intensityBadge && (
              <div className={`text-[10px] mt-0.5 font-medium ${intensityBadge.color}`}>
                {intensityBadge.emoji} {intensityBadge.label} (avg {avgSessionMin}min)
              </div>
            )}
            {remainingDays > 0 && (
              <div className="text-[10px] mt-0.5 text-gray-500">
                {remainingDays}d left
                {(monthCount ?? 0) > 0 && currentDayOfMonth > 0 && (
                  <span className="text-blue-400/80">
                    {" · "}proj. {Math.round((monthCount ?? 0) / currentDayOfMonth * daysInMonth)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-yellow-400/40 transition-colors">
            <div className="text-2xl font-bold text-yellow-400">
              {weekCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">This Week</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/techniques" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-blue-400/40 transition-colors block">
            <div className="text-2xl font-bold text-blue-400">
              {techniqueCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">Techniques</div>
          </Link>
          <Link href="/profile" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-green-400/40 transition-colors block">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-gray-400 text-xs mt-1">Day Streak</div>
          </Link>
        </div>

        {/* Proアップグレードバナー（非Proユーザー向け） */}
        <ProUpgradeBanner isPro={isPro} />

        {/* ジム名未設定の場合にB2Bプロンプトバナーを表示 */}
        {!gymName && (
          <Link
            href="/profile"
            className="flex items-center gap-3 bg-[#16213e]/80 border border-blue-500/20 hover:border-blue-500/50 rounded-xl px-4 py-3 mb-3 transition-colors group"
          >
            <span className="text-xl">🏫</span>
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-sm font-semibold group-hover:text-blue-200">
                Add your gym or academy name
              </p>
              <p className="text-gray-500 text-xs truncate">
                Add your gym to your profile to unlock B2B features →
              </p>
            </div>
            <span className="text-gray-600 group-hover:text-gray-400 text-sm">›</span>
          </Link>
        )}

        {/* 練習インサイト */}
        <InsightsBanner userId={user.id} />

        {/* 連続練習ストリーク保護バナー */}
        <StreakProtect userId={user.id} streak={streak} />

        {/* ストリークフリーズ */}
        <StreakFreeze userId={user.id} streak={streak} />

        {/* 今日のおすすめ */}
        <DailyRecommend userId={user.id} />

        {/* 今日のBJJ Wiki知識 */}
        <DailyWikiTip />

        {/* BJJ Wiki クイックリンク（日替わり技術3選） */}
        <WikiQuickLinks />

        {/* 今週の目標達成ペース通知 */}
        {(() => {
          const wGoal = (profileData as { weekly_goal?: number } | null)?.weekly_goal ?? 0;
          const wCount = weekCount ?? 0;
          if (wGoal <= 0) return null;
          const needed = Math.max(0, wGoal - wCount);
          if (needed === 0) return (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-green-400 text-sm font-semibold">Weekly goal reached!</p>
                <p className="text-gray-400 text-xs">Goal: {wGoal} · Done: {wCount}</p>
              </div>
            </div>
          );
          const onPace = daysLeftInWeek >= needed;
          return (
            <div className={`${onPace ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"} border rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3`}>
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

        {/* 今週の練習状況 */}
        <WeeklyStrip userId={user.id} />

        {/* 目標トラッカー */}
        <GoalTracker userId={user.id} />

        {/* 累計記録 */}
        <PersonalBests userId={user.id} />

        {/* 月カレンダー */}
        <TrainingCalendar userId={user.id} />

        {/* 月別練習グラフ */}
        <TrainingBarChart userId={user.id} isPro={isPro} />

        {/* 練習タイプ分布 */}
        <TrainingTypeChart userId={user.id} />

        {/* 試合戦績 */}
        <CompetitionStats userId={user.id} />

        {/* アクティビティヒートマップ */}
        <TrainingChart userId={user.id} />

        {/* 練習記録コンポーネント（CsvExport内蔵） */}
        <TrainingLog userId={user.id} isPro={isPro} />
      </main>
    </div>
  );
}
