export default function SettingsLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-5">
        <div className="h-5 w-20 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse mb-5" />
        <div className="space-y-4">
          <div className="h-24 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />
          <div className="h-16 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />
          <div className="h-16 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />
          <div className="h-20 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
