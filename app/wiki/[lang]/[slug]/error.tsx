"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logClientError } from "@/lib/logger";

/**
 * #43: Error Boundary for Wiki Article Pages
 * Catches rendering errors and shows a BJJ-themed recovery UI.
 * "Something went wrong on the mats."
 */
export default function WikiPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("wiki.page.error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-[#0f172a] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* BJJ icon */}
        <div className="text-7xl mb-6 select-none">🥋</div>

        <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Something went wrong on the mats.
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-2">
          Even the best black belts tap sometimes. This technique got scrambled — but we&apos;ll reset and try again.
        </p>

        {error.digest && (
          <p className="text-slate-500 text-xs font-mono mt-2 mb-6">
            ref: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-sm font-bold text-white transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-pink-500"
          >
            Try again
          </button>
          <Link
            href="/wiki/en"
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-pink-500"
          >
            Back to BJJ Wiki
          </Link>
        </div>

        {/* Motivational quote */}
        <p className="mt-8 text-xs text-slate-500 italic">
          &ldquo;A black belt is a white belt that never quit.&rdquo;
        </p>
      </div>
    </div>
  );
}
