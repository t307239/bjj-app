export default function LoginLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥋</div>
          <div className="h-7 w-48 bg-gray-700 rounded animate-pulse mx-auto mb-2" />
          <div className="h-4 w-36 bg-gray-800 rounded animate-pulse mx-auto" />
        </div>
        <div className="bg-[#16213e] rounded-2xl p-6 border border-gray-700 space-y-3">
          <div className="h-12 bg-gray-200/10 rounded-xl animate-pulse" />
          <div className="h-12 bg-gray-700/30 rounded-xl animate-pulse" />
        </div>
        <div className="h-3 w-56 bg-gray-800 rounded animate-pulse mx-auto mt-6" />
      </div>
    </main>
  );
}
