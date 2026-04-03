// ── Dynamic motivational message based on last training date ─────────────────

type Props = {
  daysSince: number | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function DashboardMotivation({ daysSince, t }: Props) {
  if (daysSince === null) return null;

  const config: { emoji: string; msg: string; color: string } =
    daysSince === 0
      ? { emoji: "🏆", msg: t("dashboard.motivationTrainedToday"), color: "text-emerald-300" }
      : daysSince === 1
      ? { emoji: "💪", msg: t("dashboard.motivationTrainedYesterday"), color: "text-emerald-400" }
      : daysSince <= 3
      ? { emoji: "🎯", msg: t("dashboard.motivationGapDays", { n: daysSince }), color: "text-yellow-300" }
      : daysSince <= 7
      ? { emoji: "🥋", msg: t("dashboard.motivationGapWeek"), color: "text-orange-300" }
      : { emoji: "👊", msg: t("dashboard.motivationGapLong"), color: "text-red-300" };

  return (
    <div className="rounded-2xl border border-white/8 bg-zinc-900/40 px-5 py-4 flex items-center gap-4 mb-5">
      <span className="text-2xl flex-shrink-0">{config.emoji}</span>
      <p className={`text-sm font-medium leading-relaxed ${config.color}`}>{config.msg}</p>
    </div>
  );
}
