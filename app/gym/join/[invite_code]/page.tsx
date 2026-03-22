import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import GymJoinClient from "./GymJoinClient";

export const metadata: Metadata = {
  title: "Join Gym | BJJ App",
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

  // Fetch gym by invite_code
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("id, name, owner_id")
    .eq("invite_code", invite_code)
    .single();

  if (gymError || !gym) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white font-bold text-lg mb-2">Invalid invite link</p>
          <p className="text-gray-400 text-sm">
            This gym invite link is no longer valid or has expired.
          </p>
          <a href="/dashboard" className="mt-6 inline-block text-[#e94560] text-sm">
            Go to dashboard →
          </a>
        </div>
      </div>
    );
  }

  // Get owner display info using admin client (requires service role key)
  let ownerName = "Gym Owner";
  let maskedEmail = "";
  try {
    const adminClient = createAdminClient();
    const { data: ownerAuth } = await adminClient.auth.admin.getUserById(gym.owner_id);
    if (ownerAuth?.user) {
      ownerName =
        ownerAuth.user.user_metadata?.full_name ||
        ownerAuth.user.user_metadata?.name ||
        ownerAuth.user.email?.split("@")[0] ||
        "Gym Owner";
      const email = ownerAuth.user.email ?? "";
      maskedEmail = email ? maskEmail(email) : "";
    }
  } catch {
    // Admin client not configured — skip owner identity display (non-fatal)
  }

  // Check if student is already in a gym
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .single();

  const currentGymId = currentProfile?.gym_id ?? null;

  // If already in THIS gym — show already-joined state
  if (currentGymId === gym.id) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-bold text-lg mb-2">
            You're already a member of {gym.name}
          </p>
          <a href="/dashboard" className="mt-6 inline-block text-[#e94560] text-sm">
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
