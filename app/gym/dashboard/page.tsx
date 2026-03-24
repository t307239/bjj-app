import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { serverT as t } from "@/lib/i18n";
import GymDashboard from "@/components/GymDashboard";
import GymRegistrationForm from "@/components/GymRegistrationForm";

export const metadata: Metadata = {
  title: "Gym Dashboard",
  description: "Manage your BJJ gym — track member activity and reduce churn.",
};

export default async function GymDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/gym/dashboard");

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("dashboard.defaultCoachName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Fetch gym
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, invite_code, is_active, curriculum_url, curriculum_set_at")
    .eq("owner_id", user.id)
    .single();

  // Member count (opt-in only)
  let memberCount = 0;
  if (gym?.id) {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .eq("share_data_with_gym", true);
    memberCount = count ?? 0;
  }

  const stripeGymPaymentLink =
    process.env.NEXT_PUBLIC_STRIPE_GYM_PAYMENT_LINK ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* ═══════════════════════════════════════════
            GYM DASHBOARD HEADER
            ═══════════════════════════════════════════ */}
        {gym ? (
          <div className="mb-6">
            {/* Gym identity card */}
            <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-blue-400 tracking-widest uppercase">
                      {t("gym.dashboardTitle")}
                    </span>
                    {gym.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/15 border border-blue-400/25 px-2 py-0.5 rounded-full">
                        ✦ PRO
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 px-2 py-0.5 rounded-full">
                        FREE
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-black text-white truncate">
                    {gym.name}
                  </h1>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {t("gym.dashboardSubtitle")}
                  </p>
                </div>
                {/* Member count */}
                <div className="text-center shrink-0 bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-2">
                  <p className="text-2xl font-black text-white tabular-nums">
                    {memberCount}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                    members
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* New gym onboarding header */
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {t("gym.dashboardTitle")}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t("gym.dashboardSubtitle")}
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            MAIN CONTENT
            ═══════════════════════════════════════════ */}
        {gym ? (
          <GymDashboard
            userId={user.id}
            gym={gym}
            isGymPro={gym.is_active}
            stripeGymPaymentLink={stripeGymPaymentLink}
          />
        ) : (
          <GymRegistrationForm userId={user.id} />
        )}
      </main>
    </div>
  );
}
