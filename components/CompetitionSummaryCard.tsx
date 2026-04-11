"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { decodeCompNotes, type CompData } from "@/lib/trainingLogHelpers";

type MatchEntry = {
  id: string;
  date: string;
  notes: string;
};

type DecodedMatch = {
  id: string;
  date: string;
  comp: CompData;
  userNotes: string;
};

const BELT_COLORS: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-600 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-white/20",
};

const BELT_LABELS: Record<string, string> = {
  white: "White", blue: "Blue", purple: "Purple", brown: "Brown", black: "Black",
};

export default function CompetitionSummaryCard({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [matches, setMatches] = useState<DecodedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("training_logs")
          .select("id, date, notes")
          .eq("user_id", userId)
          .eq("type", "competition")
          .order("date", { ascending: false });
        if (cancelled) return;
        if (error) {
          console.error("CompetitionSummaryCard:fetch", error);
          setLoading(false);
          return;
        }
        const decoded: DecodedMatch[] = [];
        for (const row of (data ?? []) as MatchEntry[]) {
          const { comp, userNotes } = decodeCompNotes(row.notes ?? "");
          if (comp) {
            decoded.push({ id: row.id, date: row.date, comp, userNotes });
          }
        }
        setMatches(decoded);
      } catch (err) {
        console.error("CompetitionSummaryCard:fetch", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <div className="min-h-[120px] bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />;
  }

  // Empty state
  if (matches.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-white/8 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">🏆</p>
        <p className="text-sm text-gray-400">{t("competition.noCompetitions")}</p>
        <p className="text-xs text-gray-500 mt-1">{t("competition.noCompetitionsHint")}</p>
      </div>
    );
  }

  // Stats
  const wins = matches.filter((m) => m.comp.result === "win").length;
  const losses = matches.filter((m) => m.comp.result === "loss").length;
  const draws = matches.filter((m) => m.comp.result === "draw").length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Submission stats
  const subWins = matches.filter((m) => m.comp.result === "win" && m.comp.finish.trim() !== "").length;
  const decisionWins = wins - subWins;

  // Current win streak
  let currentStreak = 0;
  for (const m of matches) {
    if (m.comp.result === "win") currentStreak++;
    else break;
  }

  // Best streak
  let bestStreak = 0;
  let tempStreak = 0;
  for (const m of matches) {
    if (m.comp.result === "win") {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Recent 5 matches
  const recent = matches.slice(0, 5);

  const resultStyle: Record<string, string> = {
    win: "text-green-400",
    loss: "text-red-400",
    draw: "text-yellow-400",
  };
  const resultLabel: Record<string, string> = {
    win: "W",
    loss: "L",
    draw: "D",
  };

  return (
    <div className="bg-zinc-900/50 border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        🏆 {t("competition.title")}
      </h3>

      {/* Record bar: W-L-D */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-green-400">{wins}</span>
          <span className="text-xs text-gray-500">{t("competition.wins")}</span>
        </div>
        <span className="text-gray-600">-</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-red-400">{losses}</span>
          <span className="text-xs text-gray-500">{t("competition.losses")}</span>
        </div>
        <span className="text-gray-600">-</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-yellow-400">{draws}</span>
          <span className="text-xs text-gray-500">{t("competition.draws")}</span>
        </div>
        <div className="ml-auto text-right">
          <span className="text-lg font-bold text-white whitespace-nowrap">{winRate}%</span>
          <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">{t("competition.winRate")}</span>
        </div>
      </div>

      {/* Mini stat chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {subWins > 0 && (
          <span className="text-xs bg-zinc-800 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.bySubmission")}: {subWins}
          </span>
        )}
        {decisionWins > 0 && (
          <span className="text-xs bg-zinc-800 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.byDecision")}: {decisionWins}
          </span>
        )}
        {currentStreak >= 2 && (
          <span className="text-xs bg-green-900/60 text-green-300 px-2 py-1 rounded-full whitespace-nowrap">
            🔥 {t("competition.currentStreak").replace("{n}", String(currentStreak))}
          </span>
        )}
        {bestStreak >= 2 && currentStreak < bestStreak && (
          <span className="text-xs bg-zinc-800 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.bestStreak").replace("{n}", String(bestStreak))}
          </span>
        )}
      </div>

      {/* Recent matches */}
      <div className="space-y-2">
        {recent.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2"
          >
            {/* Result badge */}
            <span className={`text-xs font-bold w-5 text-center ${resultStyle[m.comp.result] ?? "text-gray-400"}`}>
              {resultLabel[m.comp.result] ?? "?"}
            </span>

            {/* Opponent + belt dot */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {m.comp.opponent_rank && BELT_COLORS[m.comp.opponent_rank] && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BELT_COLORS[m.comp.opponent_rank]}`} />
                )}
                <span className="text-sm text-white truncate">
                  {m.comp.opponent || "—"}
                </span>
              </div>
              {(m.comp.finish || m.comp.event) && (
                <p className="text-xs text-gray-500 truncate">
                  {[m.comp.finish, m.comp.event].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            {/* Gi/NoGi badge */}
            {m.comp.gi_type && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {m.comp.gi_type === "gi" ? "Gi" : m.comp.gi_type === "nogi" ? "No-Gi" : m.comp.gi_type}
              </span>
            )}

            {/* Date */}
            <span className="text-xs text-gray-600 whitespace-nowrap">{m.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
