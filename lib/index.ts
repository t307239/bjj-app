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

// ── Deployment Guard ────────────────────────────────────────────────────
export {
  checkEnvVars,
  getAllRequiredEnvVars,
  validateHealthResponse,
  validateBuildManifest,
  aggregateChecks,
  formatReadinessSummary,
  REQUIRED_ENV_VARS,
} from "./deploymentGuard";
export type { DeployCheck, DeployReadiness, EnvCategory } from "./deploymentGuard";

// ── Cost Estimator ──────────────────────────────────────────────────────
export { estimateMonthlyCost, detectCostAnomalies, formatCostSummary, PRICING } from "./costEstimator";
export type { UsageMetrics, CostBreakdown, CostEstimate, CostAnomaly } from "./costEstimator";

// ── Design Tokens ───────────────────────────────────────────────────────
export {
  COLORS,
  BREAKPOINTS,
  SPACING,
  RADII,
  SHADOWS,
  Z_INDEX,
  ANIMATION,
  TYPOGRAPHY,
  isAboveBreakpoint,
  getCurrentBreakpoint,
} from "./designTokens";
export type { Breakpoint } from "./designTokens";

// ── Offline Queue ───────────────────────────────────────────────────────
export { OfflineQueue, MAX_QUEUE_SIZE, MAX_ATTEMPTS, BASE_RETRY_DELAY_MS } from "./offlineQueue";
export type { QueuedAction, QueuedActionType, SyncResult } from "./offlineQueue";

// ── Consent Manager ─────────────────────────────────────────────────────
export {
  createConsentRecord,
  isConsentValid,
  findExpiredConsents,
  buildConsentSummary,
  formatConsentAuditEntry,
  CONSENT_VERSIONS,
  CONSENT_MAX_AGE_DAYS,
  REQUIRED_CONSENTS,
} from "./consentManager";
export type { ConsentType, ConsentRecord, ConsentSummary } from "./consentManager";

// ── Uptime Monitor ──────────────────────────────────────────────────────
export {
  classifyStatus,
  createHealthCheck,
  calculateUptime,
  determineOverallStatus,
  formatUptimePercent,
  MONITOR_ENDPOINTS,
  RESPONSE_THRESHOLDS,
} from "./uptimeMonitor";
export type { ServiceStatus, HealthCheck, UptimeReport, StatusPage } from "./uptimeMonitor";

// ── Data Retention ──────────────────────────────────────────────────────
export {
  findPurgeCandidates,
  isWithinRetention,
  generateRetentionReport,
  getUserDeletableCategories,
  RETENTION_POLICIES,
} from "./dataRetention";
export type { DataCategory, RetentionPolicy, PurgeCandidate, RetentionReport } from "./dataRetention";

