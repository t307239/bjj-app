"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { decodeRollNotes, type RollMeta } from "@/lib/trainingLogHelpers";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";

const UNLOCK_AT = 20;

type RollRecord = {
  id: string;
  type: string;
  date: string;
  roll: RollMeta | null;
  partner_username: string | null;
};

type BeltKey = "white" | "blue" | "purple" | "brown" | "black";
type FocusKey = "flow" | "positional" | "hard" | "survival";
type SizeKey = "heavier" | "similar" | "lighter";

const BELT_ORDER: BeltKey[] = ["white", "blue", "purple", "brown", "black"];
const FOCUS_ORDER: FocusKey[] = ["flow", "positional", "hard", "survival"];
const SIZE_ORDER: SizeKey[] = ["heavier", "similar", "lighter"];

const BELT_COLOR: Record<BeltKey, string> = {
  white:  "bg-zinc-200",
  blue:   "bg-blue-500",
  purple: "bg-purple-500",
  brown:  "bg-amber-700",
  black:  "bg-zinc-100",
};
const FOCUS_EMOJI: Record<FocusKey, string> = {
  flow: "🌊", positional: "🎯", hard: "🔥", survival: "🛡️",
};
const FOCUS_COLOR: Record<FocusKey, string> = {
  flow: "bg-sky-500", positional: "bg-emerald-500", hard: "bg-orange-500", survival: "bg-rose-500",
};
const SIZE_COLOR: Record<SizeKey, string> = {
  heavier: "bg-red-500", similar: "bg-zinc-400", lighter: "bg-blue-400",
};

/** Build label maps using i18n t() — must be called inside the component */
function buildLabels(t: (key: string, vars?: Record<string, string | number>) => string) {
  const beltLabel: Record<BeltKey, string> = {
    white: t("rollAnalytics.beltWhite"), blue: t("rollAnalytics.beltBlue"),
    purple: t("rollAnalytics.beltPurple"), brown: t("rollAnalytics.beltBrown"),
    black: t("rollAnalytics.beltBlack"),
  };
  const focusLabel: Record<FocusKey, string> = {
    flow: t("rollAnalytics.focusFlow"), positional: t("rollAnalytics.focusPositional"),
    hard: t("rollAnalytics.focusHard"), survival: t("rollAnalytics.focusSurvival"),
  };
  const sizeLabel: Record<SizeKey, string> = {
    heavier: t("rollAnalytics.sizeHeavier"), similar: t("rollAnalytics.sizeSimilar"),
    lighter: t("rollAnalytics.sizeLighter"),
  };
  return { beltLabel, focusLabel, sizeLabel };
}

// ── Sub components ─────────────────────────────────────────────────────────────

function BarRow({
  label,
  count,
  total,
  color,
  badge,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  badge?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 flex-shrink-0 text-zinc-400 truncate">{badge ? `${badge} ${label}` : label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-zinc-300 font-mono tabular-nums">{count}</span>
      <span className="w-8 text-right text-zinc-500 font-mono tabular-nums">{pct}%</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-zinc-400 tracking-wide uppercase mb-2">{children}</p>
  );
}

// ── Weakness insight generator ─────────────────────────────────────────────────

