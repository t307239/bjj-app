"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function DpaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="dpa.error" />;
}
