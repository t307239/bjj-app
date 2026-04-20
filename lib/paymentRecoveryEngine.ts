/**
 * paymentRecoveryEngine.ts
 * Dunning optimization and payment recovery engine for BJJ App.
 * Manages retry logic, failure classification, recovery probability,
 * and dunning sequence optimization.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A failed payment requiring recovery */
export interface FailedPayment {
  readonly id: string;
  readonly userId: string;
  readonly amount: number;
  readonly currency: string;
  readonly failedAt: string;
  readonly errorCode: string;
  readonly attemptCount: number;
  readonly lastAttemptAt: string;
  readonly subscriptionId: string;
  readonly cardLastFour: string;
  readonly previousRecoveries: number;
}

/** An action in the dunning sequence */
export interface RecoveryAction {
  readonly paymentId: string;
  readonly day: number;
  readonly action: DunningActionType;
  readonly scheduledAt: string;
  readonly metadata: Record<string, unknown>;
}

/** Types of dunning actions */
export type DunningActionType =
  | 'retry_payment'
  | 'email_soft'
  | 'email_urgent'
  | 'in_app_banner'
  | 'final_notice'
  | 'cancel_subscription';

/** A step in the dunning sequence definition */
export interface DunningStep {
  readonly day: number;
  readonly action: DunningActionType;
}

/** Full dunning sequence configuration */
export type DunningSequence = readonly DunningStep[];

/** Decision on whether to retry a payment */
export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly reason: string;
  readonly suggestedDate: string | null;
  readonly confidence: number;
}

/** Categorized failure reason */
export type FailureCategory =
  | 'insufficient_funds'
  | 'expired_card'
  | 'processing_error'
  | 'fraud'
  | 'bank_decline'
  | 'invalid_card'
  | 'unknown';

/** Recovery metrics across all failed payments */
export interface RecoveryMetrics {
  readonly totalFailed: number;
  readonly totalRecovered: number;
  readonly recoveryRate: number;
  readonly avgDaysToRecovery: number;
  readonly revenueAtRisk: number;
  readonly revenueRecovered: number;
  readonly byCategory: Record<FailureCategory, { count: number; recoveryRate: number }>;
}

/** Timing recommendation for optimized retries */
export interface TimingRecommendation {
  readonly dayOfMonth: number;
  readonly hourUtc: number;
  readonly successRate: number;
  readonly reason: string;
}

