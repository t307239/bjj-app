// z261i: ページ遷移時の loading skeleton。Contact page は form 中心の薄い構造。
export default function ContactLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-3" />
        <div className="h-4 w-3/4 bg-zinc-900/50 rounded animate-pulse mb-8" />

        <div className="bg-zinc-900 rounded-xl border border-white/10 p-6 space-y-4">
          <div className="h-4 w-20 bg-zinc-900/50 rounded animate-pulse" />
          <div className="h-10 w-full bg-zinc-900/50 rounded animate-pulse" />
          <div className="h-4 w-20 bg-zinc-900/50 rounded animate-pulse" />
          <div className="h-32 w-full bg-zinc-900/50 rounded animate-pulse" />
          <div className="h-10 w-32 bg-emerald-900/30 rounded animate-pulse" />
        </div>
      </main>
    </div>
  );
}
