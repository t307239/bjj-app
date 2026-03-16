import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
import TrainingChart from "@/components/TrainingChart";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "選手";

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // サーバーサイドで統計データを取得
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [{ count: monthCount }, { count: totalCount }, { data: recentLogs }] =
    await Promise.all([
      supabase
        .from("training_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("date", firstDayOfMonth),
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

  // 連続練習日数を計算
  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const dates = [
      ...new Set(recentLogs.map((l: { date: string }) => l.date)),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000)
      .toISOString()
      .split("T")[0];

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
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />

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
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-2xl font-bold text-[#e94560]">
              {monthCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">今月の練習</div>
          </div>
          <Link href="/techniques" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-blue-400/40 transition-colors block">
            <div className="text-2xl font-bold text-blue-400">
              {totalCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">総練習数</div>
          </Link>
          <Link href="/profile" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-green-400/40 transition-colors block">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-gray-400 text-xs mt-1">連続練習日</div>
          </Link>
        </div>

        {/* アクティビティチャート */}
        <TrainingChart userId={user.id} />

        {/* 練習記録コンポーネント */}
        <TrainingLog userId={user.id} />
      </main>
    </div>
  );
}
