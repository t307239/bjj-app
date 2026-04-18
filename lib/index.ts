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

// Q-157: Performance — Resource timing analyzer
export {
  analyzeResourceTiming,
  detectRenderBlocking,
  calculateWaterfallEfficiency,
  classifyResourceSize,
  formatResourceAnalysis,
  RESOURCE_BUDGETS,
  SIZE_THRESHOLDS,
  BLOCKING_TYPES,
} from "./resourceTimingAnalyzer";
export type { ResourceEntry, ResourceType, ResourceAnalysis, TypeBreakdown, OptimizationSuggestion, ResourceBudget } from "./resourceTimingAnalyzer";

// Q-158: a11y — Focus trap manager
export {
  getFocusableElements,
  analyzeFocusableElements,
  createTrapKeyHandler,
  getInitialFocusTarget,
  buildTrapContainerProps,
  isWithinContainer,
  formatFocusTrapInfo,
  FOCUSABLE_SELECTOR,
  DEFAULT_TRAP_OPTIONS,
  TAB_KEY,
  ESCAPE_KEY,
} from "./focusTrapManager";
export type { FocusTrap, FocusTrapOptions, FocusableInfo } from "./focusTrapManager";

// Q-159: Security — Input sanitizer
export {
  escapeHTML,
  sanitizeHTML,
  sanitizeFilename,
  sanitizeURL,
  detectInjection,
  isSafeForContext,
  formatInjectionReport,
  HTML_ENTITIES,
  INJECTION_PATTERNS,
  MAX_INPUT_LENGTH,
  UNSAFE_FILENAME_CHARS,
} from "./inputSanitizer";
export type { SanitizeResult, ThreatType, InjectionDetection, InjectionMatch, InjectionPattern } from "./inputSanitizer";

// Q-160: Obs — Trace context
export {
  generateHexId,
  generateTraceId,
  generateSpanId,
  createTraceContext,
  createSpan,
  endSpan,
  formatTraceparent,
  parseTraceparent,
  formatBaggage,
  parseBaggage,
  calculateTraceMetrics,
  formatTraceMetrics,
  TRACEPARENT_HEADER,
  BAGGAGE_HEADER,
  TRACE_VERSION,
  DEFAULT_SAMPLE_RATE,
  MAX_BAGGAGE_ITEMS,
} from "./traceContext";
export type { TraceContext, Span, TraceFlags, SpanStatus, TraceMetrics } from "./traceContext";

// Q-161: DX — API doc generator
export {
  defineEndpoint,
  buildApiDoc,
  findUndocumented,
  findDeprecated,
  buildChangelog,
  formatApiDoc,
  API_METHODS,
  STANDARD_ERRORS,
  AUTH_LABELS,
} from "./apiDocGenerator";
export type { ApiEndpoint, HttpMethod, AuthRequirement, SchemaDoc, FieldDoc, ErrorDoc, ApiDoc, ApiCoverage, ApiChangelog, ApiChange } from "./apiDocGenerator";

// Q-162: Infra — Feature toggle manager
export {
  defineToggle,
  evaluateToggle,
  findStaleToggles,
  findBrokenDependencies,
  auditToggles,
  formatToggleAudit,
  deterministicHash,
  TOGGLE_STATES,
  STALE_WARNING_THRESHOLD,
  STALE_CRITICAL_THRESHOLD,
  DEFAULT_EXPIRY_DAYS,
} from "./featureToggleManager";
export type { FeatureToggle, ToggleState, ToggleEvaluation, EvalReason, ToggleAudit } from "./featureToggleManager";

// Q-163: UI — Style auditor (design token compliance)
export {
  auditStyles,
  auditMultipleStyles,
  getTokenSummary,
  formatAuditReport,
  APPROVED_COLORS,
  APPROVED_COLOR_PREFIXES,
  FORBIDDEN_COLOR_PATTERNS,
  STANDARD_SPACING,
  AUDIT_RULES,
} from "./styleAuditor";
export type { AuditViolation, AuditRule, AuditSeverity, StyleAuditReport } from "./styleAuditor";

// Q-164: UX — Gesture manager (touch gesture recognition)
export {
  detectSwipe,
  detectLongPress,
  detectPinch,
  classifyPinch,
  resolveGesture,
  getSwipeAxis,
  getDistance,
  createGestureConfig,
  createVelocityTracker,
  formatGestureDebug,
  DEFAULT_GESTURE_CONFIG,
} from "./gestureManager";
export type { Point, TimedPoint, SwipeDirection, SwipeResult, LongPressResult, PinchResult, GestureConfig, GestureType, GesturePriority } from "./gestureManager";

