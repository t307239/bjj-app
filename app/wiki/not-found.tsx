import Link from "next/link";

/**
 * #22: BJJ-themed 404 page for the Wiki section.
 */
export default function WikiNotFound() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">🥋</div>

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          Page Not Found
        </h1>

        <p className="text-slate-400 mb-3 leading-relaxed">
          Looks like this technique got swept.
        </p>
        <p className="text-slate-500 text-sm mb-10">
          The page you&apos;re looking for doesn&apos;t exist — maybe it tapped out before you got here.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/wiki/en"
            className="inline-flex items-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 px-6 py-3 text-sm font-bold text-white transition-colors"
          >
            ← Back to BJJ Wiki
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 px-6 py-3 text-sm font-medium text-slate-300 transition-colors"
          >
            BJJ App Home
          </Link>
        </div>
      </div>
    </div>
  );
}
