import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import TrainingLog from "@/components/TrainingLog";

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

  return (
    <div className="min-h-screen bg-[#1a1a2e]">
      {/* ヘッダー */}
      <header className="bg-[#16213e] border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <span className="font-bold text-lg">BJJ App</span>
          </div>
          <div className="flex items-center gap-3">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-gray-300 text-sm hidden sm:block">
              {displayName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            おかえり、{displayName} 👋
          </h2>
          <p className="text-gray-400 text-sm mt-1">今日も練習頑張ろう！</p>
        </div>

        {/* クイックスタッツ */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-bold text-[#e94560]">0</div>
            <div className="text-gray-400 text-xs mt-1">今月の練習</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">0</div>
            <div className="text-gray-400 text-xs mt-1">テクニック数</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-bold text-green-400">0</div>
            <div className="text-gray-400 text-xs mt-1">連続練習日</div>
          </div>
        </div>

        {/* 練習記録コンポーネント */}
        <TrainingLog userId={user.id} />
      </main>
    </div>
  );
}