// Q-165: i18n — Message formatter (ICU-compatible)
export {
  formatMessage,
  formatCompiled,
  compileMessage,
  validateMessage,
  checkMissingParams,
  extractParams,
  createLocaleFormatter,
  formatMessageWithNumbers,
  buildMessageDiagnostic,
  getPluralCategory as getMessagePluralCategory,
} from "./messageFormatter";
export type { MessageValues, CompiledMessage, MessagePart, PluralCategory as MessagePluralCategory, Locale, ValidationResult } from "./messageFormatter";

// Q-166: Data — Anomaly detector
export {
  detectOutliers,
  detectDuplicates,
  detectTemporalAnomalies,
  detectVolumeAnomalies,
  validateDomainRange,
  runAnomalyReport,
  formatAnomalyReport,
  mean as anomalyMean,
  stddev as anomalyStddev,
  median as anomalyMedian,
  quartiles as anomalyQuartiles,
  DOMAIN_RANGES,
  DEFAULT_ANOMALY_CONFIG,
} from "./dataAnomalyDetector";
export type { AnomalyPoint, DuplicateGroup, TemporalAnomaly, VolumeAnomaly, AnomalyDetectorConfig, AnomalyReport } from "./dataAnomalyDetector";

// Q-167: Retention — Cohort analyzer
export {
  buildCohortMatrix,
  analyzeCohort,
  calculateNDayRetention,
  compareCohorts,
  formatCohortMatrix,
  dateToPeriodKey,
  daysBetween,
  RETENTION_DAYS,
  RETENTION_THRESHOLDS,
  INTERVENTION_TEMPLATES,
} from "./cohortAnalyzer";
export type { UserActivity, CohortBucket, CohortMatrix, CohortAnalysis, CohortIntervention } from "./cohortAnalyzer";

// Q-168: Legal — Privacy Impact Assessment
export {
  createAssessment,
  scoreRisk,
  checkDPIARequired,
  identifyRiskFactors,
  suggestMitigations,
  generatePIAReport,
  quickRiskCheck,
  DATA_SENSITIVITY,
  PROCESSING_RISK,
  DPIA_TRIGGERS,
  STANDARD_MITIGATIONS,
} from "./privacyImpactAssessment";
export type { DataCategory as PIADataCategory, ProcessingActivity, RiskLevel, RiskFactor, Mitigation, DataFlow, PIAAssessment } from "./privacyImpactAssessment";

// Q-169: Cost — Billing analyzer
export {
  calculateMRR,
  calculateRevenue,
  calculateChurnRate,
  analyzeBillingHealth,
  formatBillingHealth,
  toMonthlyCents,
  TIER_PRICES,
  BILLING_THRESHOLDS,
} from "./billingAnalyzer";
export type { BillingTier, BillingInterval, Subscription, MRRBreakdown, RevenueMetrics, BillingHealth, BillingIssue } from "./billingAnalyzer";

// Q-170: Ops — Runbook generator
export {
  createRunbook,
  startExecution,
  advanceStep,
  getEscalationPath,
  formatRunbook,
  getTemplateKeys,
  RUNBOOK_TEMPLATES,
} from "./runbookGenerator";
export type { RunbookSeverity, StepStatus, RunbookStep, EscalationPath, Runbook, RunbookExecution, RunbookTemplateKey } from "./runbookGenerator";

// Q-171: Conversion — Pricing optimizer
export {
  analyzePriceSensitivity,
  compareTiers,
  modelDiscount,
  calculateAnnualSavings,
  applyCharmPricing,
  generateRecommendations as generatePricingRecommendations,
  formatPricingAnalysis,
  PRICING_PSYCHOLOGY,
  CURRENT_PRICING,
} from "./pricingOptimizer";
export type { PricePoint, PriceSensitivity, TierComparison, DiscountModel, PricingRecommendation } from "./pricingOptimizer";

// Q-172: Performance — Bundle optimizer
export {
  analyzeBundleChunks,
  generateSplittingRecommendations,
  detectTreeShakeOpportunities,
  classifyRoutes,
  estimateTotalSavings,
  formatBundleAnalysis,
  BUNDLE_BUDGETS,
  LAZY_LOAD_CANDIDATES,
  ROUTE_CATEGORIES,
} from "./bundleOptimizer";
export type { ChunkInfo, DependencyInfo, SplittingRecommendation, BundleAnalysis, RouteCategory } from "./bundleOptimizer";

