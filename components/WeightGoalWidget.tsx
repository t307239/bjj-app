"use client";

import { useLocale } from "@/lib/i18n";
import Link from "next/link";

interface Props {
  targetWeight: number;
  targetDate: string | null; // YYYY-MM-DD
  latestWeight?: number | null;
}

export default function WeightGoalWidget({ targetWeight, targetDate, latestWeight }: Props) {
  const { t } = useLocale();

  const diff = latestWeight != null ? latestWeight - targetWeight : null;
  const daysRemaining = targetDate
    ? Math.ceil((new Date(targetDate + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const reached = diff != null && Math.abs(diff) < 0.5;

  return (
    <Link
      href="/profile?tab=body"
      className="flex items-center justify-between gap-3 bg-zinc-900 border border-amber-400/20 rounded-xl px-4 py-3 hover:border-amber-400/40 active:scale-[0.98] transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg flex-shrink-0">🎯</span>
        <div className="min-w-0">
          <p className="text-xs text-zinc-400 font-medium">{t("body.targetWeightTitle")}</p>
          <p className="text-sm font-bold text-amber-400 tabular-nums">
            {targetWeight}{t("body.weightUnit")}
            {diff != null && !reached && (
              <span className="text-xs font-normal text-zinc-400 ml-1">
                ({diff > 0 ? "-" : "+"}{Math.abs(diff).toFixed(1)}{t("body.weightUnit")})
              </span>
            )}
            {reached && (
              <span className="text-xs font-semibold text-emerald-400 ml-2">🎉</span>
            )}
          </p>
        </div>
      </div>
      {daysRemaining != null && daysRemaining > 0 && (
        <span className="text-xs text-zinc-400 flex-shrink-0 tabular-nums whitespace-nowrap">
          {t("body.targetDaysLeft").replace("{n}", String(daysRemaining))}
        </span>
      )}
      {daysRemaining != null && daysRemaining <= 0 && (
        <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">
          {t("body.targetDateReached")}
        </span>
      )}
    </Link>
  );
}
