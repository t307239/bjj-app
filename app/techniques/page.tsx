import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TechniqueLog from "@/components/TechniqueLog";

export const metadata: Metadata = {
  title: "テクニック帳",
};

// アフィリエイトリンク設定
// ※ AFF_CODE を実際の BJJ Fanatics アフィリエイトコードに変更してください
// アフィリエイト申し込み: https://bjjfanatics.com/pages/affiliates
const AFF_CODE = "bjjapp";
const AFF_BASE = "https://bjjfanatics.com";

const INSTRUCTIONALS = [
  {
    title: "ガードリテンション",
    instructor: "Bernardo Faria",
    description: "ガード保持の基礎から上級テクニックまで。ガードを切られてもすぐ戻せるようになる。",
    url: `${AFF_BASE}/collections/guard?aff=${AFF_CODE}`,
    badge: "人気",
  },
  {
    title: "レッグロックシステム",
    instructor: "John Danaher",
    description: "腳関節技の体系的な学習。ヒールフック・ニーバー・アンクルロックを網羅。",
    url: `${AFF_BASE}/collections/leg-locks?aff=${AFF_CODE}`,
    badge: "上級",
  },
  {
    title: "バックコントロール",
    instructor: "Marcelo Garcia",
    description: "バックのキープからRNCまで。世界最高峰のバック攻撃を習得。",
    url: `${AFF_BASE}/collections/back-attacks?aff=${AFF_CODE}`,
  },
];

export default async function TechniquesPage() {
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
    <div className="min-h-screen bg-[#1a1a2e] pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">テクニック帳</h2>
          <p className="text-gray-400 text-sm mt-1">
            習得したテクニックを記録・整理しよう
          </p>
        </div>

        <TechniqueLog userId={user.id} />

        {/* アフィリエイトセクション */}
        <div className="mt-8 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-gray-400">📼 テクニックを深める</h3>
            <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">PR</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {INSTRUCTIONALS.map((item) => (
              <a
                key={item.title}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group flex items-center gap-3 bg-[#16213e] hover:bg-[#1a2a4a] rounded-xl p-3 border border-gray-700 hover:border-[#e94560]/40 transition-all"
              >
                <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-[#e94560]/20 to-purple-900/30 rounded-lg flex items-center justify-center text-2xl border border-gray-700">
                  🎦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-200 truncate">{item.title}</span>
                    {item.badge && (
                      <span className="text-[9px] bg-[#e94560]/20 text-[#e94560] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#e94560] mb-1">{item.instructor}</div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.description}</p>
                </div>
                <div className="flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors text-sm">→</div>
              </a>
            ))}
          </div>

          <p className="text-[10px] text-gray-700 text-center mt-3">
            ※ リンクはアフィリエイトリンクです。購入の際はBJJ Fanatics サイトに移動します。
          </p>
        </div>
      </main>
    </div>
  );
}
