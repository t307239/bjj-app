"use client";

/**
 * global-error.tsx — Root-level error boundary (Next.js App Router)
 *
 * Catches errors that escape all nested error.tsx boundaries,
 * including failures in the root layout.tsx itself.
 * Must define its own <html> and <body> tags since layout is bypassed.
 *
 * (AUDIT_FRAMEWORK §21 — Observability: prevents "白い画面" on catastrophic failure)
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for Vercel log drain / Sentry if configured
    console.error("[GlobalError]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#09090b", margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            textAlign: "center",
            color: "#f4f4f5",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#71717a", fontSize: "0.875rem", marginBottom: "1.5rem", maxWidth: "28rem" }}>
            An unexpected error occurred. Your training data is safe.
            {error.digest && (
              <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#52525b" }}>
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#3f3f46",
              color: "#f4f4f5",
              border: "none",
              borderRadius: "9999px",
              padding: "0.5rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.background = "#52525b"; }}
            onMouseOut={(e) => { (e.target as HTMLElement).style.background = "#3f3f46"; }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
