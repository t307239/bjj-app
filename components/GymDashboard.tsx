"use client";

import React, { useState, useEffect, useRef } from "react";
import Toast from "./Toast";
import { useLocale } from "@/lib/i18n";
import { useGymDashboard } from "@/hooks/useGymDashboard";
import { type MemberRow, type Gym } from "./gym/types";
import MemberCard from "./gym/MemberCard";
import BeltDistributionChart from "./gym/BeltDistributionChart";
import CsvBulkInvite from "./gym/CsvBulkInvite";
import CurriculumDispatch from "./gym/CurriculumDispatch";
import InviteQRCode from "./gym/InviteQRCode";
import { trackEvent } from "@/lib/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  gym: Gym;
  isGymPro: boolean;
  stripeGymPaymentLink: string | null;
};

// ─── Privacy Shield Badge (B-33: Trust Boundary) ─────────────────────────────

function PrivacyShieldBadge() {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-3 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
          🔒 {t("gym.privacyShieldTitle")}
        </span>
        <span className="text-zinc-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-green-400 mb-1.5 uppercase tracking-wide">
                ✅ {t("gym.privacyShieldCoachSees")}
              </p>
              {([1, 2, 3] as const).map((i) => (
                <p key={i} className="text-xs text-zinc-300 leading-relaxed">
                  {t(`gym.privacyShieldVisible${i}`)}
                </p>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">
                🔒 {t("gym.privacyShieldNeverSeen")}
              </p>
              {([1, 2, 3] as const).map((i) => (
                <p key={i} className="text-xs text-zinc-400 leading-relaxed line-through decoration-zinc-600">
                  {t(`gym.privacyShieldHidden${i}`)}
                </p>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2.5 pt-2 border-t border-white/5">
            {t("gym.privacyShieldStudentControl")}
          </p>
        </>
      )}
    </div>
  );
}

// ─── QR Code display (using qr-code data URI via API) ────────────────────────

function InviteSection({ gym, onInviteRegenerated }: { gym: Gym; onInviteRegenerated: (newCode: string) => void }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [currentCode, setCurrentCode] = useState(gym.invite_code);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://bjj-app.net"}/gym/join/${currentCode}`;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      // §6 Telemetry: B2B funnel — gym owner copied invite link
      trackEvent("gym_member_invited", { method: "copy_link" });
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
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
      <p className="text-xs text-zinc-400 mb-3">
        {t("gym.inviteDesc")}
      </p>
      <div className="flex gap-2">
        <code className="flex-1 bg-zinc-800 text-xs text-zinc-300 px-3 py-2 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap">
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

      {/* Quick share buttons */}
      <div className="flex gap-2 mt-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Join our gym on BJJ App! ${inviteUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-green-700/30 hover:bg-green-700/50 text-green-300 text-xs font-semibold py-2 rounded-lg border border-green-600/30 transition-colors"
        >
          {t("gym.shareWhatsApp")}
        </a>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: gym.name, text: `Join ${gym.name} on BJJ App!`, url: inviteUrl }).catch(() => {/* user cancelled share */});
            } else {
              copy();
            }
          }}
          className="flex-1 text-center bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 text-xs font-semibold py-2 rounded-lg border border-white/10 transition-colors"
        >
          {t("gym.shareOther")}
        </button>
      </div>
      <p className="text-xs text-zinc-400 mt-2">
        {t("gym.inviteCode")} <span className="font-mono">{currentCode}</span>
      </p>
      {/* Regenerate — inline confirm */}
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
            className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            {t("training.cancel")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRegen(true)}
          disabled={regenerating}
          className="mt-3 text-xs text-zinc-400 hover:text-orange-400 transition-colors disabled:opacity-50"
          aria-label={t("gym.ariaRegenerate")}
        >
          {regenerating ? t("gym.regenerating") : t("gym.regenerateBtn")}
        </button>
      )}
    </div>
  );
}

// ─── Free plan activation banner ─────────────────────────────────────────────

function FreePlanBanner({
  onUpgradeClick,
  upgrading,
}: {
  onUpgradeClick: () => void;
  upgrading: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="bg-amber-950/20 border border-amber-500/25 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">🚀</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300">
            {t("gym.freePlanBannerTitle")}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            {t("gym.freePlanBannerDesc")}
          </p>
        </div>
      </div>
      <button
        onClick={onUpgradeClick}
        disabled={upgrading}
        className="mt-3 w-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-60 text-black text-sm font-semibold py-2.5 rounded-lg transition-all"
      >
        {upgrading ? "..." : t("gym.freePlanBannerCta")}
      </button>
    </div>
  );
}

