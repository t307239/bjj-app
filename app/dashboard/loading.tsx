export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] pb-20 sm:pb-0">
      {/* ヘッダースケルトン */}
      <div className="bg-[#16213e] border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥋</span>
            <div className="h-5 w-20 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* タイトルスケルトン */}
        <div className="mb-6">
          <div className="h-8 w-56 bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-gray-800 rounded animate-pulse" />
        </div>

        {/* スタッツスケルトン (2×2グリッド) */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>

        {/* GoalTrackerスケルトン */}
        <div className="bg-[#16213e] rounded-xl border border-gray-700 mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="h-4 w-24 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-gray-800/40 rounded-xl px-4 py-3">
                <div className="h-4 w-32 bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-2 w-full bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* カルンダースケルトン */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
          <div className="flex justify-between mb-3">
            <div className="h-4 w-8 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-8 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* グラフスケルトン */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
          <div className="h-4 w-32 bg-gray-700 rounded animate-pulse mb-3" />
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-700 rounded animate-pulse"
                style={{ height: `${30 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>

        {/* ログスケルトン */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
              <div className="h-5 w-32 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
