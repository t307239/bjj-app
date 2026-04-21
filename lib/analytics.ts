/**
 * Actionable KPI event tracking via Vercel Analytics.
 *
 * Events are directly tied to retention, conversion, viral, or legal metrics.
 * No noise. (AUDIT_FRAMEWORK §6)
 * Respects user cookie preferences — analytics events are suppressed when
 * the user has declined analytics cookies (GDPR/CCPA compliance).
 */
import { getCookiePreferences } from "@/components/CookieConsent";

type KpiEvent =
  | "training_logged"          // DAU / retention
  | "pro_upgrade_click"        // conversion
  | "referral_shared"          // viral coefficient
  | "technique_added"          // engagement
  | "gym_lead_click"           // B2B pipeline
  | "ai_coach_generated"       // AI coach usage (cache_hit | fresh)
  | "milestone_share"          // viral share on achievement
  | "monthly_share"            // viral share on monthly summary
  | "tab_viewed"               // profile tab engagement
  | "safety_banner_dismissed"  // legal/UX: user acknowledged danger-technique warning
  | "safety_banner_wiki_click" // content funnel: wiki link from safety banner → Axis 6
  | "pricing_upgrade_click"    // conversion: pricing page CTA click
  // §6 Telemetry: Funnel tracking events
  | "signup_completed"         // funnel: account created
  | "onboarding_profile_set"   // funnel: profile setup (belt, weight, etc.)
  | "first_training_logged"    // funnel: first ever training log
  | "feature_discovered"       // funnel: user explored a new feature (props: feature)
  | "csv_export_used"          // engagement: data export
  | "gym_member_invited"        // B2B funnel: gym owner invited member
  | "gym_joined"                // B2B funnel: student joined a gym
  | "training_shared"           // viral: training card shared/downloaded
  | "goal_set";                 // engagement: user set/updated a goal

/**
 * Fire a KPI event. Safe to call on the server (no-op).
 * Props are optional key-value pairs for segmentation.
 */
export function trackEvent(
  name: KpiEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;

  // Respect cookie preferences — suppress analytics when user declined
  const cookiePrefs = getCookiePreferences();
  if (cookiePrefs && !cookiePrefs.analytics) return;

  // Dynamically import to avoid SSR issues and keep bundle lean
  import("@vercel/analytics").then(({ track }) => {
    track(name, props ?? {});
  }).catch(() => {
    // Silent fail — analytics should never break the app
  });
}
