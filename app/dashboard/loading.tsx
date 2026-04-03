export default function DashboardLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      {/* ヘッダースケルトン */}
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* タイトルスケルトン */}
        <div className="mb-6">
          <div className="h-8 w-56 bg-white/10 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-zinc-900/50 rounded animate-pulse" />
        </div>

        {/* スタッツスケルトン (2×2グリッド) */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 text-center border border-white/10">
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-zinc-900/50 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 text-center border border-white/10">
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-zinc-900/50 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>

        {/* StreakProtect/StreakFreezeスケルトン */}
        <div className="h-12 bg-zinc-900 rounded-xl border border-white/10 animate-pulse mb-3" />

        {/* WeeklyStripスケルトン */}
        <div className="bg-zinc-900 rounded-xl px-4 py-3 border border-white/10 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-8 bg-zinc-900/50 rounded animate-pulse" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse" />
                <div className="h-2 w-3 bg-zinc-900/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* GoalTrackerスケルトン */}
        <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white/5 rounded-xl px-4 py-3">
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-2 w-full bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* PersonalBestsスケルトン (6 cards) */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3 text-center">
                <div className="h-5 w-6 bg-white/10 rounded animate-pulse mx-auto mb-1" />
                <div className="h-4 w-14 bg-white/10 rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-16 bg-zinc-900/50 rounded animate-pulse mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* カレンダースケルトン */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="flex justify-between mb-3">
            <div className="h-4 w-8 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-8 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-900/50 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* グラフスケルトン */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-3" />
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-white/10 rounded animate-pulse"
                style={{ height: `${30 + (i * 7) % 60}%` }}
              />
            ))}
          </div>
        </div>

        {/* TrainingTypeChartスケルトン */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="h-4 w-28 bg-white/10 rounded animate-pulse mb-3" />
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                  <div className="h-3 bg-white/10 rounded animate-pulse" style={{ width: `${50 + i * 10}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CompetitionStatsスケルトン */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="flex justify-between mb-3">
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-16 bg-zinc-900/50 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-20 h-20 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
            <div className="flex-1 grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white/5 rounded-xl p-2 text-center">
                  <div className="h-6 w-6 bg-white/10 rounded animate-pulse mx-auto mb-1" />
                  <div className="h-3 w-8 bg-zinc-900/50 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-1 bg-white/10 rounded animate-pulse" />
        </div>

        {/* ログスケルトン */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-white/10">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-2" />
              <div className="h-4 w-20 bg-zinc-900/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
