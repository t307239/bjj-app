export default function RecordDetailLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-8 w-8 bg-white/10 rounded animate-pulse" />
          <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Date + type */}
        <div className="flex items-center gap-3">
          <div className="h-6 w-28 bg-white/10 rounded animate-pulse" />
          <div className="h-5 w-16 bg-white/10 rounded-full animate-pulse" />
        </div>
        {/* Stats row */}
        <div className="flex gap-4">
          <div className="h-16 w-24 bg-zinc-900 rounded-xl animate-pulse" />
          <div className="h-16 w-24 bg-zinc-900 rounded-xl animate-pulse" />
          <div className="h-16 w-24 bg-zinc-900 rounded-xl animate-pulse" />
        </div>
        {/* Notes */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 space-y-2">
          <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse" />
        </div>
        {/* Techniques */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 space-y-2">
          <div className="h-5 w-24 bg-white/10 rounded animate-pulse mb-3" />
          <div className="h-8 w-full bg-white/10 rounded animate-pulse" />
          <div className="h-8 w-full bg-white/10 rounded animate-pulse" />
        </div>
      </main>
    </div>
  );
}
