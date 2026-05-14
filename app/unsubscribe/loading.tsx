// z261i: ページ遷移時の loading skeleton。Unsubscribe は token 検証 + minimal action UI。
export default function UnsubscribeLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="bg-zinc-900 rounded-xl border border-white/10 p-8 text-center space-y-4">
          <div className="h-6 w-40 bg-white/10 rounded animate-pulse mx-auto" />
          <div className="h-4 w-full bg-zinc-900/50 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-zinc-900/50 rounded animate-pulse mx-auto" />
          <div className="h-10 w-40 bg-emerald-900/30 rounded animate-pulse mx-auto" />
        </div>
      </main>
    </div>
  );
}
