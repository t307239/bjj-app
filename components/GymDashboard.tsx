"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRow = {
  student_id: string;
  belt: string;
  stripe_count: number;
  display_name: string | null;
  last_training_date: string | null;
  sessions_last_30d: number;
};

type Gym = {
  id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
};

type Props = {
  userId: string;
  gym: Gym;
  isGymPro: boolean; // is_active = Stripe paid
  stripeGymPaymentLink: string;
};

// ─── Belt color helper ────────────────────────────────────────────────────────

function beltColor(belt: string): string {
  switch (belt) {
    case "black": return "bg-zinc-900 text-white border-zinc-600";
    case "brown": return "bg-amber-900/50 text-amber-200 border-amber-700";
    case "purple": return "bg-purple-900/50 text-purple-200 border-purple-500";
    case "blue": return "bg-blue-900/50 text-blue-200 border-blue-500";
    default: return "bg-zinc-700/50 text-gray-200 border-zinc-500"; // white
  }
}

// ─── Churn risk helper ────────────────────────────────────────────────────────

type RiskLevel = "green" | "yellow" | "red";

function churnRisk(lastDate: string | null, sessions30d: number): RiskLevel {
  if (!lastDate) return "red";
  const diffDays = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  if (diffDays > 21 || sessions30d === 0) return "red";
  if (diffDays > 10 || sessions30d <= 1) return "yellow";
  return "green";
}

// ─── QR Code display (using qr-code data URI via API) ────────────────────────
// We use a simple text-based URL display since qrcode lib may not be available

function InviteSection({ gym }: { gym: Gym }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://bjj-app.net"}/gym/join/${gym.invite_code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-2">📎 Invite Students</h3>
      <p className="text-xs text-gray-400 mb-3">
        Share this link (or print as QR) to invite students. They'll confirm their identity and opt into data sharing.
      </p>
      <div className="flex gap-2">
        <code className="flex-1 bg-zinc-800 text-xs text-gray-300 px-3 py-2 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap">
          {inviteUrl}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 bg-[#e94560] hover:bg-[#c73652] text-white text-xs px-3 py-2 rounded-lg transition-colors"
          aria-label="Copy invite link"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mt-2">
        Invite code: <span className="font-mono">{gym.invite_code}</span>
      </p>
    </div>
  );
}

// ─── Pro paywall banner ───────────────────────────────────────────────────────

function ProPaywallBanner({
  riskCount,
  stripeGymPaymentLink,
}: {
  riskCount: number;
  stripeGymPaymentLink: string;
}) {
  return (
    <div className="bg-[#e94560]/10 border border-[#e94560]/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🔴</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {riskCount} student{riskCount !== 1 ? "s" : ""} at churn risk
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Upgrade to Gym Pro to see who — and reach out before they quit.
          </p>
        </div>
        <a
          href={stripeGymPaymentLink}
          className="flex-shrink-0 bg-[#e94560] hover:bg-[#c73652] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          aria-label="Upgrade to Gym Pro"
        >
          Upgrade – $49/mo
        </a>
      </div>
    </div>
  );
}

// ─── Belt distribution chart ──────────────────────────────────────────────────

