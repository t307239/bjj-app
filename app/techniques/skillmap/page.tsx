import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import { detectServerLocale, makeT } from "@/lib/i18n";
import Link from "next/link";

// perf: @xyflow/react (~300KB) + dagre を遅延読み込み。
// "use client" コンポーネントなので dynamic() のみで遅延読み込み（ssr:false は Server Component で不可）
const SkillMap = dynamic(() => import("@/components/SkillMap"), {
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950">
      <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  ),
});

export const metadata: Metadata = {
  title: "Skill Map — BJJ App",
  description:
    "Visualize your BJJ technique connections as an interactive skill tree. Explore pathways from each position.",
};

export default async function SkillMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/techniques/skillmap");

  const locale = await detectServerLocale();
  const t = makeT(locale);

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .single();

  const isPro = profile?.is_pro ?? false;
  const stripePaymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null;
  const stripeAnnualLink = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK || null;

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      {/* Toolbar: back link + title + Pro badge */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-zinc-900/60 backdrop-blur-sm">
        <Link
          href="/techniques"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors min-h-[36px] px-2 -ml-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("skillMapPage.back")}
        </Link>
        <div className="flex-1" />
        <h1 className="text-sm font-bold text-white tracking-tight">
          {t("skillMapPage.title")}
        </h1>
        <div className="flex-1" />
        {!isPro && (
          <span className="text-xs text-zinc-400 shrink-0">
            {t("techniquesPage.freeLimit")}
          </span>
        )}
        {isPro && (
          <span className="inline-flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full shrink-0">
            ✦ PRO
          </span>
        )}
      </div>

      {/* Full-screen skill map */}
      <div className="flex-1 min-h-0">
        <SkillMap
          userId={user.id}
          isPro={isPro}
          stripePaymentLink={stripePaymentLink}
          stripeAnnualLink={stripeAnnualLink}
        />
      </div>
    </div>
  );
}
