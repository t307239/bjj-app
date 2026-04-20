import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import GymJoinClient from "./GymJoinClient";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
  title: "Join Gym",
  description: "Accept your gym's invitation and start tracking training together.",
};

type Props = {
  params: Promise<{ invite_code: string }>;
};

// Mask email: "john@gmail.com" → "jo***@gmail.com"
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length < 2) return `***@${domain ?? ""}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default async function GymJoinPage({ params }: Props) {
  const { invite_code } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/gym/join/${invite_code}`);
  }

  const locale = await detectServerLocale();
  const t = makeT(locale);

  // Fetch gym by invite_code
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("id, name, owner_id")
    .eq("invite_code", invite_code)
    .single();

  if (gymError || !gym) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white font-bold text-lg mb-2">{t("gym.invalidInviteTitle")}</p>
          <p className="text-zinc-400 text-sm">
            {t("gym.invalidInviteDesc")}
          </p>
          <a href="/dashboard" className="mt-6 inline-block text-zinc-400 hover:text-white text-sm">
            {t("gym.goToDashboard")} →
          </a>
        </div>
      </div>
    );
  }

  // Get owner display info using admin client (requires service role key)
  let ownerName = t("gym.defaultOwnerName");
  let maskedEmail = "";
  try {
    const adminClient = createAdminClient();
    const { data: ownerAuth } = await adminClient.auth.admin.getUserById(gym.owner_id);
    if (ownerAuth?.user) {
      ownerName =
        ownerAuth.user.user_metadata?.full_name ||
        ownerAuth.user.user_metadata?.name ||
        ownerAuth.user.email?.split("@")[0] ||
        t("gym.defaultOwnerName");
      const email = ownerAuth.user.email ?? "";
      maskedEmail = email ? maskEmail(email) : "";
    }
  } catch {
    // Admin client not configured — skip owner identity display (non-fatal)
  }

  // Check if student is already in a gym
  const { data: currentProfile , error } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .single();
  if (error) logger.error("gym.join_profile_query_error", { userId: user.id }, error as Error);

  const currentGymId = currentProfile?.gym_id ?? null;

  // If already in THIS gym — show already-joined state
  if (currentGymId === gym.id) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-14 h-14 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-bold text-lg mb-2">
            You&apos;re already a member of {gym.name}
          </p>
          <a href="/dashboard" className="mt-6 inline-block text-zinc-400 hover:text-white text-sm">
            Go to dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <GymJoinClient
      gymId={gym.id}
      gymName={gym.name}
      ownerName={ownerName}
      maskedEmail={maskedEmail}
      currentGymId={currentGymId}
      inviteCode={invite_code}
    />
  );
}
