import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import TechniqueLog from "@/components/TechniqueLog";
import { Suspense } from "react";
import SkillMap from "@/components/SkillMap";
import AffiliateSection from "@/components/AffiliateSection";
import TechniquesPageHeader, { SkillMapSectionHeader, TechniqueLogSectionHeader, WikiLinksHeader, WikiLinksFootnote } from "@/components/TechniquesPageHeader";

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
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <TechniquesPageHeader isPro={isPro} />

        {/* Section 1: Skill Map */}
        <section className="mb-8">
          <SkillMapSectionHeader isPro={isPro} />
          <SkillMap
            userId={user.id}
            isPro={isPro}
            stripePaymentLink={stripePaymentLink}
          />
        </section>

        {/* Section 2: Technique Log */}
        <section className="mb-8">
          <TechniqueLogSectionHeader />
          <Suspense>
            <TechniqueLog userId={user.id} />
          </Suspense>
        </section>

        {/* BJJ Wiki related learning links */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-4 border border-white/10">
          <WikiLinksHeader />
          <div className="flex flex-wrap gap-2">
            {WIKI_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-zinc-950 hover:bg-zinc-800 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 transition-all"
              >
                {link.label} →
              </a>
            ))}
          </div>
          <WikiLinksFootnote />
        </div>

        <AffiliateSection />
      </main>
    </div>
  );
}
