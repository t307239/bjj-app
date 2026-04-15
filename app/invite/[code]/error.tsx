"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function InviteCodeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="invite.code.error" />;
}
