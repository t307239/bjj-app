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
import StreakFreeze from "@/components/StreakFreeze";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";
import InsightsBanner from "@/components/InsightsBanner";
import DailyWikiTip from "@/components/DailyWikiTip";
import WikiQuickLinks from "@/components/WikiQuickLinks";
import ProUpgradeBanner from "@/components/ProUpgradeBanner";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app-one.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "ダッシュボード | BJJ App" };
  }

  // プロフィールと総練習数を並列取得
  const [{ data: profile }, { count: totalCount }, { data: recentLogsForStreak }] = await Promise.all([
    supabase
      .from("profiles")
      .select("belt, start_date, is_pro")
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
    white: "白帯", blue: "青帯", purple: "紫帯", brown: "茶帯", black: "黒帯",
  };
  const beltLabel = BELT_LABELS[belt] ?? "白帯";

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
  const title = `BJJの記録 — ${count}回練習達成！ | BJJ App`;
  const description = `${beltLabel} · 総${count}回練習 · BJJ歴${months}ヶ月 — BJJ Appで毎日の練習を記録中`;

  return {
    title: "ダッシュボード",
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "BJJ App 練習記録" }],
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
    "選手";

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

  const [
    { count: monthCount },
    { count: prevMonthCount },
    { count: weekCount },
    { count: techniqueCount },
    { count: totalCount },
    { data: recentLogs },
    { data: profileData },
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
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single(),
  ]);

  const isPro = (profileData as { is_pro?: boolean } | null)?.is_pro ?? false;

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
          <h2 className="text-2xl font-bold">おかえり、{displayName} 👋</h2>
          <p className="text-gray-400 text-sm mt-1">
            {streak >= 30
              ? `🔥 ${streak}日連続！圧倒的な継続力です。`
              : streak >= 14
              ? `💪 ${streak}日連続！素晴らしいペースです。`
              : streak >= 7
              ? `⚡ ${streak}日連続！勢いが出てきました！`
              : streak >= 3
              ? `🎯 ${streak}日連続！良い習慣が育っています。`
              : streak >= 1
              ? "今日も練習頑張ろう！"
              : "今日から新しい練習を記録しよう！"}
          </p>
        </div>

        {/* クイックスタッツ */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-2xl font-bold text-[#e94560]">
              {monthCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">今月の練習</div>
            {prevMonthCount !== null && prevMonthCount !== undefined && (
              <div className={`text-[10px] mt-0.5 ${
                (monthCount ?? 0) >= prevMonthCount ? "text-green-400" : "text-red-400"
              }`}>
                {(monthCount ?? 0) >= prevMonthCount ? "▲" : "▼"}
                {Math.abs((monthCount ?? 0) - prevMonthCount)} vs 先月
              </div>
            )}
            {remainingDays > 0 && (
              <div className="text-[10px] mt-0.5 text-gray-500">
                あと{remainingDays}日
                {(monthCount ?? 0) > 0 && currentDayOfMonth > 0 && (
                  <span className="text-blue-400/80">
                    {" · "}予測{Math.round((monthCount ?? 0) / currentDayOfMonth * daysInMonth)}回
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-yellow-400/40 transition-colors">
            <div className="text-2xl font-bold text-yellow-400">
              {weekCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">今週の練習</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/techniques" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-blue-400/40 transition-colors block">
            <div className="text-2xl font-bold text-blue-400">
              {techniqueCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">習得テクニック</div>
          </Link>
          <Link href="/profile" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-green-400/40 transition-colors block">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-gray-400 text-xs mt-1">連続練習日</div>
          </Link>
        </div>

        {/* Proアップグレードバナー（非Proユーザー向け） */}
        <ProUpgradeBanner isPro={isPro} />

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

        {/* 今週の練習状況 */}
        <WeeklyStrip userId={user.id} />

        {/* 目標トラッカー */}
        <GoalTracker userId={user.id} />

        {/* 累計記録 */}
        <PersonalBests userId={user.id} />

        {/* 月カレンダー */}
        <TrainingCalendar userId={user.id} />

        {/* 月別練習グラフ */}
        <TrainingBarChart userId={user.id} />

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
