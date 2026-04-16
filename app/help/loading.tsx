export default function HelpLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-64 bg-white/10 rounded animate-pulse" />
        {/* FAQ items */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-white/10">
            <div className="h-5 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-4 w-full bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </main>
    </div>
  );
}
