export default function TermsLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 w-52 bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-1/3 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-full bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </main>
    </div>
  );
}
