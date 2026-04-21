"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { type MemberRow, type RiskLevel, beltColor } from "./types";
import { clientLogger } from "@/lib/clientLogger";

type Props = {
  member: MemberRow;
  risk: RiskLevel;
  showDetail: boolean;
  proRequired?: boolean;
  onUpgradeClick?: () => void;
  onKickRequest?: (member: MemberRow) => void;
};

export default function MemberCard({
  member,
  risk,
  showDetail,
  proRequired = false,
  onUpgradeClick,
  onKickRequest,
}: Props) {
  const { t } = useLocale();
  const [nudgeCopied, setNudgeCopied] = useState(false);
  const nudgeCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (nudgeCopiedTimerRef.current) clearTimeout(nudgeCopiedTimerRef.current);
    };
  }, []);

  const handleNudge = () => {
    const msg = t("gym.nudgeTemplate");
    navigator.clipboard.writeText(msg).then(() => {
      setNudgeCopied(true);
      nudgeCopiedTimerRef.current = setTimeout(() => setNudgeCopied(false), 2000);
    }).catch((err) => clientLogger.error("nudge_clipboard_copy_failed", {}, err));
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
            <span className="text-xs text-zinc-400">{t("gym.lastSeen", { text: lastSeenText })}</span>
            <span className="text-xs text-zinc-400">·</span>
            <span className="text-xs text-zinc-400">{t("gym.sessionsPerMonth", { n: member.sessions_last_30d })}</span>
          </div>
        ) : proRequired ? (
          <span className="text-xs text-zinc-400 italic">
            {t("gym.detailsHidden")}{" "}
            {onUpgradeClick && (
              <button type="button" onClick={onUpgradeClick} className="text-yellow-400 hover:underline">
                {t("gym.upgradeToSeeLink")}
              </button>
            )}
          </span>
        ) : null}
      </div>

      {/* Nudge button: copy reminder msg for at-risk members (Pro only) */}
      {showDetail && (risk === "yellow" || risk === "red") && (
        <button type="button"
          onClick={handleNudge}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg transition-colors ${
            nudgeCopied
              ? "text-green-400 bg-green-400/10"
              : "text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10"
          }`}
          title={t("gym.nudgeAriaLabel", { name: member.display_name ?? "member" })}
          aria-label={t("gym.nudgeAriaLabel", { name: member.display_name ?? "member" })}
        >
          {nudgeCopied ? t("gym.nudgeCopied") : t("gym.nudgeCopy")}
        </button>
      )}

      {/* Kick button (gym owner only) */}
      {onKickRequest && (
        <button type="button"
          onClick={() => onKickRequest(member)}
          className="flex-shrink-0 text-zinc-400 hover:text-[#e94560] transition-colors p-1"
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
