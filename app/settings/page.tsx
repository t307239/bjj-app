import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import { detectServerLocale, makeT } from "@/lib/i18n";

const SettingsSection = dynamic(() => import("@/components/profile/SettingsSection"), {
  loading: () => <div className="h-36 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});

export const metadata: Metadata = {
  title: "Settings | BJJ App",
  description: "Manage your BJJ App preferences, notifications, theme, and data settings.",
  alternates: {
    canonical: "https://bjj-app.net/settings",
  },
  openGraph: {
    type: "website",
    url: "https://bjj-app.net/settings",
    siteName: "BJJ App",
    title: "Settings | BJJ App",
    description: "Manage your BJJ App preferences, notifications, theme, and data settings.",
  },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/settings");

  const locale = await detectServerLocale();
  const t = makeT(locale);

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const [{ data: profile }, { count: referralCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_pro, referral_code")
      .eq("id", user.id)
      .single(),
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user.id),
  ]);

  const isPro = profile?.is_pro ?? false;
  const referralCode = (profile as { referral_code?: string | null })?.referral_code ?? null;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />

      <main className="max-w-4xl mx-auto px-4 py-5">
        {/* Back to profile link */}
        <a
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("profile.tabs.profile")}
        </a>

        <h1 className="text-2xl font-black text-white tracking-tight mb-5">
          {t("profile.tabs.settings")}
        </h1>

        <SettingsSection
          userId={user.id}
          isPro={isPro}
          referralCode={referralCode}
          referralCount={referralCount ?? 0}
        />
      </main>
    </div>
  );
}
