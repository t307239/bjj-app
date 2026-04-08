import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import ProfileTabs from "@/components/ProfileTabs";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { getLogicalTrainingDate } from "@/lib/logicalDate";
import { formatBjjDuration, calcBjjDuration } from "@/lib/bjjDuration";
import AvatarImage from "@/components/AvatarImage";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Profile" };

  const [{ data: profile }, { count: totalCount }] = await Promise.all([
    supabase.from("profiles").select("belt, stripe").eq("id", user.id).single(),
    supabase
      .from("training_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const belt = profile?.belt ?? "white";
  const count = totalCount ?? 0;
  const ogImage = `${BASE_URL}/api/og?belt=${belt}&count=${count}&months=0&streak=0`;
  const title = `My BJJ Profile — ${count} Sessions | BJJ App`;
  const description = `${belt.charAt(0).toUpperCase() + belt.slice(1)} Belt · ${count} total sessions tracked on BJJ App.`;

  return {
    title: "Profile",
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: "BJJ App Profile" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: "BJJ App Profile",
  description:
    "Manage your Brazilian Jiu-Jitsu training profile, belt rank, and goals",
  url: "https://bjj-app.net/profile",
};

const BELT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  white:  { bg: "bg-zinc-100",   text: "text-zinc-900",  border: "border-zinc-300" },
  blue:   { bg: "bg-blue-600",   text: "text-white",      border: "border-blue-400" },
  purple: { bg: "bg-purple-600", text: "text-white",      border: "border-purple-400" },
  brown:  { bg: "bg-amber-800",  text: "text-white",      border: "border-amber-600" },
  black:  { bg: "bg-zinc-900",   text: "text-white",      border: "border-zinc-600" },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/profile");

  const locale = await detectServerLocale();
  const t = makeT(locale);

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Fetch profile + stats + referral data for hero section
  const [
    { data: profile },
    { count: totalCount },
    { data: recentLogs },
    { count: referralCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("belt, stripe, start_date, is_pro, gym_name, referral_code")
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
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user.id),
  ]);

  const belt = profile?.belt ?? "white";
  const stripeCount = profile?.stripe ?? 0;
  const monthsAtBelt = profile?.start_date ? calcBjjDuration(profile.start_date).totalMonths : 0;
  const isPro = profile?.is_pro ?? false;
  const gymName = profile?.gym_name ?? null;
  const referralCode = (profile as { referral_code?: string | null })?.referral_code ?? null;
  const beltStyle = BELT_COLORS[belt] ?? BELT_COLORS.white;

  // Calculate streak (same algorithm as NavBar — uses logical training date)
  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const uniqueDates = [
      ...new Set(recentLogs.map((l: { date: string }) => l.date)),
    ].sort().reverse() as string[];
    const today = getLogicalTrainingDate();
    let checkDateMs = new Date(today + "T00:00:00Z").getTime();
    for (const dateStr of uniqueDates) {
      const check = new Date(checkDateMs).toISOString().slice(0, 10);
      if (dateStr === check) {
        streak++;
        checkDateMs -= 86400000;
      } else if (dateStr < check) {
        break;
      }
    }
  }

  // BJJ duration — calendar-accurate years+months
  const bjjDurationLabel = profile?.start_date ? formatBjjDuration(profile.start_date, t) : "";

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* ═══════════════════════════════════════════
            PROFILE HERO
            ═══════════════════════════════════════════ */}
        <div className="bg-zinc-900/40 border border-white/8 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-2xl border border-white/15 object-cover flex-shrink-0"
                priority
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/30">
                <span className="text-2xl font-bold text-white select-none">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white truncate">
                  {displayName}
                </h1>
                {isPro && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    ✦ PRO
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mb-3 truncate">
                {user.email}
              </p>
              {gymName && (
                <p className="text-gray-400 text-xs mt-0.5 truncate">
                  🥋 {gymName}
                </p>
              )}

              {/* Belt badge */}
              <div className="flex items-center gap-2 mt-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${beltStyle.bg} ${beltStyle.text} ${beltStyle.border}`}
                >
                  <span className="capitalize">{belt}</span>
                  {stripeCount > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: stripeCount }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 h-3 bg-current opacity-70 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-zinc-800/80">
            <div className="text-center">
              <p className="text-2xl font-black text-white tabular-nums">
                {totalCount ?? 0}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 tracking-widest uppercase">
                {t("dashboard.sessionsUnit")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                {streak}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 tracking-widest uppercase">
                {t("dashboard.streak")}
              </p>
            </div>
            {bjjDurationLabel && (
              <div className="text-center">
                <p className="text-lg font-black text-white leading-tight">
                  {bjjDurationLabel}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5 tracking-widest uppercase">
                  BJJ
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            PROFILE TABS (stats / settings / account)
            ═══════════════════════════════════════════ */}
        <Suspense fallback={<div className="h-96 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />}>
          <ProfileTabs userId={user.id} isPro={isPro} referralCode={referralCode} referralCount={referralCount ?? 0} totalCount={totalCount ?? 0} belt={belt} stripeCount={stripeCount} monthsAtBelt={monthsAtBelt} />
        </Suspense>
      </main>
    </div>
  );
}
