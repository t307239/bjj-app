"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { decodeCompNotes, type CompData } from "@/lib/trainingLogHelpers";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import EmptyState from "@/components/EmptyState";
import { clientLogger } from "@/lib/clientLogger";

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

const BELT_BG: Record<string, string> = {
  white: "bg-gray-100",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-gray-800",
};

type Props = {
  userId: string;
  isPro?: boolean;
};

export default function CompetitionSummaryCard({ userId, isPro = false }: Props) {
  const { t } = useLocale();
  const [matches, setMatches] = useState<DecodedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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
          clientLogger.error("competitionsummarycard.fetch", {}, error);
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
        clientLogger.error("competitionsummarycard.fetch", {}, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Computed analytics
  const analytics = useMemo(() => {
    const wins = matches.filter((m) => m.comp.result === "win");
    const losses = matches.filter((m) => m.comp.result === "loss");
    const draws = matches.filter((m) => m.comp.result === "draw");
    const total = matches.length;
    const winRate = total > 0 ? Math.round((wins.length / total) * 100) : 0;

    // Sub/decision breakdown
    const subWins = wins.filter((m) => m.comp.finish.trim() !== "");
    const decisionWins = wins.length - subWins.length;

    // Winning technique frequency
    const finishMap = new Map<string, number>();
    for (const m of subWins) {
      const finish = m.comp.finish.trim();
      if (finish) finishMap.set(finish, (finishMap.get(finish) ?? 0) + 1);
    }
    const topFinishes = [...finishMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Win rate by opponent belt
    const beltStats = new Map<string, { wins: number; total: number }>();
    for (const m of matches) {
      const belt = m.comp.opponent_rank?.trim();
      if (!belt || !BELT_COLORS[belt]) continue;
      if (!beltStats.has(belt)) beltStats.set(belt, { wins: 0, total: 0 });
      const entry = beltStats.get(belt)!;
      entry.total++;
      if (m.comp.result === "win") entry.wins++;
    }
    const beltWinRates = [...beltStats.entries()]
      .map(([belt, { wins: bwins, total: btotal }]) => ({
        belt,
        wins: bwins,
        total: btotal,
        rate: btotal > 0 ? Math.round((bwins / btotal) * 100) : 0,
      }))
      .sort((a, b) => {
        const order = ["white", "blue", "purple", "brown", "black"];
        return order.indexOf(a.belt) - order.indexOf(b.belt);
      });

    // Current & best streak
    let currentStreak = 0;
    for (const m of matches) {
      if (m.comp.result === "win") currentStreak++;
      else break;
    }
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

    // Gi vs NoGi split
    const giMatches = matches.filter((m) => m.comp.gi_type === "gi");
    const nogiMatches = matches.filter((m) => m.comp.gi_type === "nogi");
    const giWins = giMatches.filter((m) => m.comp.result === "win").length;
    const nogiWins = nogiMatches.filter((m) => m.comp.result === "win").length;

    return {
      wins: wins.length,
      losses: losses.length,
      draws: draws.length,
      total,
      winRate,
      subWins: subWins.length,
      decisionWins,
      topFinishes,
      beltWinRates,
      currentStreak,
      bestStreak,
      giMatches: giMatches.length,
      giWins,
      nogiMatches: nogiMatches.length,
      nogiWins,
      recent: matches.slice(0, 5),
    };
  }, [matches]);

  if (loading) {
    return <div className="min-h-[120px] bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl animate-pulse" />;
  }

  // Empty state
  if (matches.length === 0) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-6">
        <EmptyState
          emoji="🏆"
          title={t("competition.noCompetitions")}
          description={t("competition.noCompetitionsHint")}
          compact
        />
      </div>
    );
  }

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
    <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-5">
      {/* Header */}
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        🏆 {t("competition.title")}
      </h3>

      {/* Record bar: W-L-D */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-green-400">{analytics.wins}</span>
          <span className="text-xs text-zinc-400">{t("competition.wins")}</span>
        </div>
        <span className="text-zinc-500">-</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-red-400">{analytics.losses}</span>
          <span className="text-xs text-zinc-400">{t("competition.losses")}</span>
        </div>
        <span className="text-zinc-500">-</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-yellow-400">{analytics.draws}</span>
          <span className="text-xs text-zinc-400">{t("competition.draws")}</span>
        </div>
        <div className="ml-auto text-right">
          <span className="text-lg font-bold text-white whitespace-nowrap">{analytics.winRate}%</span>
          <span className="text-xs text-zinc-400 ml-1 whitespace-nowrap">{t("competition.winRate")}</span>
        </div>
      </div>

      {/* Mini stat chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {analytics.subWins > 0 && (
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.bySubmission")}: {analytics.subWins}
          </span>
        )}
        {analytics.decisionWins > 0 && (
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.byDecision")}: {analytics.decisionWins}
          </span>
        )}
        {analytics.currentStreak >= 2 && (
          <span className="text-xs bg-green-900/60 text-green-300 px-2 py-1 rounded-full whitespace-nowrap">
            🔥 {t("competition.currentStreak", { n: analytics.currentStreak })}
          </span>
        )}
        {analytics.bestStreak >= 2 && analytics.currentStreak < analytics.bestStreak && (
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap">
            {t("competition.bestStreak", { n: analytics.bestStreak })}
          </span>
        )}
      </div>

      {/* ═══ PRO SECTION: Enhanced analytics ═══ */}
      {isPro ? (
        <>
          {/* Gi vs NoGi split */}
          {(analytics.giMatches > 0 || analytics.nogiMatches > 0) && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-1.5">{t("competition.giNogiSplit")}</p>
              <div className="flex gap-2">
                {analytics.giMatches > 0 && (
                  <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-400 font-medium whitespace-nowrap">Gi</p>
                    <p className="text-sm text-white font-bold whitespace-nowrap">
                      {analytics.giWins}W / {analytics.giMatches}
                      <span className="text-xs text-zinc-500 ml-1 font-normal">
                        ({analytics.giMatches > 0 ? Math.round((analytics.giWins / analytics.giMatches) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                )}
                {analytics.nogiMatches > 0 && (
                  <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-orange-400 font-medium whitespace-nowrap">No-Gi</p>
                    <p className="text-sm text-white font-bold whitespace-nowrap">
                      {analytics.nogiWins}W / {analytics.nogiMatches}
                      <span className="text-xs text-zinc-500 ml-1 font-normal">
                        ({analytics.nogiMatches > 0 ? Math.round((analytics.nogiWins / analytics.nogiMatches) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top winning techniques */}
          {analytics.topFinishes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-1.5">{t("competition.topFinishes")}</p>
              <div className="space-y-1.5">
                {analytics.topFinishes.map(([finish, count]) => {
                  const pct = analytics.subWins > 0 ? Math.round((count / analytics.subWins) * 100) : 0;
                  return (
                    <div key={finish} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-300 flex-1 truncate">{finish}</span>
                      <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500/70 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Win rate by opponent belt */}
          {analytics.beltWinRates.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-1.5">{t("competition.winRateByBelt")}</p>
              <div className="flex gap-2 flex-wrap">
                {analytics.beltWinRates.map(({ belt, wins: bwins, total: btotal, rate }) => (
                  <div key={belt} className="bg-zinc-800/50 rounded-lg px-3 py-2 min-w-[64px]">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${BELT_BG[belt] ?? "bg-gray-500"}`} />
                      <span className="text-xs text-zinc-400 capitalize whitespace-nowrap">{belt}</span>
                    </div>
                    <p className="text-sm font-bold text-white whitespace-nowrap">
                      {rate}%
                      <span className="text-[10px] text-zinc-500 font-normal ml-0.5">({bwins}/{btotal})</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Free user: blur teaser for enhanced analytics */
        matches.length >= 3 && (
          <div className="relative mb-4 overflow-hidden rounded-xl">
            <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs text-zinc-500">{t("competition.topFinishes")}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-zinc-300">Armbar: 3</span>
                  <span className="text-xs text-zinc-300">Triangle: 2</span>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                <p className="text-xs text-zinc-500">{t("competition.winRateByBelt")}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-zinc-300">{t("competition.whiteBelt")}</span>
                  <span className="text-xs text-zinc-300">{t("competition.blueBelt")}</span>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/30">
              <Link
                href="/profile#upgrade"
                className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-amber-500/20"
                onClick={() => trackEvent("pricing_upgrade_click", { feature: "competition_analytics" })}
              >
                {t("competition.upgradeAnalytics")}
              </Link>
            </div>
          </div>
        )
      )}

      {/* Match history */}
      <div>
        {/* Header with View All toggle */}
        {matches.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300 mb-2 transition-colors"
          >
            {showAll ? t("competition.hideAll") : t("competition.viewAll")} ({matches.length})
          </button>
        )}

        <div className="space-y-2">
          {(showAll ? matches : analytics.recent).map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2"
            >
              <span className={`text-xs font-bold w-5 text-center ${resultStyle[m.comp.result] ?? "text-zinc-400"}`}>
                {resultLabel[m.comp.result] ?? "?"}
              </span>
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
                  <p className="text-xs text-zinc-400 truncate">
                    {[m.comp.finish, m.comp.event].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {m.comp.gi_type && (
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  {m.comp.gi_type === "gi" ? "Gi" : m.comp.gi_type === "nogi" ? "No-Gi" : m.comp.gi_type}
                </span>
              )}
              <span className="text-xs text-zinc-500 whitespace-nowrap">{m.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
