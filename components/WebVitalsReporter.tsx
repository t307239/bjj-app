"use client";

/**
 * WebVitalsReporter — Core Web Vitals measurement + Sentry reporting
 *
 * Uses Next.js built-in useReportWebVitals to capture:
 * - LCP (Largest Contentful Paint) — target < 2.5s
 * - CLS (Cumulative Layout Shift) — target < 0.1
 * - INP (Interaction to Next Paint) — target < 200ms
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 *
 * Metrics are forwarded to Sentry for monitoring and alerting.
 * Vercel SpeedInsights (already in layout.tsx) provides the dashboard view.
 */

import { useReportWebVitals } from "next/web-vitals";
import * as Sentry from "@sentry/nextjs";

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Send to Sentry as custom measurement
    const tags: Record<string, string> = {
      metric_id: metric.id,
      metric_name: metric.name,
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
