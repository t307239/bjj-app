import type { Metadata } from "next";
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
import DailyQuote from "@/components/DailyQuote";
import StreakFreeze from "@/components/StreakFreeze";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app-one.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "ããã·ã¥ãã¼ã | BJJ App" };
  }

  // ãã­ãã£ã¼ã«ã¨ç·ç·´ç¿æ°ãä¸¦ååå¾
  const [{ data: profile }, { count: totalCount }, { data: recentLogsForStreak }] = await Promise.all([
    supabase
      .from("profiles")
      .select("belt, start_date")
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

  // BJJæ­´ï¼æï¼ãè¨ç®
  let months = 0;
  if (profile?.start_date) {
    const start = new Date(profile.start_date);
    months = Math.max(
      0,
      Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
  }

  const BELT_LABELS: Record<string, string> = {
    white: "ç½å¸¯", blue: "éå¸¯", purple: "ç´«å¸¯", brown: "è¶å¸¯", black: "é»å¸¯",
  };
  const beltLabel = BELT_LABELS[belt] ?? "ç½å¸¯";

  // ã¡ã¿ãã¼ã¿ç¨ã¹ããªã¼ã¯è¨ç®ï¼ç°¡æçï¼
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
  const title = `BJJã®è¨é² â ${count}åç·´ç¿éæï¼ | BJJ App`;
  const description = `${beltLabel} Â· ç·${count}åç·´ç¿ Â· BJJæ­´${months}ã¶æ â BJJ Appã§æ¯æ¥ã®ç·´ç¿ãè¨é²ä¸­`;

  return {
    title: "ããã·ã¥ãã¼ã",
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "BJJ App ç·´ç¿è¨é²" }],
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

  // æªèªè¨¼ã¯ã²ã¹ãã¢ã¼ãã§è¡¨ç¤º
  if (!user) {
    return <GuestDashboard />;
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "é¸æ";

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // ãµã¼ãã¼ãµã¤ãã§çµ±è¨ãã¼ã¿ãåå¾ï¼JST = UTC+9 è£æ­£ï¼
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + JST_OFFSET); // JSTæå»
  const toJSTStr = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const firstDayOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  // åæã®éå§æ¥ã»çµäºæ¥
  const prevMonthDate = new Date(now);
  prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
  const firstDayOfPrevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  // ä»é±ã®æææ¥ãè¨ç®
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstDayOfWeek = toJSTStr(new Date(now.getTime() - daysToMonday * 86400000));

  const [
    { count: monthCount },
    { count: prevMonthCount },
    { count: weekCount },
    { count: techniqueCount },
    { count: totalCount },
    { data: recentLogs },
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
  ]);

  // é£ç¶ç·´ç¿æ¥æ°ãè¨ç®
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
    <>
    <InstallBanner />
    <div className="min-h-screen bg-[#1a1a2e] pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      {/* ã²ã¹ããã¼ã¿ã®èªåãã¼ã¸ï¼ã­ã°ã¤ã³ç´å¾ï¼ */}
      <GuestMigration userId={user.id} />

      {/* ã¢ãã¼ãã¡ã³ãããã¸ï¼ãã¤ã«ã¹ãã¼ã³éææï¼ */}
      <AchievementBadge userId={user.id} totalCount={totalCount ?? 0} />

      {/* ã¡ã¤ã³ã³ã³ãã³ã */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">ããããã{displayName} ð</h2>
          <p className="text-gray-400 text-sm mt-1">
            {streak >= 30
              ? `ð¥ ${streak}æ¥é£ç¶ï¼å§åçãªç¶ç¶åã§ãã`
              : streak >= 14
              ? `ðª ${streak}æ¥é£ç¶ï¼ç´ æ´ããããã¼ã¹ã§ãã`
              : streak >= 7
              ? `â¡ ${streak}æ¥é£ç¶ï¼å¢ããåºã¦ãã¾ããï¼`
              : streak >= 3
              ? `ð¯ ${streak}æ¥é£ç¶ï¼è¯ãç¿æ£ãè²ã£ã¦ãã¾ãã`
              : streak >= 1
              ? "ä»æ¥ãç·´ç¿é å¼µããï¼"
              : "ä»æ¥ããæ°ããç·´ç¿ãè¨é²ãããï¼"}
          </p>
        </div>

        {/* ã¯ã¤ãã¯ã¹ã¿ãã */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-2xl font-bold text-[#e94560]">
              {monthCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ä»æã®ç·´ç¿</div>
            {prevMonthCount !== null && prevMonthCount !== undefined && (
              <div className={`text-[10px] mt-0.5 ${
                (monthCount ?? 0) >= prevMonthCount ? "text-green-400" : "text-red-400"
              }`}>
                {(monthCount ?? 0) >= prevMonthCount ? "â²" : "â¼"}
                {Math.abs((monthCount ?? 0) - prevMonthCount)} vs åæ
              </div>
            )}
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-yellow-400/40 transition-colors">
            <div className="text-2xl font-bold text-yellow-400">
              {weekCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ä»é±ã®ç·´ç¿</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/techniques" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-blue-400/40 transition-colors block">
            <div className="text-2xl font-bold text-blue-400">
              {techniqueCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ç¿å¾ãã¯ããã¯</div>
          </Link>
          <Link href="/profile" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-green-400/40 transition-colors block">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-gray-400 text-xs mt-1">é£ç¶ç·´ç¿æ¥</div>
          </Link>
        </div>

        {/* é£ç¶ç·´ç¿ã¹ããªã¼ã¯ä¿è­·ããã¼ */}
        <StreakProtect userId={user.id} streak={streak} />

        {/* ã¹ããªã¼ã¯ããªã¼ãº */}
        <StreakFreeze userId={user.id} streak={streak} />

        {/* ä»æ¥ã®åè¨ */}
        <DailyQuote />

        {/* ä»æ¥ã®ãããã */}
        <DailyRecommend userId={user.id} />

        {/* ä»é±ã®ç·´ç¿ç¶æ³ */}
        <WeeklyStrip userId={user.id} />

        {/* ç®æ¨ãã©ãã«ã¼ */}
        <GoalTracker userId={user.id} />

        {/* ç´¯è¨è¨é² */}
        <PersonalBests userId={user.id} />

        {/* æã«ã¬ã³ãã¼ */}
        <TrainingCalendar userId={user.id} />

        {/* æå¥ç·´ç¿ã°ã©ã */}
        <TrainingBarChart userId={user.id} />

        {/* ç·´ç¿ã¿ã¤ãåå¸ */}
        <TrainingTypeChart userId={user.id} />

        {/* è©¦åæ¦ç¸¾ */}
        <CompetitionStats userId={user.id} />

        {/* ã¢ã¯ãã£ããã£ãã¼ãããã */}
        <TrainingChart userId={user.id} />

        {/* ç·´ç¿è¨é²ã³ã³ã