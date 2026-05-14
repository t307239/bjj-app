// z261i: ページ遷移時の loading skeleton。NavBar + Hero + 3 tier card のレイアウト概形を即時表示。
export default function PricingLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      {/* NavBar skeleton */}
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="h-10 w-2/3 max-w-md bg-white/10 rounded animate-pulse mx-auto mb-3" />
          <div className="h-4 w-1/2 max-w-sm bg-zinc-900/50 rounded animate-pulse mx-auto" />
        </div>

        {/* 3 tier card grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-zinc-900 rounded-xl border border-white/10 p-6 space-y-4"
            >
              <div className="h-6 w-24 bg-white/10 rounded animate-pulse" />
              <div className="h-10 w-32 bg-white/10 rounded animate-pulse" />
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-3 w-full bg-zinc-900/50 rounded animate-pulse"
                  />
                ))}
              </div>
              <div className="h-10 w-full bg-emerald-900/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
