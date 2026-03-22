export default function LoginLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥋</div>
          <div className="h-7 w-48 bg-white/10 rounded animate-pulse mx-auto mb-2" />
          <div className="h-4 w-36 bg-zinc-900/50 rounded animate-pulse mx-auto" />
        </div>
        <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-12 bg-white/10 rounded-xl animate-pulse" />
        </div>
        <div className="h-3 w-56 bg-zinc-900/50 rounded animate-pulse mx-auto mt-6" />
      </div>
    </main>
  );
}
