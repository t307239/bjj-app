import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-6 text-6xl">🥋</div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          BJJ App
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Brazilian Jiu-Jitsu のトレーニングを記録・管理・成長させよう
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
          <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold mb-1">練習記録</h3>
            <p className="text-gray-400 text-sm">スパーリング・テクニック・出席率を追跡</p>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">📚</div>
            <h3 className="font-semibold mb-1">テクニック帳</h3>
            <p className="text-gray-400 text-sm">習得したテクニックをカテゴリ別に整理</p>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">🏆</div>
            <h3 className="font-semibold mb-1">目標設定</h3>
            <p className="text-gray-400 text-sm">帯昇格・大会・技術目標を管理</p>
          </div>
        </div>

        <Link
          href="/login"
          className="inline-block bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-3 px-8 rounded-full text-lg transition-colors"
        >
          無料で始める
        </Link>

        <p className="text-gray-500 text-sm mt-4">
          Google / GitHub アカウントでログイン
        </p>
      </div>
    </main>
  );
}
