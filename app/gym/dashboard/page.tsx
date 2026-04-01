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

  // Fetch gym + profile in parallel
  const [{ data: gym }, { data: profileData }] = await Promise.all([
    supabase
      .from("gyms")
      .select("id, name, invite_code, is_active, curriculum_url, curriculum_set_at")
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single(),
  ]);
  const isPro = profileData?.is_pro ?? false;

  // 道場長でないユーザー（gym が存在しない）はアクセス不可 → /dashboard にリダイレクト
  // これにより Free/Pro/道場メンバーが /gym/dashboard に直打ちしても弾かれる（IDOR防止）
  if (!gym) redirect("/dashboard");

  // Member count + aggregate gym stats (opt-in only)
  let memberCount = 0;
  let totalSessions30d = 0;
  let avgSessionsPerMember = 0;
  if (gym?.id) {
    // Get member IDs (opt-in) + count
    const { data: members, count } = await supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("gym_id", gym.id)
      .eq("share_data_with_gym", true);
    memberCount = count ?? 0;

    // Aggregate training sessions in last 30 days for these members
    if (members && members.length > 0) {
      const memberIds = members.map((m: { id: string }) => m.id);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const { count: sessCount } = await supabase
        .from("training_logs")
        .select("*", { count: "exact", head: true })
        .in("user_id", memberIds)
        .gte("date", thirtyDaysAgo);
      totalSessions30d = sessCount ?? 0;
      avgSessionsPerMember = memberCount > 0 ? Math.round((totalSessions30d / memberCount) * 10) / 10 : 0;
    }
  }

  const stripeGymPaymentLink =
    process.env.NEXT_PUBLIC_STRIPE_GYM_PAYMENT_LINK || null;

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />
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
                    <span className="text-xs font-semibold text-blue-400 tracking-widest uppercase">
                      {t("gym.dashboardTitle")}
                    </span>
                    {gym.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-300 bg-blue-500/15 border border-blue-400/25 px-2 py-0.5 rounded-full">
                        ✦ PRO
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-semibold text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 px-2 py-0.5 rounded-full">
                        FREE
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-black text-white truncate">
                    {gym.name}
                  </h1>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {t("gym.dashboardSubtitle")}
                  </p>
                </div>
                {/* Member count */}
                <div className="text-center shrink-0 bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-2">
                  <p className="text-2xl font-black text-white tabular-nums">
                    {memberCount}
                  </p>
                  <p className="text-xs text-zinc-400 uppercase tracking-widest">
                    {t("gym.membersLabel")}
                  </p>
                </div>
              </div>

              {/* Gym aggregate stats strip */}
              {memberCount > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-blue-300 tabular-nums">
                      {totalSessions30d}
                    </p>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">
                      {t("gym.totalSessions30d")}
                    </p>
                  </div>
                  <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-blue-300 tabular-nums">
                      {avgSessionsPerMember}
                    </p>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">
                      {t("gym.avgSessions30d")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* New gym onboarding header */
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {t("gym.dashboardTitle")}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
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