/** Full recovery report */
export interface RecoveryReport {
  readonly generatedAt: string;
  readonly metrics: RecoveryMetrics;
  readonly activeSequences: number;
  readonly pendingActions: RecoveryAction[];
  readonly timingRecommendations: TimingRecommendation[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The default dunning sequence */
export const DUNNING_SEQUENCE: DunningSequence = [
  { day: 0, action: 'retry_payment' },
  { day: 1, action: 'email_soft' },
  { day: 3, action: 'retry_payment' },
  { day: 5, action: 'email_urgent' },
  { day: 7, action: 'retry_payment' },
  { day: 10, action: 'in_app_banner' },
  { day: 14, action: 'final_notice' },
  { day: 21, action: 'cancel_subscription' },
] as const;

/** Stripe error code to failure category mapping */
const ERROR_CODE_MAP: Record<string, FailureCategory> = {
  card_declined: 'bank_decline',
  insufficient_funds: 'insufficient_funds',
  expired_card: 'expired_card',
  processing_error: 'processing_error',
  incorrect_cvc: 'invalid_card',
  incorrect_number: 'invalid_card',
  fraudulent: 'fraud',
  stolen_card: 'fraud',
  lost_card: 'fraud',
  pickup_card: 'fraud',
  do_not_honor: 'bank_decline',
  generic_decline: 'bank_decline',
  try_again_later: 'processing_error',
  not_permitted: 'bank_decline',
};

/** Base recovery probability by failure category */
const BASE_RECOVERY_RATES: Record<FailureCategory, number> = {
  insufficient_funds: 0.65,
  expired_card: 0.15,
  processing_error: 0.85,
  fraud: 0.02,
  bank_decline: 0.40,
  invalid_card: 0.05,
  unknown: 0.30,
};

/** Common paydays (day of month) */
const PAYDAYS = [1, 15];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the day number since initial failure for a payment.
 */
function daysSinceFailure(payment: FailedPayment): number {
  const failed = new Date(payment.failedAt).getTime();
  const now = Date.now();
  return Math.floor((now - failed) / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date string and return ISO string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Check if a date falls on a weekend (Saturday=6, Sunday=0).
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Find the next weekday on or after the given date.
 */
function nextWeekday(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine the next action in the dunning sequence for a failed payment.
 */
export function getNextAction(payment: FailedPayment): RecoveryAction {
  const elapsed = daysSinceFailure(payment);

  let nextStep = DUNNING_SEQUENCE[DUNNING_SEQUENCE.length - 1];
  for (const step of DUNNING_SEQUENCE) {
    if (step.day > elapsed) {
      nextStep = step;
      break;
    }
  }

  return {
    paymentId: payment.id,
    day: nextStep.day,
    action: nextStep.action,
    scheduledAt: addDays(payment.failedAt, nextStep.day),
    metadata: {
      attemptCount: payment.attemptCount,
      daysSinceFailure: elapsed,
      amount: payment.amount,
      currency: payment.currency,
    },
  };
}

/**
 * Decide whether to retry a payment, avoiding weekends and preferring paydays.
 */
export function shouldRetryPayment(payment: FailedPayment): RetryDecision {
  const category = classifyFailureReason(payment.errorCode);

  // Don't retry fraud or invalid cards
  if (category === 'fraud' || category === 'invalid_card') {
    return {
      shouldRetry: false,
      reason: `Non-recoverable failure: ${category}`,
      suggestedDate: null,
      confidence: 0.95,
    };
  }

  // Too many attempts
  if (payment.attemptCount >= 6) {
    return {
      shouldRetry: false,
      reason: 'Maximum retry attempts reached',
      suggestedDate: null,
      confidence: 0.90,
    };
  }

  const now = new Date();
  let suggestedDate = nextWeekday(now);

  // For insufficient funds, prefer payday
  if (category === 'insufficient_funds') {
    const currentDay = now.getDate();
    const nextPayday = PAYDAYS.find((d) => d > currentDay) ?? PAYDAYS[0];
    const targetMonth = nextPayday <= currentDay ? now.getMonth() + 1 : now.getMonth();
    const paydayDate = new Date(now.getFullYear(), targetMonth, nextPayday);
    suggestedDate = nextWeekday(paydayDate);
  }

  const probability = estimateRecoveryProbability(payment);

  return {
    shouldRetry: probability > 0.10,
    reason: probability > 0.10
      ? `Recovery probability ${(probability * 100).toFixed(0)}% — retry recommended`
      : `Recovery probability too low (${(probability * 100).toFixed(0)}%)`,
    suggestedDate: suggestedDate.toISOString(),
    confidence: Math.min(0.95, 0.5 + payment.attemptCount * 0.08),
  };
}

/**
 * Classify a Stripe error code into a failure category.
 */
export function classifyFailureReason(errorCode: string): FailureCategory {
  return ERROR_CODE_MAP[errorCode] ?? 'unknown';
}

/**
 * Estimate the probability of recovering a failed payment (0-1).
 * Decreases with attempt count and time elapsed.
 */
export function estimateRecoveryProbability(payment: FailedPayment): number {
  const category = classifyFailureReason(payment.errorCode);
  let probability = BASE_RECOVERY_RATES[category];

  // Decay per attempt (each attempt reduces chance by 15%)
  probability *= Math.pow(0.85, payment.attemptCount);

  // Time decay (1% per day)
  const elapsed = daysSinceFailure(payment);
  probability *= Math.max(0, 1 - elapsed * 0.01);

  // Boost if user has recovered before
  if (payment.previousRecoveries > 0) {
    probability = Math.min(1, probability * 1.3);
  }

  return Math.max(0, Math.min(1, probability));
}

/**
 * Calculate aggregate recovery metrics across all failed payments.
 */
export function calculateRecoveryMetrics(
  payments: FailedPayment[],
  recoveredIds: Set<string>,
  recoveryDays?: Map<string, number>,
): RecoveryMetrics {
  const totalFailed = payments.length;
  const totalRecovered = payments.filter((p) => recoveredIds.has(p.id)).length;

  let totalDaysToRecovery = 0;
  let recoveryDayCount = 0;
  if (recoveryDays) {
    for (const days of recoveryDays.values()) {
      totalDaysToRecovery += days;
      recoveryDayCount++;
    }
  }

  const revenueAtRisk = payments.reduce((sum, p) => sum + p.amount, 0);
  const revenueRecovered = payments
    .filter((p) => recoveredIds.has(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  // By category
  const categoryMap = new Map<FailureCategory, { total: number; recovered: number }>();
  for (const p of payments) {
    const cat = classifyFailureReason(p.errorCode);
    const rec = categoryMap.get(cat) ?? { total: 0, recovered: 0 };
    rec.total++;
    if (recoveredIds.has(p.id)) rec.recovered++;
    categoryMap.set(cat, rec);
  }

  const byCategory = {} as Record<FailureCategory, { count: number; recoveryRate: number }>;
  for (const [cat, rec] of categoryMap) {
    byCategory[cat] = { count: rec.total, recoveryRate: rec.total > 0 ? rec.recovered / rec.total : 0 };
  }

  return {
    totalFailed,
    totalRecovered,
    recoveryRate: totalFailed > 0 ? totalRecovered / totalFailed : 0,
    avgDaysToRecovery: recoveryDayCount > 0 ? totalDaysToRecovery / recoveryDayCount : 0,
    revenueAtRisk,
    revenueRecovered,
    byCategory,
  };
}

/**
 * Analyze historical recovery data to recommend optimal retry timing.
 */
export function optimizeDunningTiming(
  history: Array<{ recoveredAt: string; failedAt: string; successful: boolean }>,
): TimingRecommendation[] {
  const daySuccessMap = new Map<number, { total: number; success: number }>();
  const hourSuccessMap = new Map<number, { total: number; success: number }>();

  for (const h of history) {
    const recovered = new Date(h.recoveredAt);
    const dom = recovered.getDate();
    const hour = recovered.getUTCHours();

    const dayRec = daySuccessMap.get(dom) ?? { total: 0, success: 0 };
    dayRec.total++;
    if (h.successful) dayRec.success++;
    daySuccessMap.set(dom, dayRec);

    const hourRec = hourSuccessMap.get(hour) ?? { total: 0, success: 0 };
    hourRec.total++;
    if (h.successful) hourRec.success++;
    hourSuccessMap.set(hour, hourRec);
  }

  const recommendations: TimingRecommendation[] = [];

  // Best days of month
  const sortedDays = [...daySuccessMap.entries()]
    .filter(([, r]) => r.total >= 3)
    .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
    .slice(0, 3);

  // Best hours
  const sortedHours = [...hourSuccessMap.entries()]
    .filter(([, r]) => r.total >= 3)
    .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
    .slice(0, 2);

  for (const [day, rec] of sortedDays) {
    const bestHour = sortedHours[0]?.[0] ?? 10;
    const rate = rec.success / rec.total;
    const isPayday = PAYDAYS.includes(day);
    recommendations.push({
      dayOfMonth: day,
      hourUtc: bestHour,
      successRate: rate,
      reason: isPayday ? `Payday (${day}th) — higher fund availability` : `Historical success rate ${(rate * 100).toFixed(0)}%`,
    });
  }

  return recommendations;
}

/**
 * Build a comprehensive recovery report.
 */
export function buildRecoveryReport(
  payments: FailedPayment[],
  recoveredIds: Set<string>,
  recoveryDays?: Map<string, number>,
  history?: Array<{ recoveredAt: string; failedAt: string; successful: boolean }>,
): RecoveryReport {
  const metrics = calculateRecoveryMetrics(payments, recoveredIds, recoveryDays);
  const activePayments = payments.filter((p) => !recoveredIds.has(p.id));
  const pendingActions = activePayments.map((p) => getNextAction(p));
  const timingRecommendations = history ? optimizeDunningTiming(history) : [];

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    activeSequences: activePayments.length,
    pendingActions,
    timingRecommendations,
  };
}

/**
 * Format a recovery report as a human-readable string.
 */
export function formatRecoveryReport(report: RecoveryReport): string {
  const m = report.metrics;
  const lines: string[] = [
    '=== Payment Recovery Report ===',
    `Generated: ${report.generatedAt}`,
    '',
    '--- Recovery Metrics ---',
    `  Total failed: ${m.totalFailed}`,
    `  Total recovered: ${m.totalRecovered}`,
    `  Recovery rate: ${(m.recoveryRate * 100).toFixed(1)}%`,
    `  Avg days to recovery: ${m.avgDaysToRecovery.toFixed(1)}`,
    `  Revenue at risk: $${m.revenueAtRisk.toFixed(2)}`,
    `  Revenue recovered: $${m.revenueRecovered.toFixed(2)}`,
    '',
    '--- By Failure Category ---',
  ];

  for (const [cat, data] of Object.entries(m.byCategory)) {
    lines.push(`  ${cat}: ${data.count} failures, ${(data.recoveryRate * 100).toFixed(0)}% recovered`);
  }

  lines.push('', `Active dunning sequences: ${report.activeSequences}`);

  if (report.pendingActions.length > 0) {
    lines.push('', '--- Next Pending Actions ---');
    for (const a of report.pendingActions.slice(0, 10)) {
      lines.push(`  ${a.paymentId}: ${a.action} on day ${a.day} (${a.scheduledAt.slice(0, 10)})`);
    }
  }

  if (report.timingRecommendations.length > 0) {
    lines.push('', '--- Timing Recommendations ---');
    for (const r of report.timingRecommendations) {
      lines.push(`  Day ${r.dayOfMonth} at ${r.hourUtc}:00 UTC — ${(r.successRate * 100).toFixed(0)}% success (${r.reason})`);
    }
  }

  return lines.join('\n');
}
