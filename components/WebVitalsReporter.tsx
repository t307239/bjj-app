"use client";

/**
 * WebVitalsReporter — Core Web Vitals RUM (Real User Monitoring)
 *
 * Uses Next.js built-in useReportWebVitals to capture:
 * - LCP (Largest Contentful Paint) — target < 2.5s
 * - CLS (Cumulative Layout Shift) — target < 0.1
 * - INP (Interaction to Next Paint) — target < 200ms
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 *
 * Metrics are forwarded to Sentry with page-level tagging for RUM analysis.
 * Tags include: page path, connection type, device category.
 * Vercel SpeedInsights (already in layout.tsx) provides the dashboard view.
 */

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

/** Classify device by viewport width */
function getDeviceCategory(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Get connection type from Navigator API */
function getConnectionType(): string {
  if (typeof navigator === "undefined") return "unknown";
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return conn?.effectiveType ?? "unknown";
}

export default function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    const tags: Record<string, string> = {
      metric_id: metric.id,
      metric_name: metric.name,
      page: pathname ?? "/",
      device: getDeviceCategory(),
      connection: getConnectionType(),
    };

    // Rating: good / needs-improvement / poor
    if ("rating" in metric && typeof metric.rating === "string") {
      tags.rating = metric.rating;
    }

    Sentry.metrics.distribution(
      `web_vitals.${metric.name.toLowerCase()}`,
      metric.value,
      {
        unit: metric.name === "CLS" ? "none" : "millisecond",
        tags,
      },
    );

    // Log poor metrics for debugging
    if (
      "rating" in metric &&
      metric.rating === "poor"
    ) {
      Sentry.captureMessage(
        `Poor Web Vital: ${metric.name} = ${metric.value.toFixed(1)}`,
        {
          level: "warning",
          tags,
          extra: {
            navigationType: metric.navigationType,
            value: metric.value,
          },
        },
      );
    }
  });

  return null;
}
