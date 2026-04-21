"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/formatDate";
import { clientLogger } from "@/lib/clientLogger";

type CompGoal = {
  id: string;
  name: string;
  date: string;
  notes: string;
};

type Props = {
  userId: string;
  isPro?: boolean;
};

/**
 * Recommend weekly training hours based on days until competition
 * and current weekly session count.
 *
 * Realistic competition preparation (based on actual BJJ competitor norms):
 * - ≤7 days  → taper: 4-6h (light drilling, game plan review, recovery)
 * - ≤14 days → peak: current × 1.2 (sharpen, no new techniques)
 * - ≤30 days → ramp-up: 12-16h/week (6+ sessions, hard sparring)
 * - ≤60 days → build: 10-14h/week (5-6 sessions, volume + intensity)
 * - >60 days → base: 8-12h/week (4-5 sessions, technique + conditioning)
 *
 * Hours are adjusted upward if the user already trains more than the baseline.
 */
function getTrainingRecommendation(
  daysLeft: number,
  weeklySessionCount: number,
  t: (key: string, vars?: Record<string, string | number>) => string
): { hours: string; label: string; phase: string; tip: string } {
  const currentHoursEstimate = weeklySessionCount * 1.5; // ~1.5h per session avg

  if (daysLeft <= 0) {
    return {
      hours: "-",
      label: t("compGoal.phaseEvent"),
      phase: "event",
      tip: t("compGoal.tipEvent"),
    };
  }
  if (daysLeft <= 7) {
    // Taper: reduce to ~50-60% of current volume
    const taperLow = Math.max(4, Math.round(currentHoursEstimate * 0.5));
    const taperHigh = Math.max(6, Math.round(currentHoursEstimate * 0.6));
    return {
      hours: `${taperLow}-${taperHigh}`,
      label: t("compGoal.phaseTaper"),
      phase: "taper",
      tip: t("compGoal.tipTaper"),
    };
  }
  if (daysLeft <= 14) {
    // Peak: current + 20%, cap at ~18h
    const peakLow = Math.max(8, Math.round(currentHoursEstimate));
    const peakHigh = Math.min(18, Math.max(12, Math.round(currentHoursEstimate * 1.2)));
    return {
      hours: `${peakLow}-${peakHigh}`,
      label: t("compGoal.phasePeak"),
      phase: "peak",
      tip: t("compGoal.tipPeak"),
    };
  }
  if (daysLeft <= 30) {
    // Ramp-up: 12-16h baseline, push higher if user already trains a lot
    const rampLow = Math.max(12, Math.round(currentHoursEstimate * 1.1));
    const rampHigh = Math.max(16, Math.round(currentHoursEstimate * 1.3));
    return {
      hours: `${rampLow}-${rampHigh}`,
      label: t("compGoal.phaseRampUp"),
      phase: "ramp",
      tip: t("compGoal.tipRampUp"),
    };
  }
  if (daysLeft <= 60) {
    // Build: 10-14h baseline
    const buildLow = Math.max(10, Math.round(currentHoursEstimate * 1.0));
    const buildHigh = Math.max(14, Math.round(currentHoursEstimate * 1.15));
    return {
      hours: `${buildLow}-${buildHigh}`,
      label: t("compGoal.phaseBuild"),
      phase: "build",
      tip: t("compGoal.tipBuild"),
    };
  }
  // Base: 8-12h baseline
  const baseLow = Math.max(8, Math.round(currentHoursEstimate * 0.9));
  const baseHigh = Math.max(12, Math.round(currentHoursEstimate * 1.1));
  return {
    hours: `${baseLow}-${baseHigh}`,
    label: t("compGoal.phaseBase"),
    phase: "base",
    tip: t("compGoal.tipBase"),
  };
}

const PHASE_COLORS: Record<string, string> = {
  event: "text-yellow-400",
  taper: "text-blue-400",
  peak: "text-red-400",
  ramp: "text-orange-400",
  build: "text-emerald-400",
  base: "text-zinc-400",
};

const PHASE_BG: Record<string, string> = {
  event: "bg-yellow-500/10 border-yellow-500/20",
  taper: "bg-blue-500/10 border-blue-500/20",
  peak: "bg-red-500/10 border-red-500/20",
  ramp: "bg-orange-500/10 border-orange-500/20",
  build: "bg-emerald-500/10 border-emerald-500/20",
  base: "bg-zinc-800/50 border-white/10",
};

