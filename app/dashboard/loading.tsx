export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#1a1a2e]">
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
          <div className="h-8 w-64 bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-gray-800 rounded animate-pulse" />
        </div>

        {/* スタッツスケルトン (2×2グリッド) */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700"
            >
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700"
            >
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>

        {/* ログスケルトン */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-[#16213e] rounded-xl p-4 border border-gray-700"
            >
              <div className="h-5 w-32 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
