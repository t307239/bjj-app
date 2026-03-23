"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

type RankRow = {
  student_id: string;
  display_name: string | null;
  belt: string;
  total_sessions: number;
  isMe: boolean;
};

type Props = {
  userId: string;
  gymId: string;
};

function beltDot(belt: string): string {
  switch (belt) {
    case "black":  return "bg-zinc-900 border border-zinc-500";
    case "brown":  return "bg-amber-800";
    case "purple": return "bg-purple-600";
    case "blue":   return "bg-blue-500";
    default:       return "bg-gray-300"; // white
  }
}

/**
 * Shows a ranked session-count leaderboard for all opt-in members
 * in the same gym. Only visible when share_data_with_gym = true.
 *
 * Incentivises opt-in: "Share → see how you rank among your training partners."
 */
export default function GymRanking({ userId, gymId }: Props) {
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

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

      // 2. Get total session counts for each member
      const { data: logs } = await supabase
        .from("training_logs")
        .select("user_id")
        .in("user_id", memberIds);

      // 3. Count per member
      const countMap: Record<string, number> = {};
      for (const id of memberIds) countMap[id] = 0;
      for (const log of logs ?? []) {
        countMap[log.user_id] = (countMap[log.user_id] ?? 0) + 1;
      }

      // 4. Build ranked rows
      const ranked: RankRow[] = profiles
        .map((p) => ({
          student_id: p.id,
          display_name: null, // anonymized — show belt only for privacy
          belt: p.belt ?? "white",
          total_sessions: countMap[p.id] ?? 0,
          isMe: p.id === userId,
        }))
        .sort((a, b) => b.total_sessions - a.total_sessions);

      if (!cancelled) {
        setRows(ranked);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [gymId, userId, supabase]);

  if (loading) return null; // silent load
  if (rows.length === 0) return null;

  // Find my rank (1-indexed)
  const myRankIdx = rows.findIndex((r) => r.isMe);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  // Show top 10 + ensure the user's own row is always visible
  const showRows = rows.slice(0, 10);
  const needsExtraRow =
    myRankIdx >= 10 &&
    !showRows.some((r) => r.isMe);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
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

      <div className="space-y-1.5">
        {showRows.map((row, idx) => {
          const rank = idx + 1;
          const isMe = row.isMe;
          return (
            <div
              key={row.student_id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                isMe
                  ? "bg-[#e94560]/10 border border-[#e94560]/30"
                  : "bg-zinc-800/50"
              }`}
            >
              {/* Rank number / medal */}
              <span className="w-5 text-center text-xs font-bold text-gray-400 flex-shrink-0">
                {rank <= 3 ? medals[rank - 1] : rank}
              </span>

              {/* Belt dot */}
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(row.belt)}`}
                title={row.belt}
              />

              {/* Name or "You" */}
              <span
                className={`flex-1 text-xs ${
                  isMe ? "text-[#e94560] font-semibold" : "text-gray-300"
                }`}
              >
                {isMe ? t("gym.rankingMe") : t("gym.rankingAnon")}
              </span>

              {/* Session count */}
              <span className="text-xs text-gray-400 font-mono">
                {row.total_sessions}
              </span>
            </div>
          );
        })}

        {/* User's own row if outside top 10 */}
        {needsExtraRow && myRankIdx >= 0 && (
          <>
            <div className="text-center text-gray-600 text-xs py-0.5">•••</div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#e94560]/10 border border-[#e94560]/30">
              <span className="w-5 text-center text-xs font-bold text-gray-400 flex-shrink-0">
                {myRankIdx + 1}
              </span>
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${beltDot(rows[myRankIdx].belt)}`}
              />
              <span className="flex-1 text-xs text-[#e94560] font-semibold">
                {t("gym.rankingMe")}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {rows[myRankIdx].total_sessions}
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
