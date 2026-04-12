"use client";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-red-400 text-sm font-medium mb-2">
          {error.message || "Something went wrong"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
