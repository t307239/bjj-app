import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import GymDashboard from "@/components/GymDashboard";
import GymRegistrationForm from "@/components/GymRegistrationForm";

export const metadata: Metadata = {
  title: "Gym Dashboard | BJJ App",
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
    "Coach";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_gym_owner")
    .eq("id", user.id)
    .single();

  // is_gym_owner flag — set to true when gym is created

  // Fetch their gym (even for non-owners — in case data is out of sync)
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, invite_code, is_active")
    .eq("owner_id", user.id)
    .single();

  const stripeGymPaymentLink =
    process.env.NEXT_PUBLIC_STRIPE_GYM_PAYMENT_LINK ?? "";

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 sm:pb-0">
      <NavBar displayName={displayName} avatarUrl={avatarUrl} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">🏫 Gym Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">
            Track your students and reduce churn
          </p>
        </div>

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
