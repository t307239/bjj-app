import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import TrainingLog from "@/components/TrainingLog";
import TrainingChart from "@/components/TrainingChart";
import TrainingCalendar from "@/components/TrainingCalendar";
import GoalTracker from "@/components/GoalTracker";

export const metadata: Metadata = {
  title: "ãƒ€ãƒƒã‚·ãƒ¥ãƒœãƒ¼ãƒ‰",
};

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
    "é¸æ‰‹";

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // ã‚µãƒ¼ãƒãƒ¼ã‚µã‚¤ãƒ‰ã§çµ±è¨ˆãƒ‡ãƒ¼ã‚¿ã‚’å–å¾—
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  // ä»Šé€±ã®æœˆæ›œæ—¥ã‚’è¨ˆç®—
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstDayOfWeek = new Date(now.getTime() - daysToMonday * 86400000)
    .toISOString()
    .split("T")[0];

  const [
    { count: monthCount },
    { count: weekCount },
    { count: techniqueCount },
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
      .gte("date", firstDayOfWeek),
    supabase
      .from("techniques")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("training_logs")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(60),
  ]);

  // é€£ç¶šç·´ç¿’æ—¥æ•°ã‚’è¨ˆç®—
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

      {/* ãƒ¡ã‚¤ãƒ³ã‚³ãƒ³ãƒ†ãƒ³ãƒ„ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">ãŠã‹ãˆã‚ŠŒ {displayName} ðŸ‹‹</h2>
          <p className="text-gray-400 text-sm mt-1">
            {streak >= 30
              ? `ðŸ”¥ ${streak}æ—¥é€£ç¶šï¼åœ§å€’çšÚkŽŸŽgŽ	€(€€€€€€€€€€€€€€èÍÑÉ•…¬€øô€ÄÐ(€€€€€€€€€€€€€€üƒÂ~J¨€‘íÍÑÉ•…­÷š^—¦žÚk¾òžÒƒšfÓ–B_Ž_ŽŽkŽóŽ
çŽŸŽgŽ	€(€€€€€€€€€€€€€€èÍÑÉ•…¬€øô€Ü(€€€€€€€€€€€€€€üƒŠj„€‘íÍÑÉ•…­÷š^—¦žÚk¾òš.‹ŽŽ3–ëŽ›Ž7ŽûŽ_ŽŸ¾ò€(€€€€€€€€€€€€€€èÍÑÉ•…¬€øô€Ì(€€€€€€€€€€€€€€üƒÂ~:¼€‘íÍÑÉ•…­÷š^—¦žÚk¾òŠ+¢þ‹Ž’ú[šVŸŽ3¢
·ŽŽ›ŽŽûŽgŽ	€(€€€€€€€€€€€€€€èÍÑÉ•…¬€øô€Ä(€€€€€€€€€€€€€€ü€‹’î+š^—Ž
žÞÓžþK¦‚ã–
ïžRkŽ_Ž
#Ž¾òˆ(€€€€€€€€€€€€€€è€‹’î+š^—Ž/Ž
'šZÃŽ_ŽžÞÓžþKŽ
K¢¢c¦2ËŽ_Ž
#Ž¾ò‰ô(€€€€€€€€€€ð½Àø(€€€€€€€€ð½‘¥Øø((€€€€€€€ì¼¨ƒŽ
¿Ž
“ŽŽ
ÿŽ
å28+R8+”¸à­I£‚µc‚±c‚¿ */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-[#e94560]/40 transition-colors">
            <div className="text-2xl font-bold text-[#e94560]">
              {monthCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ä»Šæœˆã®ç·´ç¿’</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-yellow-400/40 transition-colors">
            <div className="text-2xl font-bold text-yellow-400">
              {weekCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ä»Šé€±ã®ç·´ç¿’</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/techniques" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-blue-400/40 transition-colors block">
            <div className="text-2xl font-bold text-blue-400">
              {techniqueCount ?? 0}
            </div>
            <div className="text-gray-400 text-xs mt-1">ç¿’å¾—ãƒ†ã‚¯ãƒ‹ãƒƒã‚¯</div>
          </Link>
          <Link href="/profile" className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700 hover:border-green-400/40 transition-colors block">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-gray-400 text-xs mt-1">é€£ç¶šç·´ç¿’æ–¥</div>
          </Link>
        </div>

        {/* ç›®æ¨™ãƒˆãƒ©ãƒƒã‚­ãƒ³ã‚° */}
        <GoalTracker userId={user.id} />

        {/* æœˆã‚«ãƒ¬ãƒ³ãƒ€ãƒ¼ */}
        <TrainingCalendar userId={user.id} />

        {/* ã‚¢ã‚¯ãƒ†ã‚£ãƒ“ãƒ†ã‚£ãƒ’ãƒ»ãƒˆãƒžãƒƒãƒ— */}
        <TrainingChart userId={user.id} />

        {/* ç·´ç¿’è¨˜éŒ²ã‚³ãƒ³ãƒãƒ¼ãƒcƒ³ãƒˆ */}
        <TrainingLog userId={user.id} />
      </main>
    </div>
  );
}