function BeltDistribution({ members }: { members: MemberRow[] }) {
  const BELTS = ["white", "blue", "purple", "brown", "black"];
  const counts: Record<string, number> = {};
  for (const b of BELTS) counts[b] = 0;
  for (const m of members) {
    const b = m.belt ?? "white";
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);

  const BELT_LABELS: Record<string, string> = {
    white: "White",
    blue: "Blue",
    purple: "Purple",
    brown: "Brown",
    black: "Black",
  };

  const BELT_BG: Record<string, string> = {
    white: "bg-gray-400",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    brown: "bg-amber-800",
    black: "bg-zinc-800 border border-zinc-600",
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-3">🥋 Belt Distribution</h3>
      <div className="space-y-2">
        {BELTS.map((belt) => (
          <div key={belt} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12">{BELT_LABELS[belt]}</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${BELT_BG[belt]}`}
                style={{ width: `${(counts[belt] / max) * 100}%`, minWidth: counts[belt] > 0 ? "8px" : "0" }}
              />
            </div>
            <span className="text-xs text-gray-500 w-4 text-right">{counts[belt]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GymDashboard({ userId, gym, isGymPro, stripeGymPaymentLink }: Props) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadMembers = useCallback(async () => {
    // Fetch all opted-in members of this gym
    const { data, error } = await supabase
      .from("profiles")
      .select("id, belt, stripe, gym_id, share_data_with_gym")
      .eq("gym_id", gym.id)
      .eq("share_data_with_gym", true);

    if (error || !data) { setLoading(false); return; }

    // Fetch training stats for each member
    const memberIds = data.map((m) => m.id);
    if (memberIds.length === 0) { setMembers([]); setLoading(false); return; }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const { data: logs } = await supabase
      .from("training_logs")
      .select("user_id, date")
      .in("user_id", memberIds)
      .order("date", { ascending: false });

    // Compute stats per member
    const rows: MemberRow[] = data.map((profile) => {
      const memberLogs = (logs ?? []).filter((l) => l.user_id === profile.id);
      const lastDate = memberLogs[0]?.date ?? null;
      const sessions30 = memberLogs.filter((l) => l.date >= thirtyDaysAgo).length;
      return {
        student_id: profile.id,
        belt: profile.belt ?? "white",
        stripe_count: profile.stripe ?? 0,
        display_name: null, // loaded separately if needed (server-side only)
        last_training_date: lastDate,
        sessions_last_30d: sessions30,
      };
    });

    setMembers(rows);
    setLoading(false);
  }, [gym.id]); // supabase stable via useRef

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Categorize members
  const greenMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "green");
  const yellowMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "yellow");
  const redMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "red");
  const atRiskCount = yellowMembers.length + redMembers.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Invite section */}
      <InviteSection gym={gym} />

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{members.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active members</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{greenMembers.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Training well</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${atRiskCount > 0 ? "text-[#e94560]" : "text-gray-400"}`}>
            {atRiskCount}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">At risk</div>
        </div>
      </div>

      {/* Belt distribution */}
      {members.length > 0 && <BeltDistribution members={members} />}

      {/* Churn risk paywall (free tier: show count, block details) */}
      {!isGymPro && atRiskCount > 0 && (
        <ProPaywallBanner
          riskCount={atRiskCount}
          stripeGymPaymentLink={stripeGymPaymentLink}
        />
      )}

      {/* Member roster */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-white mb-3">
          🟢 Active Members ({greenMembers.length})
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-10 bg-zinc-900 border border-white/10 rounded-xl">
            <div className="text-4xl mb-3">🏫</div>
            <p className="text-gray-300 font-medium mb-1">No members yet</p>
            <p className="text-gray-500 text-sm">
              Share your invite link with students. They'll appear here once they join and enable data sharing.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show green members freely */}
            {greenMembers.map((m) => (
              <MemberCard key={m.student_id} member={m} risk="green" showDetail={true} />
            ))}

            {/* Yellow members: free shows count + basic card, Pro shows last-seen */}
            {yellowMembers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                  🟡 Slowing down ({yellowMembers.length})
                </h3>
                {yellowMembers.map((m) => (
                  <MemberCard
                    key={m.student_id}
                    member={m}
                    risk="yellow"
                    showDetail={isGymPro}
                    proRequired={!isGymPro}
                    stripeGymPaymentLink={stripeGymPaymentLink}
                  />
                ))}
              </div>
            )}

            {/* Red members: count shown free, details Pro only */}
            {redMembers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[#e94560] mb-2">
                  🔴 High churn risk ({redMembers.length})
                </h3>
                {redMembers.map((m) => (
                  <MemberCard
                    key={m.student_id}
                    member={m}
                    risk="red"
                    showDetail={isGymPro}
                    proRequired={!isGymPro}
                    stripeGymPaymentLink={stripeGymPaymentLink}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  risk,
  showDetail,
  proRequired = false,
  stripeGymPaymentLink,
}: {
  member: MemberRow;
  risk: RiskLevel;
  showDetail: boolean;
  proRequired?: boolean;
  stripeGymPaymentLink?: string;
}) {
  const lastSeenText = member.last_training_date
    ? (() => {
        const days = Math.floor((Date.now() - new Date(member.last_training_date).getTime()) / 86400000);
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
      })()
    : "Never";

  const riskDot: Record<RiskLevel, string> = {
    green: "bg-green-400",
    yellow: "bg-yellow-400",
    red: "bg-[#e94560]",
  };

  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3">
      {/* Risk indicator */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${riskDot[risk]}`} />

      {/* Belt badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${beltColor(member.belt)}`}
      >
        {member.belt}
        {member.stripe_count > 0 && ` ${"▪".repeat(member.stripe_count)}`}
      </span>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {showDetail ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Last seen: {lastSeenText}</span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-400">{member.sessions_last_30d} sessions/30d</span>
          </div>
        ) : proRequired ? (
          <span className="text-xs text-gray-600 italic">
            🔒 Details hidden —{" "}
            {stripeGymPaymentLink && (
              <a href={stripeGymPaymentLink} className="text-[#e94560] hover:underline">
                upgrade to see
              </a>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}
