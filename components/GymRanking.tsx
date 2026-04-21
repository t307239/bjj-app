"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Skeleton from "@/components/ui/Skeleton";
import { getLogicalTrainingDate } from "@/lib/logicalDate";
import { clientLogger } from "@/lib/clientLogger";

type RankRow = {
  student_id: string;
  belt: string;
  total_sessions: number;
  current_streak: number;
  isMe: boolean;
};

type Props = {
  userId: string;
  gymId: string;
};

type Mode = "sessions" | "streak";

function beltDot(belt: string): string {
  switch (belt) {
    case "black":  return "bg-zinc-900 border border-zinc-500";
    case "brown":  return "bg-amber-800";
    case "purple": return "bg-purple-600";
    case "blue":   return "bg-blue-500";
    default:       return "bg-gray-300"; // white
  }
}

/** Compute consecutive-day streak from date strings (uses logical training date) */
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates)].sort().reverse();
  const today = getLogicalTrainingDate();
  let checkDateMs = new Date(today + "T00:00:00Z").getTime();
  let streak = 0;
  for (const dateStr of unique) {
    const check = new Date(checkDateMs).toISOString().slice(0, 10);
    if (dateStr === check) {
      streak++;
      checkDateMs -= 86400000;
    } else if (dateStr < check) {
      break;
    }
  }
  return streak;
}

/**
 * Shows a ranked leaderboard for all opt-in members in the same gym.
 * Tabs: "Sessions" (total all-time) | "Streak" (current streak).
 * Includes inline opt-in / opt-out toggle so users can leave or join
 * the ranking without going to Profile settings.
 */
