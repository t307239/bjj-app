import Link from "next/link";
import AvatarImage from "@/components/AvatarImage";
import TimeGreeting from "@/components/TimeGreeting";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  belt: string;
  stripeCount: number;
  streak: number;
  hasFirstLog: boolean;
  trainedToday: boolean;
  todayStr: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function HeroCard({
  displayName,
  avatarUrl,
  belt,
  stripeCount,
  streak,
  hasFirstLog,
  trainedToday,
  todayStr,
  t,
}: Props) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-4 mb-5">
      {/* Row 1: identity + avatar/belt pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shrink-0">
            <span className="text-base font-black text-zinc-900">柔</span>
          </div>
          <div className="min-w-0">
            <TimeGreeting displayName={displayName} />
            <p className="text-gray-400 text-xs mt-0.5 break-words leading-tight">
              {streak >= 7
                ? `🔥 ${t("dashboard.streakDaysStraight", { n: streak })}`
                : streak >= 3
                  ? `🎯 ${t("dashboard.streakDaysStraight", { n: streak })}`
                  : streak >= 1
                    ? t("dashboard.streakCardLogToday")
                    : hasFirstLog
                      ? t("dashboard.streakCardKeepRolling")
                      : t("dashboard.streakCardStartFresh")}
            </p>
          </div>
        </div>
        {/* Avatar or belt pill — always visible */}
        {avatarUrl ? (
          <AvatarImage
            src={avatarUrl}
            alt={displayName}
            className="w-9 h-9 rounded-full border border-white/20 shrink-0 object-cover"
            priority
          />
        ) : (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-zinc-900/60 border border-white/10 rounded-full px-3 py-1.5">
            <span className="text-xs font-bold text-zinc-400 tracking-widest uppercase">
              {belt}
            </span>
            {stripeCount > 0 && (
              <div className="flex gap-0.5">
                {Array.from({ length: stripeCount }).map((_, i) => (
                  <div key={i} className="w-1 h-3 bg-white/70 rounded-full" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Row 2: Log CTA — 未記録時のみ */}
      {!trainedToday && (
        <Link
          href={`?addLog=${todayStr}`}
          className="mt-3 flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/30"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t("training.logSession")}
        </Link>
      )}
    </div>
  );
}
