/**
 * referralEngine.ts
 * Referral/invite program engine for BJJ App.
 * Handles code generation, tracking, reward calculation, and abuse detection.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A referral code bound to a user */
export interface ReferralCode {
  readonly code: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly isActive: boolean;
}

/** Tracks a single referral event */
export interface ReferralTracking {
  readonly id: string;
  readonly referralCode: string;
  readonly referrerId: string;
  readonly refereeId: string;
  readonly refereeIp: string;
  readonly createdAt: string;
  readonly convertedAt: string | null;
  readonly status: 'pending' | 'converted' | 'expired' | 'flagged';
}

/** Reward granted to a user via the referral program */
export interface ReferralReward {
  readonly userId: string;
  readonly type: 'pro_extension' | 'pro_trial';
  readonly days: number;
  readonly reason: string;
  readonly grantedAt: string;
}

/** Validation result for a referral code */
export interface ValidationResult {
  readonly valid: boolean;
  readonly reason: string;
}

/** Per-user referral statistics */
export interface ReferralStats {
  readonly userId: string;
  readonly totalReferred: number;
  readonly totalConverted: number;
  readonly conversionRate: number;
  readonly totalRewardDays: number;
  readonly remainingSlots: number;
}

/** Flag raised when potential abuse is detected */
export interface AbuseFlag {
  readonly type: 'same_ip' | 'rapid_signup' | 'self_referral';
  readonly referralId: string;
  readonly detail: string;
  readonly severity: 'low' | 'medium' | 'high';
}

/** Program-wide referral report */
export interface ReferralReport {
  readonly generatedAt: string;
  readonly totalCodes: number;
  readonly totalReferrals: number;
  readonly totalConversions: number;
  readonly conversionRate: number;
  readonly viralCoefficient: number;
  readonly avgReferralsPerUser: number;
  readonly topReferrers: Array<{ userId: string; count: number }>;
  readonly abuseFlags: AbuseFlag[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rewards granted for each side of a referral */
export const REFERRAL_REWARDS = {
  referrer: { type: 'pro_extension' as const, days: 7 },
  referee: { type: 'pro_trial' as const, days: 14 },
} as const;

/** Maximum referrals a single user can generate */
export const MAX_REFERRALS_PER_USER = 20;

/** Length of the generated referral code */
export const REFERRAL_CODE_LENGTH = 8;

/** Charset used for referral codes */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash turning a string into a numeric seed.
 * Uses DJB2-style hashing.
 */
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 8-character alphanumeric referral code for a user.
 * The same userId always produces the same code.
 */
export function generateReferralCode(userId: string): string {
  let hash = djb2Hash(`referral:${userId}`);
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CODE_CHARS[hash % CODE_CHARS.length];
    hash = djb2Hash(`${hash}:${i}`);
  }
  return code;
}

/**
 * Validate the format of a referral code.
 * Does NOT check existence in the database (caller must verify).
 */
export function validateReferralCode(code: string): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Code is required' };
  }
  if (code.length !== REFERRAL_CODE_LENGTH) {
    return { valid: false, reason: `Code must be ${REFERRAL_CODE_LENGTH} characters` };
  }
  const validPattern = new RegExp(`^[${CODE_CHARS}]+$`);
  if (!validPattern.test(code)) {
    return { valid: false, reason: 'Code contains invalid characters' };
  }
  return { valid: true, reason: 'Format is valid' };
}

/**
 * Create a referral tracking record when a referee signs up with a code.
 */
export function trackReferral(
  code: string,
  refereeId: string,
  referrerId: string,
  refereeIp: string,
): ReferralTracking {
  return {
    id: `ref_${Date.now()}_${djb2Hash(refereeId)}`,
    referralCode: code,
    referrerId,
    refereeId,
    refereeIp,
    createdAt: new Date().toISOString(),
    convertedAt: null,
    status: 'pending',
  };
}

/**
 * Compute the rewards a referrer has earned from their converted referrals.
 */
export function calculateRewards(referrals: ReferralTracking[]): ReferralReward[] {
  const converted = referrals.filter((r) => r.status === 'converted');
  return converted.map((r) => ({
    userId: r.referrerId,
    type: REFERRAL_REWARDS.referrer.type,
    days: REFERRAL_REWARDS.referrer.days,
    reason: `Referral conversion: ${r.refereeId}`,
    grantedAt: r.convertedAt ?? new Date().toISOString(),
  }));
}

/**
 * Build per-user referral statistics.
 */
