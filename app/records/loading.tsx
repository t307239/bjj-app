export default function RecordsLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
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
        <div className="h-6 w-32 bg-white/10 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-white/10">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-2" />
              <div className="h-4 w-full bg-zinc-900/50 rounded animate-pulse mb-1" />
              <div className="h-4 w-3/4 bg-zinc-900/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
