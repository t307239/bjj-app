export default function SkillMapLoading() {
  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* NavBar skeleton */}
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-6 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-zinc-900/60">
        <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
        <div className="flex-1" />
      </div>
      {/* Canvas skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400 animate-pulse">Loading skill map…</p>
        </div>
      </div>
    </div>
  );
}
