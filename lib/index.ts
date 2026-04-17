/**
 * lib/index.ts — Barrel export for core utilities
 *
 * Groups the most commonly imported pure utilities for cleaner imports:
 *   import { formatDateShort, getLogicalTrainingDate, trackEvent } from "@/lib";
 *
 * Excluded from barrel (import directly):
 * - database.types.ts (auto-generated types, import from "@/lib/database.types")
 * - i18n.tsx (contains JSX, import from "@/lib/i18n")
 * - useOnlineStatus.ts (React hook, import from "@/lib/useOnlineStatus")
 * - useUnsavedChanges.ts (React hook, import from "@/lib/useUnsavedChanges")
 * - webpush.ts (server-only, import from "@/lib/webpush")
 * - env.ts (server-only env validation, import from "@/lib/env")
 * - techniqueLogTypes.tsx (contains JSX, import from "@/lib/techniqueLogTypes")
 */

// ── Analytics ────────────────────────────────────────────────────────────────
export { trackEvent } from "./analytics";

// ── Date / Time ──────────────────────────────────────────────────────────────
export { formatDateShort, formatDateLong, formatRelativeTime, formatTime, formatNumber, formatMonthYear } from "./formatDate";
export { getLogicalTrainingDate } from "./logicalDate";
export { getUserTimezone, getLocalDateString, utcIsoToLocalDateString } from "./timezone";

// ── Training Helpers ─────────────────────────────────────────────────────────
export { TRAINING_TYPES } from "./trainingTypes";
export type { TrainingTypeValue } from "./trainingTypes";
export { calcBjjDuration, formatBjjDuration } from "./bjjDuration";
export {
  formatDuration,
  encodeCompNotes,
  decodeCompNotes,
  buildXShareUrl,
  BELT_RANKS,
  COMP_PREFIX,
} from "./trainingLogHelpers";
export type { TrainingEntry, CompData } from "./trainingLogHelpers";

// ── Skill Map ────────────────────────────────────────────────────────────────
export {
  wouldCreateCycle,
  getLayoutedNodes,
  masteryNodeClass,
  masterySelectedRing,
  dbNodeToRF,
  dbEdgeToRF,
  NODE_W,
  NODE_H,
} from "./skillMapUtils";

// ── Techniques ───────────────────────────────────────────────────────────────
export { BJJ_TECHNIQUE_SUGGESTIONS } from "./bjjTechniques";

// ── Validation ───────────────────────────────────────────────────────────────
export { parseBody } from "./validation";

// ── Notification ─────────────────────────────────────────────────────────────
export { isSilentHour, isOptimalSendTime, filterSendableSubscriptions } from "./notificationSafeHours";

// ── Browser Detection ────────────────────────────────────────────────────────
export { isInAppBrowser } from "./isInAppBrowser";

// ── Logging ──────────────────────────────────────────────────────────────────
export { logger } from "./logger";

// ── Haptics ──────────────────────────────────────────────────────────────────
export { hapticTap, hapticDouble, hapticSuccess, hapticNudge } from "./haptics";

// ── Rate Limiting ───────────────────────────────────────────────────────────
export { createRateLimiter } from "./rateLimit";

// ── SEO ─────────────────────────────────────────────────────────────────────
export { buildBreadcrumbJsonLd } from "./breadcrumb";

// ── Network ─────────────────────────────────────────────────────────────────
export { fetchWithRetry } from "./fetchWithRetry";
export type { RetryOptions } from "./fetchWithRetry";

// ── API Middleware ──────────────────────────────────────────────────────────
export { withApiTracking } from "./withApiTracking";

// ── Observability ──────────────────────────────────────────────────────────
export { SLO, ALERT_THRESHOLDS, REQUEST_ID_HEADER, generateRequestId } from "./errorBudget";

// ── Streak ─────────────────────────────────────────────────────────────────
export { calcStreak, calcStreakWithGrace, detectComeback, classifyEngagement } from "./streakUtils";

// ── Data Validation ───────────────────────────────────────────────────────
export {
  validateTrainingLog,
  validateBelt,
  validateStripe,
  validateWeight,
  sanitizeText,
  VALID_BELTS,
  LIMITS,
} from "./dataValidation";
export type { Belt } from "./dataValidation";

// ── Engagement Scoring ────────────────────────────────────────────────────
export { calculateEngagement, batchEngagementScores } from "./engagementScoring";
export type { EngagementInput, EngagementResult } from "./engagementScoring";

// ── Alert Routing ─────────────────────────────────────────────────────────
export { routeAlert, alertCritical, alertWarning, UPTIME_MONITORS } from "./alertRouter";
export type { Alert, AlertSeverity, AlertCategory, AlertRouteResult } from "./alertRouter";

// ── Data Export ──────────────────────────────────────────────────────────
export { buildUserDataExport, validateExportData } from "./dataExport";
export type { UserDataExport, DataExportFormat } from "./dataExport";

// ── Admin Metrics ────────────────────────────────────────────────────────
export { calcBeltDistribution, calcProRate, countActiveUsers, calcAvgSessionsPerUser } from "./adminMetrics";
export type { PlatformMetrics, BeltDistribution } from "./adminMetrics";

// ── CSRF Protection ─────────────────────────────────────────────────────
export { generateCsrfToken, setCsrfCookie, validateCsrf, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf";

// ── Performance Monitoring ──────────────────────────────────────────────
export { measureAsync, getMemorySnapshot, CacheHitTracker, PERF_BUDGETS } from "./perfMonitor";
export type { PerfMeasurement, PerfCategory } from "./perfMonitor";

// ── Feature Flags / A/B Testing ─────────────────────────────────────────
export { getVariant, isFeatureEnabled, getAllAssignments, EXPERIMENTS } from "./featureFlags";
export type { ExperimentName, Variant } from "./featureFlags";

// ── i18n Coverage ───────────────────────────────────────────────────────
export { flattenKeys, findMissingKeys, findExtraKeys, analyzeCoverage, generateCoverageSummary } from "./i18nCoverage";
export type { CoverageResult, CoverageSummary, LocaleCode } from "./i18nCoverage";

// ── Churn Prediction ────────────────────────────────────────────────────
export { predictChurnRisk, suggestWinBackAction, batchChurnPredictions } from "./churnPredictor";
export type { ChurnRisk, ChurnPrediction, WinBackAction } from "./churnPredictor";
