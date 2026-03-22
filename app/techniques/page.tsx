import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TechniqueLog from "@/components/TechniqueLog";
import SkillMap from "@/components/SkillMap";
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

// BJJ Wiki related learning links
const WIKI_LINKS = [
  { href: "https://wiki.bjj-app.net/en/bjj-guard-passing-fundamentals.html", label: "Guard Passing" },
  { href: "https://wiki.bjj-app.net/en/bjj-sweep-fundamentals.html", label: "Sweeps" },
  { href: "https://wiki.bjj-app.net/en/bjj-triangle-choke-guide.html", label: "Triangle Choke" },
  { href: "https://wiki.bjj-app.net/en/bjj-leg-lock-system.html", label: "Leg Locks" },
  { href: "https://wiki.bjj-app.net/en/bjj-mount-system.html", label: "Mount System" },
  { href: "https://wiki.bjj-app.net/en/bjj-back-control-system.html", label: "Back Control" },
];

export default async function TechniquesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/techniques");
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Athlete";

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Fetch Pro status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .single();

  const isPro = profile?.is_pro ?? false;

  const stripePaymentLink =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "";

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Technique Journal</h2>
          <p className="text-gray-400 text-sm mt-1">
            Log techniques, build your skill map, and track mastery
          </p>
        </div>

        {/* Section 1: Skill Map */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🗺️</span>
            <h3 className="text-sm font-semibold text-zinc-100">Skill Map</h3>
            {!isPro && (
              <span className="ml-auto text-xs text-gray-500">
                Free: up to 10 nodes · 15 edges
              </span>
            )}
          </div>
          <SkillMap
            userId={user.id}
            isPro={isPro}
            stripePaymentLink={stripePaymentLink}
          />
        </section>

        {/* Section 2: Technique Log */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📝</span>
            <h3 className="text-sm font-semibold text-zinc-100">Technique Log</h3>
          </div>
          <TechniqueLog userId={user.id} />
        </section>

        {/* BJJ Wiki related learning links */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📚</span>
            <h3 className="text-sm font-semibold text-zinc-100">Learn on BJJ Wiki</h3>
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
            Free technique guides, drills, and video breakdowns on BJJ Wiki
          </p>
        </div>

        <AffiliateSection />
      </main>
    </div>
  );
}
