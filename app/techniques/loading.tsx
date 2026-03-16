export default function TechniquesLoading() {
  return (
    <div className="min-h-screen bg-[#1a1a2e]">
      <div className="bg-[#16213e] border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-6 w-24 bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-8 bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-36 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
              <div className="h-5 w-40 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-24 bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