// ── Admin Search ────────────────────────────────────────────────────────
export {
  maskEmail,
  maskEmailPartial,
  buildUserSearchQuery,
  paginateResults,
  supabaseRange,
  buildLogFilter,
  formatAdminSummary,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from "./adminSearch";
export type { UserSearchFilters, PaginatedResult, AdminLogFilter } from "./adminSearch";

// ── Server Component Analysis ───────────────────────────────────────────
export {
  classifyComponent,
  calculateMigrationROI,
  createSCRatioSnapshot,
  isSCRatioHealthy,
  formatMigrationSummary,
  SC_BUDGET,
  CLIENT_PATTERNS,
  SERVER_PATTERNS,
} from "./serverComponentAnalysis";
export type { ComponentClassification, ComponentAnalysis, MigrationROI, SCRatioSnapshot } from "./serverComponentAnalysis";

// ── List Keyboard Navigation ────────────────────────────────────────────
export {
  getNextIndex,
  findByTypeAhead,
  keyToDirection,
  isSelectionKey,
  isEscapeKey,
  getItemId,
  buildContainerProps,
  buildItemProps,
  LIST_ITEM_ID_PREFIX,
  TYPEAHEAD_RESET_MS,
} from "./useListKeyNav";
export type { UseListKeyNavOptions, ListKeyNavResult, ContainerProps, ItemProps } from "./useListKeyNav";

// ── CSP Builder ─────────────────────────────────────────────────────────
export {
  generateNonce,
  buildCSPHeader,
  isValidSRIFormat,
  parseCSPViolation,
  formatCSPSummary,
  uint8ToBase64url,
  CSP_DIRECTIVES,
  TRUSTED_SCRIPT_DOMAINS,
  SRI_ALGORITHMS,
  NONCE_BYTES,
} from "./cspBuilder";
export type { CSPDirective, CSPConfig, CSPResult, SRIHash, CSPViolation } from "./cspBuilder";

// ── Synthetic Probe ─────────────────────────────────────────────────────
export {
  buildProbeReport,
  formatProbeSummary,
  shouldAlert,
  buildTelegramMessage,
  PROBE_CONFIG,
  DEFAULT_ALERT_CONFIG,
} from "./syntheticProbe";
export type { ProbeEndpoint, ProbeResult, ProbeReport, ProbeAlertConfig } from "./syntheticProbe";

// ── Gamification Engine ────────────────────────────────────────────────
export {
  calculateXP,
  calculateBadgeXP,
  getLevel,
  checkBadges,
  getEarnedBadges,
  getNextBadges,
  buildGamificationSummary,
  formatGamificationSummary,
  XP_RATES,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  BADGES,
} from "./gamificationEngine";
export type { UserStats, Badge, BadgeCategory, BadgeTier, LevelInfo, BadgeProgress, GamificationSummary } from "./gamificationEngine";

// ── Code Health Dashboard ──────────────────────────────────────────────
export {
  calculateCategoryScores,
  calculateHealthScore,
  classifyHealth,
  identifyTopIssues,
  buildHealthReport,
  formatHealthReport,
  HEALTH_WEIGHTS,
  GRADE_THRESHOLDS,
  PENALTIES,
} from "./codeHealthDashboard";
export type { CodeHealthMetrics, HealthGrade, HealthCategory, CodeHealthReport } from "./codeHealthDashboard";

// ── Rollback Guard ─────────────────────────────────────────────────────
export {
  compareDeployments,
  shouldRollback,
  formatRollbackDecision,
  ROLLBACK_THRESHOLDS,
} from "./rollbackGuard";
export type { DeploymentMetrics, RollbackDecision, RollbackCheck, DeploymentComparison } from "./rollbackGuard";

// ── Funnel Analytics ───────────────────────────────────────────────────
export {
  analyzeFunnel,
  classifyConversion,
  compareFunnels,
  getRecommendations,
  buildFunnelReport,
  formatFunnelReport,
  FUNNELS,
  CONVERSION_THRESHOLDS,
} from "./funnelAnalytics";
export type { FunnelStep, FunnelDefinition, StepMetrics, FunnelAnalysis, FunnelComparison } from "./funnelAnalytics";

// ── Responsive Validator ───────────────────────────────────────────────
export {
  validateLayout,
  checkBreakpointCoverage,
  calculateCoverage,
  buildResponsiveReport,
  getViewportCategory,
  formatResponsiveReport,
  VIEWPORT_PRESETS,
  TAILWIND_BREAKPOINTS,
  LAYOUT_RULES,
} from "./responsiveValidator";
export type { ViewportSize, LayoutMeasurement, LayoutIssue, BreakpointCoverage, ResponsiveReport } from "./responsiveValidator";

// ── Form Validator ─────────────────────────────────────────────────────
export {
  validateField,
  validateForm,
  getErrorAnnouncement,
  getFieldAriaProps,
  createRule,
  combineRules,
  formatValidationSummary,
  VALIDATION_RULES,
  ANNOUNCE_DELAY_MS,
} from "./formValidator";
export type { ValidationRule, FieldValidation, FormValidation, FormField } from "./formValidator";

// ── Plural Rules ───────────────────────────────────────────────────────
export {
  selectPlural,
  getPluralCategory,
  getOrdinalCategory,
  formatOrdinal,
  formatCount,
  formatCompact,
  isSupportedLocale,
  PLURAL_RULES,
  COUNT_FORMATS,
  EN_ORDINAL_SUFFIXES,
} from "./pluralRules";
export type { PluralCategory, SupportedLocale, PluralMessages, PluralRule, CountFormat } from "./pluralRules";

// ── Data Integrity Checker ─────────────────────────────────────────────
export {
  defineCheck,
  evaluateResults,
  getChecksForTable,
  getChecksByCategory,
  buildIntegrityReport,
  formatIntegrityReport,
  INTEGRITY_CHECKS,
  MAX_SAMPLES,
} from "./dataIntegrityChecker";
export type { IntegrityCheck, IntegrityCategory, CheckResult, IntegrityReport } from "./dataIntegrityChecker";

// Q-154: Legal — Compliance checker
export {
  runComplianceChecks,
  buildComplianceReport,
  getRequirementsByRegulation,
  formatComplianceReport,
  COMPLIANCE_REQUIREMENTS,
} from "./complianceChecker";
export type { ComplianceRequirement, Regulation, ComplianceState, ComplianceCheckResult, ComplianceReport } from "./complianceChecker";

// Q-155: Cost — Cost allocator
export {
  allocateUserCost,
  calculateLTV,
  calculateCAC,
  analyzeUnitEconomics,
  formatCostAllocation,
  formatUnitEconomics,
  COST_CENTERS,
  TIER_PRICING,
  ECONOMICS_THRESHOLDS,
} from "./costAllocator";
export type { UserUsage, CostAllocation, UserTier, UnitEconomics, CostCenter } from "./costAllocator";

// Q-156: Ops — Incident tracker
export {
  createIncident,
  acknowledgeIncident,
  resolveIncident,
  addTimelineEntry,
  calculateMetrics,
  generatePostmortemTemplate,
  formatMetrics,
  SEVERITY_LEVELS,
  STATUS_FLOW,
} from "./incidentTracker";
export type { Incident, SeverityLevel, IncidentCategory, IncidentStatus, TimelineEntry, IncidentMetrics, PostmortemTemplate } from "./incidentTracker";
