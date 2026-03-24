"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";
import { useLocale } from "@/lib/i18n";

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
  curriculum_url?: string | null;
  curriculum_set_at?: string | null;
};

type Props = {
  userId: string;
  gym: Gym;
  isGymPro: boolean; // is_active = Stripe paid
  stripeGymPaymentLink: string | null;
};

// ─── Belt color helper ────────────────────────────────────────────────────────

function beltColor(belt: string): string {
  switch (belt) {
    case "black": return "bg-zinc-900 text-white border-zinc-600";
    case "brown": return "bg-amber-900/50 text-amber-200 border-amber-700";
    case "purple": return "bg-purple-900/50 text-purple-200 border-purple-500";
    case "blue": return "bg-blue-900/50 text-blue-200 border-blue-500";
    default: return "bg-zinc-700/50 text-white border-zinc-500"; // white
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

function InviteSection({ gym, onInviteRegenerated }: { gym: Gym; onInviteRegenerated: (newCode: string) => void }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [currentCode, setCurrentCode] = useState(gym.invite_code);
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://bjj-app.net"}/gym/join/${currentCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const regenerate = async () => {
    setConfirmRegen(false);
    setRegenerating(true);
    try {
      const res = await fetch("/api/gym/regenerate-invite", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCurrentCode(data.invite_code);
        onInviteRegenerated(data.invite_code);
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-2">{t("gym.inviteTitle")}</h3>
      <p className="text-xs text-gray-400 mb-3">
        {t("gym.inviteDesc")}
      </p>
      <div className="flex gap-2">
        <code className="flex-1 bg-zinc-800 text-xs text-gray-300 px-3 py-2 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap">
          {inviteUrl}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 bg-zinc-700 hover:bg-zinc-600 text-white text-xs px-3 py-2 rounded-lg transition-colors"
          aria-label={t("gym.ariaCopyInvite")}
        >
          {copied ? t("gym.inviteCopied") : t("gym.inviteCopy")}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {t("gym.inviteCode")} <span className="font-mono">{currentCode}</span>
      </p>
      {/* Regenerate — inline confirm to avoid window.confirm() */}
      {confirmRegen ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-orange-400">{t("gym.regenerateConfirm")}</span>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {t("gym.confirmYes")}
          </button>
          <button
            onClick={() => setConfirmRegen(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t("training.cancel")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRegen(true)}
          disabled={regenerating}
          className="mt-3 text-xs text-gray-500 hover:text-orange-400 transition-colors disabled:opacity-50"
          aria-label={t("gym.ariaRegenerate")}
        >
          {regenerating ? t("gym.regenerating") : t("gym.regenerateBtn")}
        </button>
      )}
    </div>
  );
}

// ─── Pro paywall banner ───────────────────────────────────────────────────────

function ProPaywallBanner({
  riskCount,
  stripeGymPaymentLink,
}: {
  riskCount: number;
  stripeGymPaymentLink: string | null;
}) {
  const { t } = useLocale();
  return (
    <div className="bg-[#e94560]/10 border border-[#e94560]/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🔴</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {riskCount === 1 ? t("gym.atChurnRisk1") : t("gym.atChurnRisk", { n: riskCount })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("gym.upgradeToSee")}
          </p>
        </div>
        {stripeGymPaymentLink ? (
          <a
            href={stripeGymPaymentLink}
            className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            aria-label={t("gym.ariaUpgradePro")}
          >
            {t("gym.upgradeBtn")}
          </a>
        ) : (
          <span
            className="flex-shrink-0 bg-zinc-700 text-gray-500 text-xs font-semibold px-3 py-2 rounded-lg cursor-not-allowed"
            aria-disabled="true"
          >
            {t("gym.upgradeBtn")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Curriculum dispatch section (Pro only) ──────────────────────────────────

function CurriculumSection({
  gym,
  stripeGymPaymentLink,
  isGymPro,
}: {
  gym: Gym;
  stripeGymPaymentLink: string | null;
  isGymPro: boolean;
}) {
  const { t } = useLocale();
  const [url, setUrl] = useState(gym.curriculum_url ?? "");
  const [dispatching, setDispatching] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(gym.curriculum_set_at ?? null);

  const dispatch = async () => {
    setConfirmDispatch(false);
    setDispatching(true);
    try {
      const res = await fetch("/api/gym/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum_url: url.trim() }),
      });
      if (res.ok) {
        setLastSentAt(new Date().toISOString());
      }
    } finally {
      setDispatching(false);
    }
  };

  if (!isGymPro) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📚</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{t("gym.curriculumTitle")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("gym.curriculumProRequired")}</p>
          </div>
          {stripeGymPaymentLink ? (
            <a
              href={stripeGymPaymentLink}
              className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            >
              {t("gym.upgradeBtn")}
            </a>
          ) : (
            <span
              className="flex-shrink-0 bg-zinc-700 text-gray-500 text-xs font-semibold px-3 py-2 rounded-lg cursor-not-allowed"
              aria-disabled="true"
            >
              {t("gym.upgradeBtn")}
            </span>
          )}
        </div>
      </div>
    );
  }

  const sentAgo = lastSentAt
    ? (() => {
        const d = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000);
        if (d === 0) return t("gym.today");
        if (d === 1) return t("gym.yesterday");
        return t("gym.daysAgo", { n: d });
      })()
    : null;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-1">📚 {t("gym.curriculumTitle")}</h3>
      <p className="text-xs text-gray-500 mb-3">{t("gym.curriculumDesc")}</p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setConfirmDispatch(false); }}
          placeholder="https://wiki.bjj-app.net/en/..."
          className="flex-1 bg-zinc-800 text-xs text-gray-300 placeholder-gray-500 px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={() => { if (!url.trim()) return; setConfirmDispatch(true); }}
          disabled={dispatching || !url.trim() || confirmDispatch}
          className="flex-shrink-0 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          {dispatching ? t("gym.curriculumSending") : t("gym.curriculumDispatch")}
        </button>
      </div>
      {/* Inline dispatch confirmation — avoids window.confirm() */}
      {confirmDispatch && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[#10B981]">{t("gym.curriculumConfirm")}</span>
          <button
            onClick={dispatch}
            disabled={dispatching}
            className="text-xs font-semibold text-white bg-[#10B981] hover:bg-[#0d9668] px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {t("gym.confirmYes")}
          </button>
          <button
            onClick={() => setConfirmDispatch(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t("training.cancel")}
          </button>
        </div>
      )}
      {sentAgo && (
        <p className="text-xs text-gray-500 mt-2">
          {t("gym.curriculumLastSent", { text: sentAgo })}
        </p>
      )}
    </div>
  );
}

// ─── Belt distribution chart ──────────────────────────────────────────────────

function BeltDistribution({ members }: { members: MemberRow[] }) {
  const { t } = useLocale();
  const BELTS = ["white", "blue", "purple", "brown", "black"];
  const counts: Record<string, number> = {};
  for (const b of BELTS) counts[b] = 0;
  for (const m of members) {
    const b = m.belt ?? "white";
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);

  const BELT_LABELS: Record<string, string> = {
    white: t("profile.belts.white"),
    blue: t("profile.belts.blue"),
    purple: t("profile.belts.purple"),
    brown: t("profile.belts.brown"),
    black: t("profile.belts.black"),
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
      <h3 className="text-sm font-semibold text-white mb-3">{t("gym.beltDistribution")}</h3>
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

export default function GymDashboard({ userId, gym: initialGym, isGymPro, stripeGymPaymentLink }: Props) {
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [gym, setGym] = useState<Gym>(initialGym);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [kickTarget, setKickTarget] = useState<MemberRow | null>(null);

  const printLeaderboard = useCallback(() => {
    const now = new Date();
    const monthLabel = now.toLocaleString("en", { month: "long", year: "numeric" });
    const sorted = [...members].sort((a, b) => b.sessions_last_30d - a.sessions_last_30d);
    const rows = sorted
      .map((m, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const stripes = m.stripe_count > 0 ? ` ${"▪".repeat(m.stripe_count)}` : "";
        return `<tr>
          <td style="padding:10px 16px;font-weight:700;font-size:18px;">${medal}</td>
          <td style="padding:10px 16px;">${m.display_name ?? "—"}</td>
          <td style="padding:10px 16px;text-transform:capitalize;">${m.belt}${stripes}</td>
          <td style="padding:10px 16px;text-align:center;font-weight:700;">${m.sessions_last_30d}</td>
        </tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${gym.name} — Monthly Leaderboard</title>
      <style>
        body{font-family:sans-serif;margin:40px;color:#111}
        h1{font-size:24px;margin-bottom:4px}p{color:#555;font-size:14px;margin:0 0 24px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;padding:8px 16px;background:#f4f4f4;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em}
        tr:nth-child(even)td{background:#fafafa}
        @media print{@page{margin:20mm}}
      </style></head><body>
      <h1>🏆 ${gym.name} Monthly Leaderboard</h1>
      <p>${monthLabel} · Generated by BJJ App · bjj-app.net</p>
      <table><thead><tr><th>Rank</th><th>Athlete</th><th>Belt</th><th style="text-align:center">Sessions (30d)</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }, [members, gym.name]);

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

  const handleKickMember = useCallback(async (memberId: string) => {
    try {
      const res = await fetch("/api/gym/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.student_id !== memberId));
        setToast({ message: t("gym.memberKicked"), type: "success" });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error ?? t("gym.kickFailed"), type: "error" });
      }
    } catch {
      setToast({ message: t("gym.kickFailed"), type: "error" });
    }
    setKickTarget(null);
  }, [t]);

  const handleKickRequest = useCallback((member: MemberRow) => {
    setKickTarget(member);
  }, []);

  const handleInviteRegenerated = useCallback((newCode: string) => {
    setGym((prev) => ({ ...prev, invite_code: newCode }));
  }, []);

  // Categorize members
  const greenMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "green");
  const yellowMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "yellow");
  const redMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "red");
  const atRiskCount = yellowMembers.length + redMembers.length;

  // Gym-wide stats
  const totalSessionsThisMonth = members.reduce((sum, m) => sum + m.sessions_last_30d, 0);
  const avgSessions30d =
    members.length > 0
      ? Math.round((totalSessionsThisMonth / members.length) * 10) / 10
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Invite section */}
      <InviteSection gym={gym} onInviteRegenerated={handleInviteRegenerated} />

      {/* Curriculum dispatch (Pro feature) */}
      <CurriculumSection
        gym={gym}
        stripeGymPaymentLink={stripeGymPaymentLink}
        isGymPro={isGymPro}
      />

      {/* Print leaderboard (Pro only) */}
      {isGymPro && members.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={printLeaderboard}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print leaderboard
          </button>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{members.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t("gym.activeMembers")}</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{greenMembers.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t("gym.trainingWell")}</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${atRiskCount > 0 ? "text-[#e94560]" : "text-gray-400"}`}>
            {atRiskCount}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{t("gym.atRisk")}</div>
        </div>
      </div>
      {/* Gym-wide stats row (second row) */}
      {members.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-[#10B981]">{totalSessionsThisMonth}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t("gym.totalSessions30d")}</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{avgSessions30d}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t("gym.avgSessions30d")}</div>
          </div>
        </div>
      )}

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
          {t("gym.activeSection", { n: greenMembers.length })}
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-10 bg-zinc-900 border border-white/10 rounded-xl">
            <div className="text-4xl mb-3">🏫</div>
            <p className="text-gray-300 font-medium mb-1">{t("gym.noMembers")}</p>
            <p className="text-gray-500 text-sm">
              {t("gym.noMembersDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show green members freely */}
            {greenMembers.map((m) => (
              <MemberCard key={m.student_id} member={m} risk="green" showDetail={true} onKickRequest={handleKickRequest} />
            ))}

            {/* Yellow members: free shows count + basic card, Pro shows last-seen */}
            {yellowMembers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                  {t("gym.slowingSection", { n: yellowMembers.length })}
                </h3>
                {yellowMembers.map((m) => (
                  <MemberCard
                    key={m.student_id}
                    member={m}
                    risk="yellow"
                    showDetail={isGymPro}
                    proRequired={!isGymPro}
                    stripeGymPaymentLink={stripeGymPaymentLink}
                    onKickRequest={handleKickRequest}
                  />
                ))}
              </div>
            )}

            {/* Red members: count shown free, details Pro only */}
            {redMembers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[#e94560] mb-2">
                  {t("gym.highRiskSection", { n: redMembers.length })}
                </h3>
                {redMembers.map((m) => (
                  <MemberCard
                    key={m.student_id}
                    member={m}
                    risk="red"
                    showDetail={isGymPro}
                    proRequired={!isGymPro}
                    stripeGymPaymentLink={stripeGymPaymentLink}
                    onKickRequest={handleKickRequest}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Kick confirmation modal */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold text-base mb-2">
              {t("gym.removeMemberTitle")}
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              {t("gym.removeMemberConfirm", {
                name: kickTarget.display_name || t("gym.rankingAnon"),
              })}
            </p>
            <p className="text-gray-500 text-xs mb-5">
              {t("gym.removeMemberNote")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setKickTarget(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {t("training.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleKickMember(kickTarget.student_id)}
                className="flex-1 bg-[#e94560] hover:bg-[#c73652] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {t("gym.removeMemberBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
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
  onKickRequest,
}: {
  member: MemberRow;
  risk: RiskLevel;
  showDetail: boolean;
  proRequired?: boolean;
  stripeGymPaymentLink?: string | null;
  onKickRequest?: (member: MemberRow) => void;
}) {
  const { t } = useLocale();
  const [nudgeCopied, setNudgeCopied] = useState(false);

  const handleNudge = () => {
    const msg = t("gym.nudgeTemplate");
    navigator.clipboard.writeText(msg).then(() => {
      setNudgeCopied(true);
      setTimeout(() => setNudgeCopied(false), 2000);
    });
  };
  const lastSeenText = member.last_training_date
    ? (() => {
        const days = Math.floor((Date.now() - new Date(member.last_training_date).getTime()) / 86400000);
        if (days === 0) return t("gym.today");
        if (days === 1) return t("gym.yesterday");
        return t("gym.daysAgo", { n: days });
      })()
    : t("gym.never");

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
            <span className="text-xs text-gray-400">{t("gym.lastSeen", { text: lastSeenText })}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{t("gym.sessionsPerMonth", { n: member.sessions_last_30d })}</span>
          </div>
        ) : proRequired ? (
          <span className="text-xs text-gray-500 italic">
            {t("gym.detailsHidden")}{" "}
            {stripeGymPaymentLink && (
              <a href={stripeGymPaymentLink} className="text-yellow-400 hover:underline">
                {t("gym.upgradeToSeeLink")}
              </a>
            )}
          </span>
        ) : null}
      </div>

      {/* Nudge button: copy reminder msg for at-risk members (Pro only) */}
      {showDetail && (risk === "yellow" || risk === "red") && (
        <button
          onClick={handleNudge}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg transition-colors ${
            nudgeCopied
              ? "text-green-400 bg-green-400/10"
              : "text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10"
          }`}
          title={t("gym.nudgeAriaLabel", { name: member.display_name ?? "member" })}
          aria-label={t("gym.nudgeAriaLabel", { name: member.display_name ?? "member" })}
        >
          {nudgeCopied ? t("gym.nudgeCopied") : t("gym.nudgeCopy")}
        </button>
      )}

      {/* Kick button (gym owner only) */}
      {onKickRequest && (
        <button
          onClick={() => onKickRequest(member)}
          className="flex-shrink-0 text-gray-500 hover:text-[#e94560] transition-colors p-1"
          title={t("gym.removeMemberTitle")}
          aria-label={`Remove ${member.display_name || "member"} from gym`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