export default function CompetitionCountdown({ userId, isPro = false }: Props) {
  const { t, locale } = useLocale();
  // useMemo to keep a stable reference — createClient() returns a new object each call,
  // which would cause infinite re-renders if used in useCallback deps
  const supabase = useMemo(() => createClient(), []);

  const [goals, setGoals] = useState<CompGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [weeklySessionCount, setWeeklySessionCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      const [goalsRes, weekRes] = await Promise.all([
        supabase
          .from("competition_goals")
          .select("id, name, date, notes")
          .eq("user_id", userId)
          .order("date", { ascending: true }),
        // Get recent 4 weeks of sessions to estimate weekly avg
        supabase
          .from("training_logs")
          .select("date", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte(
            "date",
            new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
          ),
      ]);

      if (goalsRes.error) {
        clientLogger.error("compgoal_loadgoals_error", {}, goalsRes.error.message);
        setErrorMsg(goalsRes.error.message);
        return;
      }
      setGoals((goalsRes.data ?? []) as CompGoal[]);

      // Weekly average = total in 4 weeks / 4, minimum 2 for new users
      const totalSessions = weekRes.count ?? 0;
      setWeeklySessionCount(Math.max(Math.round(totalSessions / 4), 2));
    } catch (err) {
      clientLogger.error("compgoal_loadgoals_network_error", {}, err);
      setErrorMsg("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleSave = async () => {
    if (!nameInput.trim() || !dateInput) return;
    setErrorMsg(null);

    // Duplicate check: same name + same date (excluding current edit target)
    const isDuplicate = goals.some(
      (g) =>
        g.name === nameInput.trim() &&
        g.date === dateInput &&
        g.id !== editingId
    );
    if (isDuplicate) {
      setErrorMsg(t("compGoal.duplicateError"));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("competition_goals")
          .update({ name: nameInput.trim(), date: dateInput })
          .eq("id", editingId);
        if (error) {
          clientLogger.error("compgoal_update_error", {}, error.message);
          setErrorMsg(error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from("competition_goals")
          .insert({ user_id: userId, name: nameInput.trim(), date: dateInput });
        if (error) {
          clientLogger.error("compgoal_insert_error", {}, error.message);
          setErrorMsg(error.message);
          return;
        }
      }
      setNameInput("");
      setDateInput("");
      setShowForm(false);
      setEditingId(null);
      await loadGoals();
    } catch (err) {
      clientLogger.error("compgoal_handlesave_network_error", {}, err);
      setErrorMsg("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    // Optimistic: remove immediately, rollback on error
    const snapshot = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const { error } = await supabase
        .from("competition_goals")
        .delete()
        .eq("id", id);
      if (error) {
        clientLogger.error("compgoal_delete_error", {}, error.message);
        setErrorMsg(error.message);
        setGoals(snapshot);
        return;
      }
    } catch (err) {
      clientLogger.error("compgoal_handledelete_network_error", {}, err);
      setErrorMsg("Failed to delete");
      setGoals(snapshot);
    }
  };

  const startEdit = (goal: CompGoal) => {
    setEditingId(goal.id);
    setNameInput(goal.name);
    setDateInput(goal.date);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4 mb-5 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-3" />
        <div className="h-8 bg-zinc-800 rounded w-2/3" />
      </div>
    );
  }

  // Filter: only show future + today competitions, plus recently passed (≤7 days)
  const now = Date.now();
  const activeGoals = goals.filter((g) => {
    const diff = Math.ceil(
      (new Date(g.date + "T12:00:00").getTime() - now) / 86400000
    );
    return diff >= -7;
  });

  return (
    <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-2xl mb-5 overflow-hidden shadow-lg shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
          <span>🏆</span>
          {t("compGoal.title")}
        </h4>
        <button type="button"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setNameInput("");
            setDateInput("");
          }}
          className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95"
        >
          {showForm ? t("training.cancel") : t("compGoal.add")}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-white/10 bg-zinc-900/50">
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t("compGoal.namePlaceholder")}
                maxLength={100}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div className="w-[140px] flex-shrink-0">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>
          {errorMsg && (
            <p className="text-xs text-red-400 mb-2">{errorMsg}</p>
          )}
          <div className="flex gap-2">
            <button type="button"
              onClick={handleSave}
              disabled={saving || !nameInput.trim() || !dateInput}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-bold py-2 rounded-lg transition-colors active:scale-95"
            >
              {saving
                ? t("body.saving")
                : editingId
                  ? t("compGoal.update")
                  : t("compGoal.save")}
            </button>
            <button type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm py-2 rounded-lg transition-colors active:scale-95"
            >
              {t("training.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Competition List */}
      {activeGoals.length === 0 && !showForm ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-zinc-500">{t("compGoal.empty")}</p>
          <p className="text-xs text-zinc-600 mt-1 mb-3">{t("compGoal.emptyHint")}</p>
          <button type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            {t("compGoal.add")}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {activeGoals.map((goal) => {
            const daysLeft = Math.ceil(
              (new Date(goal.date + "T12:00:00").getTime() - now) / 86400000
            );
            const rec = getTrainingRecommendation(daysLeft, weeklySessionCount, t);
            const isPast = daysLeft < 0;
            const isToday = daysLeft === 0;

            return (
              <div
                key={goal.id}
                className={`px-4 py-3 ${isPast ? "opacity-60" : ""}`}
              >
                {/* Row 1: Name + Days */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white truncate">
                      {goal.name}
                    </span>
                    {isToday && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                        {t("compGoal.today")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isPast && !isToday && (
                      <span className="text-lg font-bold text-amber-400 tabular-nums whitespace-nowrap">
                        {daysLeft}
                        <span className="text-xs font-normal text-zinc-400 ml-0.5">
                          {t("compGoal.daysUnit")}
                        </span>
                      </span>
                    )}
                    {isPast && (
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {t("compGoal.passed")}
                      </span>
                    )}
                    <button type="button"
                      onClick={() => startEdit(goal)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
                      aria-label="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button type="button"
                      onClick={() => handleDelete(goal.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Row 2: Date */}
                <p className="text-xs text-zinc-500 mb-2">
                  {formatDateShort(goal.date + "T12:00:00", locale)}
                </p>

                {/* Row 3: AI Training Recommendation (only for future comps, Pro users) */}
                {isPro && !isPast && (
                  <div
                    className={`rounded-lg border px-3 py-2 ${PHASE_BG[rec.phase] || PHASE_BG.base}`}
                  >
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${PHASE_COLORS[rec.phase] || PHASE_COLORS.base}`}
                        >
                          {rec.label}
                        </span>
                        {rec.hours !== "-" && (
                          <span className="text-xs text-zinc-300 whitespace-nowrap">
                            {t("compGoal.recommendedHours", { hours: rec.hours })}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {rec.tip}
                    </p>
                  </div>
                )}

                {/* Free user teaser */}
                {!isPro && !isPast && daysLeft <= 30 && (
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                    <p className="text-xs text-amber-500/70">
                      🔒 {t("compGoal.proTeaser")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