// Q-173: a11y — Screen reader audit
export {
  auditLandmarks,
  calculateLandmarkCoverage,
  auditHeadingHierarchy,
  isHeadingStructureValid,
  auditImageAlt,
  calculateImageAltCoverage,
  auditRoleAttributes,
  auditLiveRegions,
  runScreenReaderAudit,
  formatScreenReaderAudit,
  REQUIRED_LANDMARKS,
  RECOMMENDED_LANDMARKS,
  HEADING_LEVELS,
  ROLE_REQUIRED_ATTRS,
} from "./screenReaderAudit";
export type { LandmarkInfo, HeadingInfo, LiveRegionInfo, ImageInfo, AuditIssue as SRAuditIssue, ScreenReaderAuditResult } from "./screenReaderAudit";

// Q-174: Security — Permission policy & security header audit
export {
  buildPermissionsPolicy,
  parsePermissionsPolicy,
  auditPermissionsPolicy,
  auditSecurityHeaders,
  formatHeaderAudit,
  PERMISSION_DIRECTIVES,
  SECURITY_HEADERS,
} from "./permissionPolicy";
export type { PermissionDirective, SecurityHeaderName, HeaderSeverity, HeaderAuditResult, PermissionAuditIssue, PermissionPolicyConfig } from "./permissionPolicy";

// Q-175: Obs — SLI/SLO dashboard
export {
  calculateErrorBudget,
  calculatePercentile as sliPercentile,
  aggregateSLIMetrics,
  generateComplianceReport as generateSLOComplianceReport,
  detectSLOViolations,
  formatComplianceReport as formatSLOComplianceReport,
  SLO_DEFINITIONS,
  ERROR_BUDGET_ALERTS,
} from "./sliDashboard";
export type { SLOName, SLIDataPoint, ErrorBudgetStatus, SLOComplianceReport } from "./sliDashboard";

// Q-176: DX — PR review checklist
export {
  validateCommitMessage,
  classifyPRSize,
  detectCodeSmells,
  generateReviewChecklist,
  assessPRRisk,
  analyzePR,
  formatPRAnalysis,
  COMMIT_TYPES,
  PR_SIZE_THRESHOLDS,
  CODE_SMELL_PATTERNS,
  REVIEW_CATEGORIES,
} from "./prReviewChecklist";
export type { CommitType, PRSize, CodeSmellType, ReviewCategory, CommitValidation, CodeSmellResult, PRAnalysis } from "./prReviewChecklist";

// Q-177: Infra — Disaster recovery
export {
  isRTOCompliant,
  isRPOCompliant,
  validateBackup,
  identifyDRGaps,
  generateDRReadinessReport,
  getDRSteps,
  formatDRReport,
  RTO_CLASSIFICATIONS,
  RPO_CLASSIFICATIONS,
  DR_SCENARIOS,
} from "./disasterRecovery";
export type { RTOTier, RPOClass, DRScenario, ServiceComponent, DRPlanEntry, BackupValidation, DRReadinessReport } from "./disasterRecovery";

// Q-178: UI — Theme validator
export {
  detectLightBackgrounds,
  detectGrayUsage,
  detectRawWhite,
  detectInconsistentBorders,
  detectOpacityText,
  auditTheme,
  isDarkColor,
  calculateContrastRatio,
  isContrastCompliant,
  formatThemeAudit,
  DARK_MODE_REQUIREMENTS,
  THEME_RULES,
} from "./themeValidator";
export type { ThemeSeverity, ThemeViolation, ThemeAuditResult } from "./themeValidator";

// Q-179: UX — Navigation flow analyzer
export {
  detectDeadEnds,
  detectOrphans,
  detectDeepNesting,
  detectMissingBreadcrumbs,
  detectCircularNav,
  detectAuthLeaks,
  calculateDepthStats,
  countReachable,
  analyzeNavFlow,
  formatNavFlowReport,
  MAX_RECOMMENDED_DEPTH,
  BREADCRUMB_REQUIRED_DEPTH,
} from "./navigationFlow";
export type { NavNode, NavEdge, NavFlowIssue, NavFlowReport } from "./navigationFlow";

