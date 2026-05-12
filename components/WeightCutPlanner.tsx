"use client";

/**
 * WeightCutPlanner — Pro feature: smart weight cut guidance.
 * Given current weight, target weight, and competition date,
 * generates a phased plan with weekly milestones and phase-specific advice.
 */

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";
import { computeWeightCutPlan } from "@/lib/weightCutPlan";

type Props = {
  currentWeight: number; // latest logged weight (kg)
  targetWeight: number;  // goal weight (kg)
  targetDate: string;    // YYYY-MM-DD (competition/weigh-in date)
};

type Phase = {
  name: string;
  startDay: number;
  endDay: number;
  advice: string;
  color: string;
};

type Milestone = {
  weekNum: number;
  date: string;
  targetKg: number;
};

export default function WeightCutPlanner({ currentWeight, targetWeight, targetDate }: Props) {
  const { t } = useLocale();

  const plan = useMemo(() => {
    // Pure milestone math lives in lib/weightCutPlan.ts (unit-tested).
    // Returns null when target date already passed.
    const core = computeWeightCutPlan(currentWeight, targetWeight, targetDate);
    if (!core) return null;

    // Already at or below target — show "done" state, no phase breakdown needed.
    if (core.alreadyDone) {
      return { ...core, phases: [], currentPhaseIdx: 0, onTrack: true };
    }

    // Phase breakdown (locale-aware advice text — kept here because t() is
    // React hook context):
    // Phase 1: Normal training + clean eating (most of the time)
    // Phase 2: Water loading (7-5 days before)
    // Phase 3: Water cut (3-1 days before)
    // Phase 4: Weigh-in day
    const phases: Phase[] = [];
    const totalDays = core.totalDays;

    if (totalDays > 7) {
      phases.push({
        name: t("weightCut.phaseNormal"),
        startDay: 0,
        endDay: Math.max(0, totalDays - 7),
        advice: t("weightCut.phaseNormalAdvice"),
        color: "bg-emerald-500",
      });
    }
    if (totalDays > 3) {
      phases.push({
        name: t("weightCut.phaseWaterLoad"),
        startDay: Math.max(0, totalDays - 7),
        endDay: Math.max(0, totalDays - 3),
        advice: t("weightCut.phaseWaterLoadAdvice"),
        color: "bg-blue-500",
      });
    }
    if (totalDays > 1) {
      phases.push({
        name: t("weightCut.phaseWaterCut"),
        startDay: Math.max(0, totalDays - 3),
        endDay: totalDays - 1,
        advice: t("weightCut.phaseWaterCutAdvice"),
        color: "bg-amber-500",
      });
    }
    phases.push({
      name: t("weightCut.phaseWeighIn"),
      startDay: totalDays - 1,
      endDay: totalDays,
      advice: t("weightCut.phaseWeighInAdvice"),
      color: "bg-red-500",
    });

    const elapsed = 0;
    const currentPhaseIdx = phases.findIndex((p) => elapsed >= p.startDay && elapsed < p.endDay);

    return {
      ...core,
      phases,
      currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
      onTrack: true,
    };
  }, [currentWeight, targetWeight, targetDate, t]);

  // Past competition date
  if (!plan) return null;

  // Already at target
  if (plan.alreadyDone) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <p className="text-sm text-emerald-400 font-medium">{t("weightCut.alreadyAtTarget")}</p>
        </div>
      </div>
    );
  }

  const progressPct = plan.weightDiff > 0
    ? Math.max(0, Math.min(100, ((currentWeight - targetWeight - plan.weightDiff) / -plan.weightDiff) * 100))
    : 100;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚖️</span>
        <h4 className="text-xs font-bold text-white uppercase tracking-wide">{t("weightCut.title")}</h4>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-zinc-500 whitespace-nowrap">{t("weightCut.tolose")}</p>
          <p className="text-lg font-bold text-amber-400 tabular-nums whitespace-nowrap">
            {plan.weightDiff.toFixed(1)}<span className="text-xs font-normal text-zinc-500 ml-0.5">{t("body.weightUnit")}</span>
          </p>
        </div>
        <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-zinc-500 whitespace-nowrap">{t("weightCut.daysLeft")}</p>
          <p className="text-lg font-bold text-white tabular-nums whitespace-nowrap">
            {plan.totalDays}<span className="text-xs font-normal text-zinc-500 ml-0.5">{t("weightCut.daysUnit")}</span>
          </p>
        </div>
        <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-zinc-500 whitespace-nowrap">{t("weightCut.weeklyRate")}</p>
          <p className={`text-lg font-bold tabular-nums whitespace-nowrap ${plan.isAggressive ? "text-red-400" : "text-white"}`}>
            {(plan.weeklyRate ?? 0).toFixed(1)}<span className="text-xs font-normal text-zinc-500 ml-0.5">{t("body.weightUnit")}/{t("weightCut.weekUnit")}</span>
          </p>
        </div>
      </div>

      {/* Aggressive cut warning */}
      {plan.isAggressive && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-400 font-medium">⚠️ {t("weightCut.aggressiveWarning")}</p>
        </div>
      )}

      {/* Phase timeline */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-2">{t("weightCut.phases")}</p>
        <div className="flex h-3 gap-0.5 rounded-lg overflow-hidden mb-2">
          {plan.phases.map((phase, i) => {
            const width = ((phase.endDay - phase.startDay) / plan.totalDays) * 100;
            return (
              <div
                key={i}
                className={`${phase.color} ${i === plan.currentPhaseIdx ? "opacity-100" : "opacity-40"} transition-opacity`}
                style={{ width: `${Math.max(width, 3)}%` }}
                title={phase.name}
              />
            );
          })}
        </div>
        <div className="space-y-1.5">
          {plan.phases.map((phase, i) => (
            <div key={i} className={`flex items-start gap-2 ${i === plan.currentPhaseIdx ? "opacity-100" : "opacity-50"}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${phase.color}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">{phase.name}</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{phase.advice}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly milestones (show up to 4 weeks) */}
      {plan.milestones.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">{t("weightCut.milestones")}</p>
          <div className="flex flex-wrap gap-2">
            {plan.milestones.slice(0, 8).map((ms) => (
              <div key={ms.weekNum} className="bg-zinc-800/50 rounded-lg px-2.5 py-1.5 min-w-[56px] text-center">
                <p className="text-[10px] text-zinc-500">{t("weightCut.week")} {ms.weekNum}</p>
                <p className="text-xs font-bold text-white tabular-nums">{ms.targetKg}{t("body.weightUnit")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