function generateInsights(
  records: RollRecord[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  beltLabel: Record<BeltKey, string>,
): string[] {
  const insights: string[] = [];
  const withMeta = records.filter((r) => r.roll !== null);
  if (withMeta.length < UNLOCK_AT) return insights;

  // ① Belt survival rate
  const survivalByBelt: Record<string, { survival: number; total: number }> = {};
  for (const r of withMeta) {
    const belt = r.roll?.partner_belt;
    if (!belt) continue;
    if (!survivalByBelt[belt]) survivalByBelt[belt] = { survival: 0, total: 0 };
    survivalByBelt[belt].total++;
    if (r.roll?.focus === "survival") survivalByBelt[belt].survival++;
  }
  const highSurvival = Object.entries(survivalByBelt)
    .filter(([, v]) => v.total >= 3 && v.survival / v.total > 0.4)
    .sort(([, a], [, b]) => b.survival / b.total - a.survival / a.total);
  if (highSurvival.length > 0) {
    const [belt, data] = highSurvival[0];
    const pct = Math.round((data.survival / data.total) * 100);
    const label = beltLabel[belt as BeltKey] ?? belt;
    insights.push(`⚠️ ${t("rollAnalytics.insightSurvival", { pct, label })}`);
  }

  // ② Size disadvantage
  const heavierCount = withMeta.filter((r) => r.roll?.size_diff === "heavier").length;
  const heavierPct = Math.round((heavierCount / withMeta.length) * 100);
  if (heavierPct >= 50) {
    insights.push(`💪 ${t("rollAnalytics.insightHeavier", { pct: heavierPct })}`);
  }

  // ③ Flow vs Hard imbalance
  const flowCount = withMeta.filter((r) => r.roll?.focus === "flow").length;
  const hardCount = withMeta.filter((r) => r.roll?.focus === "hard").length;
  const total = withMeta.length;
  if (total >= 10) {
    if (flowCount / total > 0.6) {
      insights.push(`🌊 ${t("rollAnalytics.insightFlow")}`);
    } else if (hardCount / total > 0.5) {
      insights.push(`🔥 ${t("rollAnalytics.insightHard")}`);
    }
  }

  // ④ Positive: most-rolled belt
  const mostRolled = Object.entries(survivalByBelt)
    .sort(([, a], [, b]) => b.total - a.total)[0];
  if (mostRolled && mostRolled[1].total >= 5) {
    const label = beltLabel[mostRolled[0] as BeltKey] ?? mostRolled[0];
    const nonSurvivalPct = Math.round(((mostRolled[1].total - mostRolled[1].survival) / mostRolled[1].total) * 100);
    if (nonSurvivalPct >= 70) {
      insights.push(`✅ ${t("rollAnalytics.insightStrong", { label, pct: nonSurvivalPct })}`);
    }
  }

  return insights.slice(0, 3);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RollAnalyticsCard({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [records, setRecords] = useState<RollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("training_logs")
        .select("id, type, date, notes, partner_username")
        .eq("user_id", userId)
        .in("type", ["gi", "nogi"])
        .order("date", { ascending: false })
        .limit(500);
      if (error) clientLogger.error("rollanalyticscard.query", {}, error);

      if (data) {
        setRecords(
          data.map((row) => ({
            id: row.id,
            type: row.type,
            date: row.date,
            roll: decodeRollNotes(row.notes ?? "").roll,
            partner_username: row.partner_username ?? null,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const { beltLabel, focusLabel, sizeLabel } = buildLabels(t);

  const withMeta = records.filter((r) => r.roll !== null);
  const rollCount = withMeta.length;
  const remaining = Math.max(0, UNLOCK_AT - rollCount);
  const unlocked = rollCount >= UNLOCK_AT;

  // ── Aggregations ─────────────────────────────────────────────────────────────
  const beltCounts: Record<BeltKey, number> = { white: 0, blue: 0, purple: 0, brown: 0, black: 0 };
  const focusCounts: Record<FocusKey, number> = { flow: 0, positional: 0, hard: 0, survival: 0 };
  const sizeCounts: Record<SizeKey, number> = { heavier: 0, similar: 0, lighter: 0 };

  for (const r of withMeta) {
    if (r.roll?.partner_belt && r.roll.partner_belt in beltCounts) {
      beltCounts[r.roll.partner_belt as BeltKey]++;
    }
    if (r.roll?.focus && r.roll.focus in focusCounts) {
      focusCounts[r.roll.focus as FocusKey]++;
    }
    if (r.roll?.size_diff && r.roll.size_diff in sizeCounts) {
      sizeCounts[r.roll.size_diff as SizeKey]++;
    }
  }

  const insights = generateInsights(records, t, beltLabel);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 bg-zinc-900/50 p-5 mt-4 animate-pulse">
        <div className="h-4 w-32 bg-zinc-700 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-3 bg-zinc-800 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty / unlock gate ───────────────────────────────────────────────────────
  if (!unlocked) {
    const progress = Math.round((rollCount / UNLOCK_AT) * 100);
    return (
      <div className="rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 bg-zinc-900/50 p-5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📊</span>
          <h3 className="text-sm font-semibold text-white">{t("rollAnalytics.title")}</h3>
          <span className="ml-auto text-xs text-zinc-500">{rollCount} / {UNLOCK_AT}</span>
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          {t("rollAnalytics.unlockHint", { n: remaining })}
        </p>
        <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-1.5 text-right">
          {rollCount} {t("rollAnalytics.rollsLogged")}
        </p>
        <p className="text-xs text-zinc-500 mt-3 border-t border-white/5 pt-3">
          💡 {t("rollAnalytics.logTip")}
        </p>
      </div>
    );
  }

  // ── Full analytics ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 bg-zinc-900/50 p-5 mt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">📊</span>
        <h3 className="text-sm font-semibold text-white">{t("rollAnalytics.title")}</h3>
        <span className="ml-auto text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-medium">
          {rollCount} {t("rollAnalytics.rollsAnalyzed")}
        </span>
      </div>

      {/* Partner Belt */}
      <div>
        <SectionTitle>🥋 {t("rollAnalytics.partnerBelt")}</SectionTitle>
        <div className="space-y-1.5">
          {BELT_ORDER.map((belt) => (
            <BarRow
              key={belt}
              label={beltLabel[belt]}
              count={beltCounts[belt]}
              total={rollCount}
              color={BELT_COLOR[belt]}
            />
          ))}
        </div>
      </div>

      {/* Roll Focus */}
      <div>
        <SectionTitle>🎯 {t("rollAnalytics.rollFocus")}</SectionTitle>
        <div className="space-y-1.5">
          {FOCUS_ORDER.map((focus) => (
            <BarRow
              key={focus}
              label={focusLabel[focus]}
              count={focusCounts[focus]}
              total={rollCount}
              color={FOCUS_COLOR[focus]}
              badge={FOCUS_EMOJI[focus]}
            />
          ))}
        </div>
      </div>

      {/* Size Differential */}
      <div>
        <SectionTitle>⚖️ {t("rollAnalytics.sizeDiff")}</SectionTitle>
        <div className="space-y-1.5">
          {SIZE_ORDER.map((size) => (
            <BarRow
              key={size}
              label={sizeLabel[size]}
              count={sizeCounts[size]}
              total={rollCount}
              color={SIZE_COLOR[size]}
            />
          ))}
        </div>
      </div>

      {/* AI Weakness Insights (B-13) */}
      {insights.length > 0 && (
        <div className="border-t border-white/5 pt-4">
          <SectionTitle>🧠 {t("rollAnalytics.weaknessTitle")}</SectionTitle>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-xs text-zinc-300 leading-relaxed bg-zinc-800/60 rounded-lg px-3 py-2 border border-white/5">
                {insight}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
