"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function WikiSlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="wiki.lang.slug.error" />;
}
