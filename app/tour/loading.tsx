// z261i: ページ遷移時の loading skeleton。Tour page は NavBar + Hero + section grid。
export default function TourLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="h-10 w-2/3 max-w-md bg-white/10 rounded animate-pulse mx-auto mb-3" />
          <div className="h-4 w-1/2 max-w-sm bg-zinc-900/50 rounded animate-pulse mx-auto mb-6" />
          <div className="h-12 w-40 bg-emerald-900/30 rounded animate-pulse mx-auto" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-zinc-900 rounded-xl border border-white/10 p-6 space-y-3"
            >
              <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-full bg-zinc-900/50 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-zinc-900/50 rounded animate-pulse" />
              <div className="h-32 w-full bg-zinc-900/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
