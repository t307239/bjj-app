export default function TechniquesLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-6 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 統計バースケルトン */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          <div className="flex items-center gap-4 mb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 text-center">
                <div className="h-6 w-10 bg-white/10 rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-14 bg-zinc-900/50 rounded animate-pulse mx-auto" />
              </div>
            ))}
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full animate-pulse" />
        </div>

        {/* ヘッダー + ソートスケルトン */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-28 bg-white/10 rounded animate-pulse" />
            <div className="h-6 w-20 bg-zinc-900/50 rounded-lg animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-white/10 rounded-lg animate-pulse" />
        </div>

        {/* 検索バースケルトン */}
        <div className="h-10 w-full bg-zinc-900 rounded-xl border border-white/10 animate-pulse mb-3" />

        {/* カテゴリフィルタースケルトン */}
        <div className="flex gap-2 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-16 bg-zinc-900 border border-white/10 rounded-full animate-pulse flex-shrink-0" />
          ))}
        </div>

        {/* テクニックカードスケルトン */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 border border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-4 w-36 bg-white/10 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-zinc-900/50 rounded-full animate-pulse" />
                  </div>
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <div key={s} className="w-4 h-4 bg-zinc-900/50 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 ml-3">
                  <div className="w-6 h-6 bg-zinc-900/50 rounded animate-pulse" />
                  <div className="w-6 h-6 bg-zinc-900/50 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
