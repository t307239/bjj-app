import AvatarImage from "@/components/AvatarImage";
import TimeGreeting from "@/components/TimeGreeting";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  belt: string;
  stripeCount: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export default function HeroCard({
  displayName,
  avatarUrl,
  belt,
  stripeCount,
  t,
}: Props) {
  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-4 mb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shrink-0">
            <span className="text-base font-black text-zinc-900">柔</span>
          </div>
          <div className="min-w-0">
            <TimeGreeting displayName={displayName} />
            <p className="text-gray-400 text-xs mt-0.5 break-words leading-tight">
              {t("dashboard.streakCardKeepRolling")}
            </p>
          </div>
        </div>
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
    </div>
  );
}