export default function GymRanking({ userId, gymId }: Props) {
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("sessions");
  const [isOptedIn, setIsOptedIn] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 0. Fetch current user's opt-in status
      const { data: myProfile , error } = await supabase
        .from("profiles")
        .select("share_data_with_gym")
        .eq("id", userId)
        .single();
      if (error) clientLogger.error("gymranking.query", {}, error);

      if (!cancelled) {
        setIsOptedIn(myProfile?.share_data_with_gym ?? false);
      }

      // 1. Get all opt-in members of this gym
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, belt")
        .eq("gym_id", gymId)
        .eq("share_data_with_gym", true);

      if (profileErr || !profiles || profiles.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      const memberIds = profiles.map((p) => p.id);

      // 2. Get training log dates for each member (last 365 days — caps query size)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { data: logs , error: logsError } = await supabase
        .from("training_logs")
        .select("user_id, date")
        .in("user_id", memberIds)
        .gte("date", oneYearAgo)
        .order("date", { ascending: false });
      if (logsError) clientLogger.error("gymranking.query", {}, logsError);

      // 3. Build per-member log maps
      const logsByMember: Record<string, string[]> = {};
      for (const id of memberIds) logsByMember[id] = [];
      for (const log of logs ?? []) {
        logsByMember[log.user_id]?.push(log.date);
      }

      // 4. Compute rows
      const computed: RankRow[] = profiles.map((p) => ({
        student_id: p.id,
        belt: p.belt ?? "white",
        total_sessions: logsByMember[p.id]?.length ?? 0,
        current_streak: computeStreak(logsByMember[p.id] ?? []),
        isMe: p.id === userId,
      }));

      if (!cancelled) {
        setRows(computed);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [gymId, userId, supabase, refreshKey]);

  async function handleToggle() {
    if (toggling || isOptedIn === null) return;
    setToggling(true);
    const next = !isOptedIn;
    const { error } = await supabase
      .from("profiles")
      .update({ share_data_with_gym: next })
      .eq("id", userId);
    if (!error) {
      setIsOptedIn(next);
      setRefreshKey((k) => k + 1);
    }
    setToggling(false);
  }

  /** Inline opt-in/opt-out toggle button rendered at the bottom of the card */
  function OptToggle() {
    if (isOptedIn === null) return null;
    if (isOptedIn) {
      return (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-zinc-400">{t("gym.rankingOptOutHint")}</p>
          <button type="button"
            onClick={handleToggle}
            disabled={toggling}
            className="text-xs text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0 ml-3"
          >
            {toggling ? t("gym.rankingToggling") : t("gym.rankingOptOut")}
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <p className="text-xs text-zinc-400">{t("gym.rankingOptInHint")}</p>
        <button type="button"
          onClick={handleToggle}
          disabled={toggling}
          className="text-xs text-[#10B981] hover:text-[#0d9668] font-semibold transition-colors disabled:opacity-40 flex-shrink-0 ml-3"
        >
          {toggling ? t("gym.rankingToggling") : t("gym.rankingOptIn")}
        </button>
      </div>
    );
  }

  if (loading) return <Skeleton height={120} rounded="xl" className="mb-4" />;
  if (rows.length === 0) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3">🏆 {t("gym.rankingTitle")}</h3>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">👥</div>
          <p className="text-zinc-400 text-sm">{t("gym.noMembers")}</p>
          <p className="text-zinc-400 text-xs mt-1">{t("gym.noMembersHint")}</p>
        </div>
        <OptToggle />
      </div>
    );
  }

  // Sort by active mode
  const sorted = [...rows].sort((a, b) =>
    mode === "sessions"
      ? b.total_sessions - a.total_sessions
      : b.current_streak - a.current_streak
  );

  const myRankIdx = sorted.findIndex((r) => r.isMe);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  const showRows = sorted.slice(0, 10);
  const needsExtraRow = myRankIdx >= 10 && !showRows.some((r) => r.isMe);

  const getValue = (row: RankRow) =>
    mode === "sessions" ? row.total_sessions : row.current_streak;

  return (
    <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          👥 {t("gym.rankingTitle")}
        </h3>
        {myRank !== null && (
          <span className="text-xs text-zinc-400">
            {t("gym.myRank", { n: myRank })}
          </span>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-3">
        {(["sessions", "streak"] as Mode[]).map((m) => (
          <button type="button"
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              mode === m
                ? "bg-zinc-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {m === "sessions" ? t("gym.rankingSessions") : t("gym.rankingStreak")}
          </button>
        ))}
      </div>

      {/* Rest day reminder for streak mode — injury prevention */}
      {mode === "streak" && (
        <p className="text-xs text-amber-500/80 mb-2">
          🛡️ {t("gym.rankingStreakRestHint")}
        </p>
      )}

      <div className="space-y-1.5">
        {showRows.map((row, idx) => {
          const rank = idx + 1;
          const isMe = row.isMe;
          const val = getValue(row);
          return (
            <div
              key={row.student_id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                isMe
                  ? "bg-white/5 border border-white/20"
                  : "bg-zinc-800/50"
              }`}
            >
              {/* No medal emojis — rank number only (non-competitive framing) */}
              <span className="w-5 text-center text-xs text-zinc-400 flex-shrink-0">
                {rank}
              </span>
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(row.belt)}`}
                title={row.belt}
                aria-label={row.belt}
              />
              <span
                className={`flex-1 text-xs ${
                  isMe ? "text-white font-semibold" : "text-zinc-300"
                }`}
              >
                {isMe ? t("gym.rankingMe") : t("gym.rankingAnon")}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {val}{mode === "streak" && val >= 30 ? "🔥" : mode === "streak" && val >= 7 ? "⚡" : ""}
              </span>
            </div>
          );
        })}

        {needsExtraRow && myRankIdx >= 0 && (
          <>
            <div className="text-center text-zinc-400 text-xs py-0.5">•••</div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/20">
              <span className="w-5 text-center text-xs text-zinc-400 flex-shrink-0">
                {myRankIdx + 1}
              </span>
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(sorted[myRankIdx].belt)}`}
                aria-label={sorted[myRankIdx].belt}
              />
              <span className="flex-1 text-xs text-white font-semibold">
                {t("gym.rankingMe")}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {getValue(sorted[myRankIdx])}{mode === "streak" && getValue(sorted[myRankIdx]) >= 30 ? "🔥" : mode === "streak" && getValue(sorted[myRankIdx]) >= 7 ? "⚡" : ""}
              </span>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-zinc-400 mt-2.5">
        {t("gym.rankingFootnote")}
      </p>

      <OptToggle />
    </div>
  );
}
