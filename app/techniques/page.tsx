import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TechniqueLog from "@/components/TechniqueLog";
import AffiliateSection from "@/components/AffiliateSection";

export const metadata: Metadata = {
  title: "Technique Journal | BJJ App",
  description: "Log and organize every BJJ technique you've learned by position. Track mastery levels and identify weak spots.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "BJJ Technique Journal",
  "description": "A personal record of Brazilian Jiu-Jitsu techniques, organized by position and mastery level",
  "url": "https://bjj-app.net/techniques",
  "isPartOf": {
    "@type": "WebApplication",
    "name": "BJJ App",
    "url": "https://bjj-app.net",
  },
};

// BJJ Wikiへの関連リンク（技術学習誘導）
const WIKI_LINKS = [
  { href: "https://wiki.bjj-app.net/ja/bjj-guard-passing-fundamentals.html", label: "ガードパスの基礎" },
  { href: "https://wiki.bjj-app.net/ja/bjj-sweep-fundamentals.html", label: "スウィープの基礎" },
  { href: "https://wiki.bjj-app.net/ja/bjj-triangle-choke-guide.html", label: "トライアングルチョーク" },
  { href: "https://wiki.bjj-app.net/ja/bjj-leg-lock-system.html", label: "レッグロックシステム" },
  { href: "https://wiki.bjj-app.net/ja/bjj-mount-system.html", label: "マウントシステム" },
  { href: "https://wiki.bjj-app.net/ja/bjj-back-control-system.html", label: "バックコントロール" },
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
    <div className="min-h-screen bg-[#0f172a] pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">テクニック帳</h2>
          <p className="text-gray-400 text-sm mt-1">
            習得したテクニックを記録・整理しよう
          </p>
        </div>

        <TechniqueLog userId={user.id} />

        {/* BJJ Wiki 関連学習リンク */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-4 border border-white/10/40">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📚</span>
            <h3 className="text-sm font-semibold text-zinc-100">BJJ Wiki で技術を深める</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {WIKI_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-[#0f172a] hover:bg-zinc-800 text-gray-400 hover:text-[#e94560] px-3 py-1.5 rounded-full border border-white/10 hover:border-[#e94560]/40 transition-all"
              >
                {link.label} →
              </a>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            BJJ Wikiで各テクニックの詳細解説・動画・ドリルを無料で学べます
          </p>
        </div>

        <AffiliateSection />
      </main>
    </div>
  );
}
