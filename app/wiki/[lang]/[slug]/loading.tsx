/**
 * #39: Skeleton Loader for Wiki Article Page
 * Displayed while the article data is being fetched (ISR miss / first load).
 * Uses animate-pulse for smooth shimmer effect.
 */
export default function WikiPageLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#0f172a] text-white">
      {/* Fake sticky header */}
      <div className="border-b border-white/10 bg-[#0f172a]/95 py-3 px-4">
        <div className="mx-auto max-w-7xl flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-slate-800 animate-pulse" />
          <span className="text-slate-500">/</span>
          <div className="h-4 w-24 rounded bg-slate-800 animate-pulse" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 lg:flex lg:gap-14">
        {/* ── Main content skeleton ── */}
        <main className="flex-1 min-w-0">
          {/* Badge */}
          <div className="mb-4 h-6 w-28 rounded-full bg-slate-800 animate-pulse" />

          {/* Title (2 lines) */}
          <div className="mb-3 space-y-2.5">
            <div className="h-9 w-4/5 rounded-lg bg-slate-800 animate-pulse" />
            <div className="h-9 w-3/5 rounded-lg bg-slate-800 animate-pulse" />
          </div>

          {/* Meta: read time + date */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-3.5 w-20 rounded bg-slate-800/70 animate-pulse" />
            <div className="h-3.5 w-24 rounded bg-slate-800/70 animate-pulse" />
          </div>

          {/* Lang switcher */}
          <div className="mb-6 h-8 w-36 rounded-full bg-slate-800 animate-pulse" />

          {/* Description / intro blockquote */}
          <div className="mb-8 h-16 w-full rounded-lg bg-slate-800/60 animate-pulse" />

          {/* Article body — alternating paragraph skeletons */}
          <div className="space-y-3">
            {/* H2 */}
            <div className="h-6 w-2/5 rounded bg-slate-800 animate-pulse mt-8" />
            <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-11/12 rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />

            {/* H2 */}
            <div className="h-6 w-1/3 rounded bg-slate-800 animate-pulse mt-10" />
            <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-11/12 rounded bg-slate-800/50 animate-pulse" />

            {/* List skeleton */}
            <div className="ml-4 mt-3 space-y-2">
              {[80, 65, 90, 55, 75].map((w, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded bg-slate-800/40 animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>

            {/* H2 */}
            <div className="h-6 w-2/5 rounded bg-slate-800 animate-pulse mt-10" />
            <div className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-slate-800/50 animate-pulse" />
          </div>

          {/* CTA skeleton */}
          <div className="mt-12 h-44 w-full rounded-2xl bg-slate-800/40 animate-pulse" />

          {/* Related articles skeleton */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="h-3 w-32 rounded bg-slate-800 animate-pulse mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          </div>
        </main>

        {/* ── Sidebar skeleton (lg+) ── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-2.5 animate-pulse">
            <div className="h-3 w-20 rounded bg-slate-800 mb-4" />
            {[100, 75, 90, 60, 80, 55].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded bg-slate-800/50"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