// Q-180: i18n — Locale negotiator
export {
  parseAcceptLanguage as parseAcceptLanguageNeg,
  normalizeBCP47,
  extractLanguage,
  buildFallbackChain,
  negotiateLocale,
  getLocaleConfig,
  isRTL,
  isValidBCP47,
  calculateI18nCoverage as calculateI18nCoverageNeg,
  formatLocaleDebug,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from "./localeNegotiator";
export type { LocaleConfig, QualityLocale } from "./localeNegotiator";

// Q-181: Data — Migration helper
export {
  parseSemver,
  compareSemver,
  compareVersions,
  getStepsBetween,
  buildMigrationPlan,
  validateMigrationPlan,
  validateSchemaSnapshot,
  formatMigrationPlan,
} from "./dataMigrationHelper";
export type { MigrationStep, MigrationPlan, MigrationValidation, SchemaSnapshot, VersionComparison } from "./dataMigrationHelper";

// Q-182: Retention — Loyalty tier system
export {
  getTierForPoints,
  getNextTier,
  calculateProgress as calculateLoyaltyProgress,
  buildLoyaltyProfile,
  calculateActionPoints,
  suggestRetentionActions,
  formatLoyaltyProfile,
  LOYALTY_TIERS,
  LOYALTY_ACTIONS,
} from "./loyaltyTierSystem";
export type { LoyaltyTier, LoyaltyProfile, LoyaltyAction } from "./loyaltyTierSystem";

// Q-183: Legal — Terms version manager
export {
  compareTermsVersions,
  isConsentCurrent,
  getConsentStatus,
  buildConsentAudit,
  detectMaterialChanges,
  requiresNotification,
  buildUpdateNotification,
  formatConsentAudit,
  TERMS_DOCUMENTS,
  CONSENT_MAX_AGE_DAYS as TERMS_CONSENT_MAX_AGE_DAYS,
} from "./termsVersionManager";
export type { TermsVersion, TermsDocType, TermsChange, UserConsent, ConsentStatus, ConsentAuditReport } from "./termsVersionManager";

// Q-184: Cost — Revenue forecaster
export {
  forecastRevenue,
  calculateNRR,
  calculateGrowthRate,
  analyzePricingSensitivity,
  evaluateRevenueHealth,
  formatForecast,
  BENCHMARK_SAAS,
} from "./revenueForecaster";
export type { RevenueSnapshot, ForecastParams, ForecastResult, ForecastMonth, PricingSensitivity } from "./revenueForecaster";

// Q-185: Ops — Alert escalation policy
export {
  getPolicy,
  getCurrentEscalationLevel,
  needsEscalation,
  calculateSLAStatus,
  buildEscalationAudit,
  formatEscalationAudit,
  DEFAULT_POLICIES,
} from "./alertEscalationPolicy";
export type { AlertSeverity as EscalationSeverity, EscalationTier, EscalationChannel, EscalationPolicy, AlertEvent, EscalationEntry, AlertSLAStatus, EscalationAuditReport } from "./alertEscalationPolicy";

// Q-186: Conversion — A/B test analyzer
export {
  normalCDF,
  normalInvCDF,
  conversionRate,
  pooledStandardError,
  calculateZScore,
  calculatePValue,
  analyzeABTest,
  estimateSampleSize,
  calculateRevenueLift,
  formatABTestResult,
  CONFIDENCE_LEVELS,
  MIN_SAMPLE_SIZE,
} from "./abTestAnalyzer";

// Q-187: Performance — Web Vitals analyzer & RUM
export {
  rateMetric,
  percentile,
  buildMetricDistribution,
  detectRegressions,
  calculateRUMScore,
  generateRecommendations as generateVitalsRecommendations,
  buildRUMReport,
  groupByPage,
  formatRUMReport,
  CWV_BUDGETS,
  CORE_METRICS,
} from "./webVitalsAnalyzer";
export type { MetricName, WebVitalEntry, CWVBudget, MetricDistribution, PerformanceRegression, RUMReport } from "./webVitalsAnalyzer";

// Q-188: a11y — Aria live announcer & audit
export {
  createAnnouncerState,
  announce,
  clearExpired,
  getCurrentAnnouncement,
  buildLiveRegionProps,
  checkKeyboardTrap,
  getMotionConfig,
  validateRoleAttributes,
  runA11yAudit,
  formatA11yAudit,
  DEFAULT_ANNOUNCER_CONFIG,
  REDUCED_MOTION_CONFIG,
  FULL_MOTION_CONFIG,
  ROLE_REQUIREMENTS,
} from "./ariaLiveAnnouncer";
export type { Politeness, Announcement, AnnouncerConfig, AnnouncerState, KeyboardTrapCheck, ReducedMotionConfig, A11yAuditItem, A11yAuditResult } from "./ariaLiveAnnouncer";

// Q-189: Security — Session manager
export {
  generateFingerprint,
  validateSession,
  checkConcurrentSessions,
  checkAccountLock,
  calculateSessionSecurityScore,
  formatSessionStatus,
  DEFAULT_SESSION_POLICY,
  LOCK_DURATION_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
} from "./sessionManager";
export type { SessionInfo, SessionPolicy, SessionValidation, ConcurrentSessionCheck, DeviceFingerprint, LoginAttempt, AccountLockStatus } from "./sessionManager";

// Q-190: Obs — RUM collector & dashboard
export {
  classifyDevice,
  extractPath,
  buildPageMetrics,
  checkBudgetViolations,
  buildRUMDashboard,
  segmentByDevice,
  formatRUMDashboard,
  DEFAULT_BUDGETS,
} from "./rumCollector";
export type { ConnectionType, DeviceType, RUMEntry, PageMetrics, RUMBudget, BudgetViolation, RUMDashboard } from "./rumCollector";

// Q-191: DX — Deprecation tracker
export {
  compareSemver as compareDeprecationSemver,
  classifySeverity,
  estimateEffort,
  generateMigrationPlan as generateDeprecationMigration,
  buildDeprecationReport,
  buildSunsetTimeline,
  findUrgentDeprecations,
  formatDeprecationReport,
  SUNSET_WARNING_DAYS,
  SUNSET_URGENT_DAYS,
} from "./deprecationTracker";
export type { DeprecatedItem, MigrationStep as DeprecationMigrationStep, MigrationPlan as DeprecationMigrationPlan, DeprecationReport, SunsetTimeline } from "./deprecationTracker";

// Q-192: Ops — Support ticket router
export {
  classifyCategory,
  determinePriority,
  findResponseTemplate,
  getSuggestedResponse,
  getRoutingRule,
  classifyTicket,
  buildTicketMetrics,
  formatTicketMetrics,
  CATEGORY_PATTERNS,
  ROUTING_RULES,
  RESPONSE_TEMPLATES,
} from "./supportTicketRouter";
export type { TicketCategory, TicketPriority, SupportTicket, ClassifiedTicket, ResponseTemplate, RoutingRule, TicketMetrics } from "./supportTicketRouter";

// Q-193: UI — Animation orchestrator
export {
  applyReducedMotion,
  calculateStaggerDelays,
  buildSequence,
  buildParallel,
  buildStaggered,
  createIntersectionTrigger,
  auditAnimations,
  toCSS,
  formatAnimationAudit,
  EASING_VALUES,
  DEFAULT_BUDGET as DEFAULT_ANIMATION_BUDGET,
  PRESETS as ANIMATION_PRESETS,
} from "./animationOrchestrator";
export type { EasingFunction, AnimationKeyframe, AnimationConfig, StaggerConfig, AnimationSequence, AnimationStep, IntersectionTrigger, AnimationBudget, AnimationAudit } from "./animationOrchestrator";

// Q-194: UX — User journey tracker
export {
  buildSession as buildJourneySession,
  analyzeFlow,
  detectFriction,
  findTopPaths,
  analyzeJourneys,
  formatJourneyAnalysis,
  BOUNCE_MAX_PAGES,
  MIN_ENGAGEMENT_MS,
  FRICTION_THRESHOLDS,
  GOAL_PAGES,
} from "./userJourneyTracker";
export type { JourneyEventType, JourneyEvent, PageDwell, JourneySession, FlowStep, FrictionPoint, JourneyAnalysis } from "./userJourneyTracker";

// Q-195: Retention — Notification optimizer
export {
  isSilentHour as isNotifSilentHour,
  findOptimalSendTime,
  checkFatigue,
  checkDailyLimit,
  checkWeeklyLimit,
  calculateEffectiveness,
  shouldSendNotification,
  buildOptimizationReport,
  formatOptimizationReport,
  SILENT_HOURS,
  MAX_DAILY_NOTIFICATIONS,
  MAX_WEEKLY_NOTIFICATIONS,
  FATIGUE_DISMISS_RATE,
  FATIGUE_COOLDOWN_HOURS,
} from "./notificationOptimizer";
export type { NotificationChannel, DayOfWeek, NotificationEvent, UserActivityPattern, OptimalSendTime, FatigueStatus, NotificationEffectiveness, OptimizationReport } from "./notificationOptimizer";
export type { ABVariant, ABTestConfig, ABTestResult, SampleSizeEstimate } from "./abTestAnalyzer";
