"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function WikiTagError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="wiki.lang.tags.tag.error" />;
}
