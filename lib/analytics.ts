/**
 * Actionable KPI event tracking via Vercel Analytics.
 *
 * Only 5 events are tracked — all directly tied to retention,
 * conversion, or viral metrics. No noise. (AUDIT_FRAMEWORK §6)
 */

type KpiEvent =
  | "training_logged"      // DAU / retention
  | "pro_upgrade_click"    // conversion
  | "referral_shared"      // viral coefficient
  | "technique_added"      // engagement
  | "gym_lead_click"       // B2B pipeline
  | "ai_coach_generated"   // AI coach usage (cache_hit | fresh)
  | "milestone_share"      // viral share on achievement
  | "tab_viewed";          // profile tab engagement

/**
 * Fire a KPI event. Safe to call on the server (no-op).
 * Props are optional key-value pairs for segmentation.
 */
export function trackEvent(
  name: KpiEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;

  // Dynamically import to avoid SSR issues and keep bundle lean
  import("@vercel/analytics").then(({ track }) => {
    track(name, props ?? {});
  }).catch(() => {
    // Silent fail — analytics should never break the app
  });
}
