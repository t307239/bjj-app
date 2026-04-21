import Link from "next/link";

type FocusTechnique = {
  id: string;
  name: string;
  category: string | null;
  mastery_level: number;
};

type Props = {
  techniques: FocusTechnique[];
  weekPracticeCount: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const MASTERY_COLORS = [
  "bg-zinc-600",       // 0 = Learning
  "bg-amber-500",      // 1 = Drilling
  "bg-emerald-500",    // 2 = Sparring
  "bg-cyan-400",       // 3 = Mastered
];

export default function TechniqueFocusCard({ techniques, weekPracticeCount, t }: Props) {
  const displayTechniques = techniques.slice(0, 3);
  const overflow = techniques.length - 3;

  return (
    <div className="mb-5 bg-zinc-900/40 border border-amber-500/15 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <h3 className="text-sm font-bold text-zinc-200">
            {t("focus.title")}
          </h3>
        </div>
        <Link
          href="/techniques"
          className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
        >
          {t("focus.manage")}
        </Link>
      </div>

      {techniques.length === 0 ? (
        /* Empty state — guide user to pin techniques */
        <Link
          href="/techniques"
          className="flex flex-col items-center justify-center py-6 rounded-xl bg-zinc-800/30 border border-dashed border-zinc-700/50 hover:border-amber-500/30 transition-colors group"
        >
          <span className="text-2xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">📌</span>
          <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
            {t("focus.emptyTitle")}
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">
            {t("focus.emptyHint")}
          </p>
        </Link>
      ) : (
        <>
          {/* Technique list */}
          <div className="space-y-2">
            {displayTechniques.map((tech) => {
              const masteryIdx = Math.min(tech.mastery_level, 3);
              return (
                <div
                  key={tech.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/50"
                >
                  {/* Mastery dot */}
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${MASTERY_COLORS[masteryIdx]}`}
                    title={t(`focus.mastery${masteryIdx}`)}
                  />
                  {/* Name + category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {tech.name}
                    </p>
                    {tech.category && (
                      <p className="text-[11px] text-zinc-500 truncate">
                        {tech.category}
                      </p>
                    )}
                  </div>
                  {/* Mastery badge */}
                  <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                    {t(`focus.mastery${masteryIdx}`)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Overflow */}
          {overflow > 0 && (
            <Link
              href="/techniques"
              className="block mt-2 text-center text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
            >
              {t("focus.more", { n: overflow })}
            </Link>
          )}

          {/* Weekly practice hint */}
          <div className="mt-3 pt-3 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500">
              {weekPracticeCount > 0
                ? t("focus.weekCount", { n: weekPracticeCount })
                : t("focus.weekNone")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