// ─── Pro paywall banner ───────────────────────────────────────────────────────

function ProPaywallBanner({
  riskCount,
  onUpgradeClick,
  upgrading,
}: {
  riskCount: number;
  onUpgradeClick: () => void;
  upgrading: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="bg-[#e94560]/10 border border-[#e94560]/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {t("gym.churnAlertTitle", { n: riskCount })}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{t("gym.churnAlertDesc")}</p>
        </div>
        <button
          onClick={onUpgradeClick}
          disabled={upgrading}
          className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:opacity-60 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
        >
          {upgrading ? "..." : t("gym.upgradeBtn")}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GymDashboard({ userId, gym: initialGym, isGymPro, stripeGymPaymentLink }: Props) {
  const { t, locale } = useLocale();
  const {
    gym,
    members,
    loading,
    toast, setToast,
    kickTarget, setKickTarget,
    upgrading,
    handleGymUpgrade,
    printLeaderboard,
    handleKickMember,
    handleKickRequest,
    handleInviteRegenerated,
    greenMembers,
    yellowMembers,
    redMembers,
    atRiskCount,
    totalSessionsThisMonth,
    avgSessions30d,
  } = useGymDashboard({ initialGym, t, locale });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Free plan activation CTA (always show until upgraded) */}
      {!isGymPro && (
        <FreePlanBanner onUpgradeClick={handleGymUpgrade} upgrading={upgrading} />
      )}

      {/* Invite section */}
      <InviteSection gym={gym} onInviteRegenerated={handleInviteRegenerated} />

      {/* QR Code for invite link */}
      <InviteQRCode inviteCode={gym.invite_code} />

      {/* Privacy Shield — B-33: Trust Boundary */}
      <PrivacyShieldBadge />

      {/* CSV Bulk Invite (Pro feature) */}
      <CsvBulkInvite
        gym={gym}
        onUpgradeClick={handleGymUpgrade}
        upgrading={upgrading}
        isGymPro={isGymPro}
      />

      {/* Curriculum dispatch (Pro feature) */}
      <CurriculumDispatch
        gym={gym}
        onUpgradeClick={handleGymUpgrade}
        upgrading={upgrading}
        isGymPro={isGymPro}
      />

      {/* Print leaderboard (Pro only) */}
      {isGymPro && members.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={printLeaderboard}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {t("gym.printLeaderboard")}
          </button>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{members.length}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{t("gym.activeMembers")}</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{greenMembers.length}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{t("gym.trainingWell")}</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${atRiskCount > 0 ? "text-[#e94560]" : "text-zinc-400"}`}>
            {atRiskCount}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">{t("gym.atRisk")}</div>
        </div>
      </div>
      {/* Gym-wide stats row */}
      {members.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-[#10B981]">{totalSessionsThisMonth}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{t("gym.totalSessions30d")}</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{avgSessions30d}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{t("gym.avgSessions30d")}</div>
          </div>
        </div>
      )}

      {/* Belt distribution */}
      {members.length > 0 && <BeltDistributionChart members={members} />}

      {/* Churn risk paywall (free tier) */}
      {!isGymPro && atRiskCount > 0 && (
        <ProPaywallBanner
          riskCount={atRiskCount}
          onUpgradeClick={handleGymUpgrade}
          upgrading={upgrading}
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
            <p className="text-zinc-300 font-medium mb-1">{t("gym.noMembers")}</p>
            <p className="text-zinc-400 text-sm">
              {t("gym.noMembersDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {greenMembers.map((m) => (
              <MemberCard key={m.student_id} member={m} risk="green" showDetail={true} onKickRequest={handleKickRequest} />
            ))}

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
                    onUpgradeClick={handleGymUpgrade}
                    onKickRequest={handleKickRequest}
                  />
                ))}
              </div>
            )}

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
                    onUpgradeClick={handleGymUpgrade}
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
            <p className="text-zinc-400 text-sm leading-relaxed mb-5">
              {t("gym.removeMemberConfirm", {
                name: kickTarget.display_name || t("gym.rankingAnon"),
              })}
            </p>
            <p className="text-zinc-400 text-xs mb-5">
              {t("gym.removeMemberNote")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setKickTarget(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2.5 rounded-xl text-sm transition-colors"
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