export function getReferralStats(
  userId: string,
  referrals: ReferralTracking[],
): ReferralStats {
  const userReferrals = referrals.filter((r) => r.referrerId === userId);
  const converted = userReferrals.filter((r) => r.status === 'converted');
  const totalReferred = userReferrals.length;
  const totalConverted = converted.length;
  return {
    userId,
    totalReferred,
    totalConverted,
    conversionRate: totalReferred > 0 ? totalConverted / totalReferred : 0,
    totalRewardDays: totalConverted * REFERRAL_REWARDS.referrer.days,
    remainingSlots: Math.max(0, MAX_REFERRALS_PER_USER - totalReferred),
  };
}

/**
 * Detect potential abuse patterns in referral data.
 */
export function detectAbuse(referrals: ReferralTracking[]): AbuseFlag[] {
  const flags: AbuseFlag[] = [];

  // Self-referral
  for (const r of referrals) {
    if (r.referrerId === r.refereeId) {
      flags.push({ type: 'self_referral', referralId: r.id, detail: 'Referrer and referee are the same user', severity: 'high' });
    }
  }

  // Same IP clusters
  const ipMap = new Map<string, ReferralTracking[]>();
  for (const r of referrals) {
    const list = ipMap.get(r.refereeIp) ?? [];
    list.push(r);
    ipMap.set(r.refereeIp, list);
  }
  for (const [ip, group] of ipMap) {
    if (group.length >= 3) {
      flags.push({ type: 'same_ip', referralId: group[0].id, detail: `${group.length} signups from IP ${ip}`, severity: 'medium' });
    }
  }

  // Rapid signups (>3 referrals within 10 minutes for a single referrer)
  const byReferrer = new Map<string, ReferralTracking[]>();
  for (const r of referrals) {
    const list = byReferrer.get(r.referrerId) ?? [];
    list.push(r);
    byReferrer.set(r.referrerId, list);
  }
  for (const [, group] of byReferrer) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (let i = 0; i <= sorted.length - 3; i++) {
      const windowMs = new Date(sorted[i + 2].createdAt).getTime() - new Date(sorted[i].createdAt).getTime();
      if (windowMs < 10 * 60 * 1000) {
        flags.push({ type: 'rapid_signup', referralId: sorted[i].id, detail: `3 referrals within ${Math.round(windowMs / 1000)}s`, severity: 'high' });
        break;
      }
    }
  }

  return flags;
}

/**
 * Build a program-wide referral report.
 */
export function buildReferralReport(allReferrals: ReferralTracking[]): ReferralReport {
  const uniqueReferrers = new Set(allReferrals.map((r) => r.referrerId));
  const converted = allReferrals.filter((r) => r.status === 'converted');

  const referrerCounts = new Map<string, number>();
  for (const r of allReferrals) {
    referrerCounts.set(r.referrerId, (referrerCounts.get(r.referrerId) ?? 0) + 1);
  }
  const topReferrers = [...referrerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  const avgReferralsPerUser = uniqueReferrers.size > 0 ? allReferrals.length / uniqueReferrers.size : 0;
  const viralCoefficient = uniqueReferrers.size > 0 ? converted.length / uniqueReferrers.size : 0;

  return {
    generatedAt: new Date().toISOString(),
    totalCodes: uniqueReferrers.size,
    totalReferrals: allReferrals.length,
    totalConversions: converted.length,
    conversionRate: allReferrals.length > 0 ? converted.length / allReferrals.length : 0,
    viralCoefficient,
    avgReferralsPerUser,
    topReferrers,
    abuseFlags: detectAbuse(allReferrals),
  };
}

/**
 * Format a referral report as a human-readable string.
 */
export function formatReferralReport(report: ReferralReport): string {
  const lines: string[] = [
    '=== Referral Program Report ===',
    `Generated: ${report.generatedAt}`,
    '',
    `Total referral codes: ${report.totalCodes}`,
    `Total referrals: ${report.totalReferrals}`,
    `Total conversions: ${report.totalConversions}`,
    `Conversion rate: ${(report.conversionRate * 100).toFixed(1)}%`,
    `Viral coefficient: ${report.viralCoefficient.toFixed(2)}`,
    `Avg referrals/user: ${report.avgReferralsPerUser.toFixed(1)}`,
    '',
    '--- Top Referrers ---',
    ...report.topReferrers.map((r, i) => `  ${i + 1}. ${r.userId} (${r.count} referrals)`),
  ];
  if (report.abuseFlags.length > 0) {
    lines.push('', '--- Abuse Flags ---');
    for (const flag of report.abuseFlags) {
      lines.push(`  [${flag.severity.toUpperCase()}] ${flag.type}: ${flag.detail}`);
    }
  }
  return lines.join('\n');
}
