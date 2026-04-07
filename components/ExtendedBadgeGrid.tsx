"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────────────────────

type BadgeData = {
  id: string;
  emoji: string;
  current: number;
  threshold: number;
  earned: boolean;
};

// ── ISO week key helper ──────────────────────────────────────────────────────

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid timezone edge
  // ISO week: find Thursday of the same week → determines the year
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Max consecutive weeks helper ─────────────────────────────────────────────

function maxConsecutiveWeeks(weeks: Set<string>): number {
  if (weeks.size === 0) return 0;
  const sorted = [...weeks].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [py, pw] = sorted[i - 1].replace("W", "").split("-").map(Number);
    const [cy, cw] = sorted[i].replace("W", "").split("-").map(Number);
    // consecutive: same year +1 week, or year boundary (week 52/53 → week 1)
    const isNext =
      (cy === py && cw === pw + 1) ||
      (cy === py + 1 && cw === 1 && pw >= 52);
    if (isNext) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

// ── Badge cell ───────────────────────────────────────────────────────────────

function BadgeCell({ badge }: { badge: BadgeData }) {
  const { t } = useLocale();
  const pct = badge.threshold > 0
    ? Math.min(100, Math.round((badge.current / badge.threshold) * 100))
    : 0;

  return (
    <div
      className={`rounded-xl p-3 border transition-all ${
        badge.earned
          ? "bg-gradient-to-b from-amber-600/20 to-orange-800/20 border-amber-500/30"
          : "bg-zinc-800/40 border-white/5"
      }`}
    >
      {/* Emoji + Name */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xl leading-none ${badge.earned ? "" : "grayscale opacity-40"}`}>
          {badge.earned ? badge.emoji : "🔒"}
        </span>
        <span
          className={`text-xs font-semibold leading-tight ${
            badge.earned ? "text-amber-200" : "text-zinc-400"
          }`}
        >
          {t(`extendedBadges.${badge.id}.name`)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-zinc-700/50 rounded-full h-1 overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            badge.earned ? "bg-amber-400" : "bg-zinc-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Progress text */}
      <p className="text-[10px] leading-snug text-zinc-500 tabular-nums">
        {badge.earned
          ? t("extendedBadges.earned")
          : t(`extendedBadges.${badge.id}.progress`, {
              current: badge.current,
              threshold: badge.threshold,
            })}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExtendedBadgeGrid({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [logsRes, techCountRes] = await Promise.all([
        supabase
          .from("training_logs")
          .select("type, date, partner_username")
          .eq("user_id", userId),
        supabase
          .from("techniques")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      const logs = (logsRes.data ?? []) as {
        type: string;
        date: string;
        partner_username: string | null;
      }[];
      const techniqueCount = techCountRes.count ?? 0;

      // Training type diversity
      const hasGi = logs.some((l) => l.type === "gi");
      const hasNoGi = logs.some((l) => l.type === "nogi");

      // Partner sessions
      const partnerSessions = logs.filter(
        (l) => l.partner_username?.trim()
      ).length;

      // Competition sessions
      const competitionSessions = logs.filter(
        (l) => l.type === "competition"
      ).length;

      // Max sessions in any single calendar month
      const monthCounts: Record<string, number> = {};
      for (const l of logs) {
        const key = l.date.slice(0, 7); // "YYYY-MM"
        monthCounts[key] = (monthCounts[key] ?? 0) + 1;
      }
      const maxMonthly =
        Object.values(monthCounts).length > 0
          ? Math.max(...Object.values(monthCounts))
          : 0;

      // Max consecutive ISO weeks with at least 1 session
      const weekSet = new Set<string>();
      for (const l of logs) {
        weekSet.add(isoWeekKey(l.date));
      }
      const consecutiveWeeks = maxConsecutiveWeeks(weekSet);

      const BADGE_DEFS: Omit<BadgeData, "earned">[] = [
        {
          id: "gi_nogi",
          emoji: "🥋",
          current: (hasGi ? 1 : 0) + (hasNoGi ? 1 : 0),
          threshold: 2,
        },
        {
          id: "technique_1",
          emoji: "📝",
          current: Math.min(techniqueCount, 1),
          threshold: 1,
        },
        {
          id: "technique_10",
          emoji: "🧠",
          current: Math.min(techniqueCount, 10),
          threshold: 10,
        },
        {
          id: "technique_30",
          emoji: "🎓",
          current: Math.min(techniqueCount, 30),
          threshold: 30,
        },
        {
          id: "partner_5",
          emoji: "🤼",
          current: Math.min(partnerSessions, 5),
          threshold: 5,
        },
        {
          id: "competition",
          emoji: "🏆",
          current: Math.min(competitionSessions, 1),
          threshold: 1,
        },
        {
          id: "weekly_4",
          emoji: "📅",
          current: Math.min(consecutiveWeeks, 4),
          threshold: 4,
        },
        {
          id: "monthly_8",
          emoji: "🔥",
          current: Math.min(maxMonthly, 8),
          threshold: 8,
        },
      ];

      setBadges(
        BADGE_DEFS.map((b) => ({
          ...b,
          earned: b.current >= b.threshold,
        }))
      );
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="h-48 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse mt-4" />
    );
  }

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5 mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🏅</span>
        <h3 className="text-sm font-semibold text-white">
          {t("extendedBadges.title")}
        </h3>
        <span className="ml-auto text-xs text-zinc-400 font-mono">
          {earnedCount} / {badges.length}
        </span>
      </div>

      {/* 2-column badge grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {badges.map((b) => (
          <BadgeCell key={b.id} badge={b} />
        ))}
      </div>

      {/* All earned celebration */}
      {earnedCount === badges.length && (
        <p className="mt-4 text-xs text-center text-amber-400 font-semibold">
          👑 {t("extendedBadges.allEarned")}
        </p>
      )}
    </div>
  );
}
