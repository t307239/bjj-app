import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import GymDashboard from "@/components/GymDashboard";
import GymRegistrationForm from "@/components/GymRegistrationForm";

export const metadata: Metadata = {
  title: "Gym Dashboard",
  description: "Manage your BJJ gym — track member activity and reduce churn.",
  alternates: {
    canonical: "https://bjj-app.net/gym/dashboard",
  },
};

export default async function GymDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const params = await searchParams;
  const justUpgraded = params.upgraded === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/gym/dashboard");

  const locale = await detectServerLocale();
  const t = makeT(locale);

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
  // gym が null の場合 → GymRegistrationForm を表示（新規登録フロー）
  // gym が存在 → GymDashboard を表示（既存道場長）
  // ※ redirect を削除: gym未登録ユーザーが登録フォームに辿り着けるよう変更 (T-34)

  // Member count + aggregate gym stats (opt-in only)
  let memberCount = 0;
  let totalSessions30d = 0;
  let avgSessionsPerMember = 0;
  let inactiveMemberCount = 0;
  if (gym?.id) {
    // Get member IDs (opt-in) + count — then session aggregate (data-dependent)
    const { data: members, count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("gym_id", gym.id)
      .eq("share_data_with_gym", true);
    if (error) logger.error("gym.dashboard_member_query_error", { gymId: gym.id }, error as Error);
    memberCount = count ?? 0;

    if (members && members.length > 0) {
      const memberIds = members.map((m: { id: string }) => m.id);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { count: sessCount } = await supabase
        .from("training_logs")
        .select("*", { count: "exact", head: true })
        .in("user_id", memberIds)
        .gte("date", thirtyDaysAgo);
      totalSessions30d = sessCount ?? 0;
      avgSessionsPerMember = memberCount > 0 ? Math.round((totalSessions30d / memberCount) * 10) / 10 : 0;

      // §14 B2B: Detect inactive members (no training in 7+ days)
      const { data: activeRecent, error: activeErr } = await supabase
        .from("training_logs")
        .select("user_id")
        .in("user_id", memberIds)
        .gte("date", sevenDaysAgo);
      if (activeErr) logger.error("gym.dashboard_active_query_error", { gymId: gym.id }, activeErr as Error);
      const activeUserIds = new Set((activeRecent ?? []).map((r: { user_id: string }) => r.user_id));
      inactiveMemberCount = memberIds.filter((id: string) => !activeUserIds.has(id)).length;
    }
  }

  const stripeGymPaymentLink =
    process.env.NEXT_PUBLIC_STRIPE_GYM_PAYMENT_LINK || null;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />
      {justUpgraded && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/15 border-b border-green-500/30 px-4 py-3 text-center">
          <p className="text-green-300 text-sm font-semibold">
            🎉 {t("gym.upgradeSuccess")}
          </p>
        </div>
      )}
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
                  <p className="text-zinc-400 text-xs mt-0.5">
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
                <div className="grid grid-cols-3 gap-2 mt-3">
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
                  {/* §14 B2B: Inactive member alert */}
                  <div className={`bg-zinc-900/60 border rounded-xl p-3 text-center ${inactiveMemberCount > 0 ? "border-amber-500/30" : "border-white/8"}`}>
                    <p className={`text-xl font-black tabular-nums ${inactiveMemberCount > 0 ? "text-amber-400" : "text-blue-300"}`}>
                      {inactiveMemberCount}
                    </p>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">
                      {t("gym.inactiveMembers7d")}
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
            <p className="text-zinc-400 text-sm mt-1">
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
