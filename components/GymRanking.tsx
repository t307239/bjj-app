"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

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

/** Compute consecutive-day streak from sorted date strings (desc) */
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] as string);
    const curr = new Date(unique[i] as string);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Shows a ranked leaderboard for all opt-in members in the same gym.
 * Tabs: "Sessions" (total all-time) | "Streak" (current streak).
 * Incentivises share_data_with_gym opt-in.
 */
export default function GymRanking({ userId, gymId }: Props) {
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("sessions");

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

      // 2. Get all training log dates for each member (for streaks + counts)
      const { data: logs } = await supabase
        .from("training_logs")
        .select("user_id, date")
        .in("user_id", memberIds)
        .order("date", { ascending: false });

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
  }, [gymId, userId, supabase]);

  if (loading) return null;
  if (rows.length === 0) return null;

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

  const medals = ["🥇", "🥈", "🥉"];

  const getValue = (row: RankRow) =>
    mode === "sessions" ? row.total_sessions : row.current_streak;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          🏆 {t("gym.rankingTitle")}
        </h3>
        {myRank !== null && (
          <span className="text-xs text-gray-400">
            {t("gym.myRank", { n: myRank })}
          </span>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-3">
        {(["sessions", "streak"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              mode === m
                ? "bg-[#e94560] text-white"
                : "bg-zinc-800 text-gray-400 hover:text-white"
            }`}
          >
            {m === "sessions" ? t("gym.rankingSessions") : t("gym.rankingStreak")}
          </button>
        ))}
      </div>

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
                  ? "bg-[#e94560]/10 border border-[#e94560]/30"
                  : "bg-zinc-800/50"
              }`}
            >
              <span className="w-5 text-center text-xs font-bold text-gray-400 flex-shrink-0">
                {rank <= 3 ? medals[rank - 1] : rank}
              </span>
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(row.belt)}`}
                title={row.belt}
              />
              <span
                className={`flex-1 text-xs ${
                  isMe ? "text-[#e94560] font-semibold" : "text-gray-300"
                }`}
              >
                {isMe ? t("gym.rankingMe") : t("gym.rankingAnon")}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {val}{mode === "streak" && val > 0 ? "🔥" : ""}
              </span>
            </div>
          );
        })}

        {needsExtraRow && myRankIdx >= 0 && (
          <>
            <div className="text-center text-gray-600 text-xs py-0.5">•••</div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#e94560]/10 border border-[#e94560]/30">
              <span className="w-5 text-center text-xs font-bold text-gray-400 flex-shrink-0">
                {myRankIdx + 1}
              </span>
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(sorted[myRankIdx].belt)}`}
              />
              <span className="flex-1 text-xs text-[#e94560] font-semibold">
                {t("gym.rankingMe")}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {getValue(sorted[myRankIdx])}{mode === "streak" && getValue(sorted[myRankIdx]) > 0 ? "🔥" : ""}
              </span>
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-gray-600 mt-2.5">
        {t("gym.rankingFootnote")}
      </p>
    </div>
  );
}
