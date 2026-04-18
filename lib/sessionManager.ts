/**
 * sessionManager.ts — Session security & lifecycle management
 *
 * Handles session rotation, idle timeout detection, concurrent session
 * management, and device fingerprint validation.
 *
 * Pure functions — no actual session storage. Operates on session data.
 *
 * @module Q-189 Security 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface SessionInfo {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly expiresAt: number;
  readonly fingerprint: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly isActive: boolean;
}

export interface SessionPolicy {
  readonly maxIdleMinutes: number;
  readonly maxSessionHours: number;
  readonly maxConcurrentSessions: number;
  readonly rotationIntervalMinutes: number;
  readonly requireFingerprintMatch: boolean;
  readonly lockAfterFailedAttempts: number;
}

export interface SessionValidation {
  readonly isValid: boolean;
  readonly reason?: string;
  readonly shouldRotate: boolean;
  readonly shouldTerminate: boolean;
  readonly remainingIdleMs: number;
  readonly remainingAbsoluteMs: number;
}

export interface ConcurrentSessionCheck {
  readonly totalSessions: number;
  readonly activeSessions: number;
  readonly exceedsLimit: boolean;
  readonly oldestSession: SessionInfo | null;
  readonly sessionsToTerminate: readonly SessionInfo[];
}

export interface DeviceFingerprint {
  readonly userAgent: string;
  readonly language: string;
  readonly timezone: string;
  readonly screenResolution: string;
  readonly platform: string;
}

export interface LoginAttempt {
  readonly timestamp: number;
  readonly success: boolean;
  readonly ipAddress: string;
  readonly userAgent: string;
}

export interface AccountLockStatus {
  readonly isLocked: boolean;
  readonly failedAttempts: number;
  readonly lockExpiresAt: number | null;
  readonly recentAttempts: readonly LoginAttempt[];
}

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  maxIdleMinutes: 30,
  maxSessionHours: 24,
  maxConcurrentSessions: 5,
  rotationIntervalMinutes: 60,
  requireFingerprintMatch: true,
  lockAfterFailedAttempts: 5,
};

/** Lock duration after failed attempts (minutes) */
export const LOCK_DURATION_MINUTES = 15;

/** Window for counting failed attempts (minutes) */
export const ATTEMPT_WINDOW_MINUTES = 30;

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Generate a deterministic device fingerprint hash.
 */
export function generateFingerprint(device: DeviceFingerprint): string {
  const raw = [
    device.userAgent,
    device.language,
    device.timezone,
    device.screenResolution,
    device.platform,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Validate a session against policy.
 */
export function validateSession(
  session: SessionInfo,
  policy: SessionPolicy,
  now: number,
  currentFingerprint?: string
): SessionValidation {
  const idleMs = now - session.lastActivityAt;
  const maxIdleMs = policy.maxIdleMinutes * 60 * 1000;
  const absoluteMs = now - session.createdAt;
  const maxAbsoluteMs = policy.maxSessionHours * 3600 * 1000;
  const rotationMs = policy.rotationIntervalMinutes * 60 * 1000;

  // Check if session is expired
  if (now >= session.expiresAt) {
    return {
      isValid: false,
      reason: "Session expired",
      shouldRotate: false,
      shouldTerminate: true,
      remainingIdleMs: 0,
      remainingAbsoluteMs: 0,
    };
  }

  // Check idle timeout
  if (idleMs > maxIdleMs) {
    return {
      isValid: false,
      reason: `Idle timeout exceeded (${Math.round(idleMs / 60000)}min > ${policy.maxIdleMinutes}min)`,
      shouldRotate: false,
      shouldTerminate: true,
      remainingIdleMs: 0,
      remainingAbsoluteMs: Math.max(0, maxAbsoluteMs - absoluteMs),
    };
  }

  // Check absolute session duration
  if (absoluteMs > maxAbsoluteMs) {
    return {
      isValid: false,
      reason: `Max session duration exceeded (${Math.round(absoluteMs / 3600000)}h > ${policy.maxSessionHours}h)`,
      shouldRotate: false,
      shouldTerminate: true,
      remainingIdleMs: Math.max(0, maxIdleMs - idleMs),
      remainingAbsoluteMs: 0,
    };
  }

  // Check fingerprint match
  if (
    policy.requireFingerprintMatch &&
    currentFingerprint &&
    session.fingerprint !== currentFingerprint
  ) {
    return {
      isValid: false,
      reason: "Device fingerprint mismatch — possible session hijacking",
      shouldRotate: false,
      shouldTerminate: true,
      remainingIdleMs: Math.max(0, maxIdleMs - idleMs),
      remainingAbsoluteMs: Math.max(0, maxAbsoluteMs - absoluteMs),
    };
  }

  // Check rotation
  const shouldRotate = absoluteMs > rotationMs;

  return {
    isValid: true,
    shouldRotate,
    shouldTerminate: false,
    remainingIdleMs: Math.max(0, maxIdleMs - idleMs),
    remainingAbsoluteMs: Math.max(0, maxAbsoluteMs - absoluteMs),
  };
}

/**
 * Check concurrent sessions against policy.
 */
export function checkConcurrentSessions(
  sessions: readonly SessionInfo[],
  policy: SessionPolicy,
  now: number
): ConcurrentSessionCheck {
  const activeSessions = sessions.filter((s) => {
    if (!s.isActive) return false;
    if (now >= s.expiresAt) return false;
    const idleMs = now - s.lastActivityAt;
    return idleMs <= policy.maxIdleMinutes * 60 * 1000;
  });

  const sorted = [...activeSessions].sort(
    (a, b) => a.lastActivityAt - b.lastActivityAt
  );

  const exceedsLimit = sorted.length > policy.maxConcurrentSessions;
  const sessionsToTerminate = exceedsLimit
    ? sorted.slice(0, sorted.length - policy.maxConcurrentSessions)
    : [];

  return {
    totalSessions: sessions.length,
    activeSessions: activeSessions.length,
    exceedsLimit,
    oldestSession: sorted.length > 0 ? sorted[0] : null,
    sessionsToTerminate,
  };
}

/**
 * Check account lock status based on login attempts.
 */
export function checkAccountLock(
  attempts: readonly LoginAttempt[],
  policy: SessionPolicy,
  now: number
): AccountLockStatus {
  const windowMs = ATTEMPT_WINDOW_MINUTES * 60 * 1000;
  const recentAttempts = attempts.filter(
    (a) => now - a.timestamp < windowMs
  );

  const failedAttempts = recentAttempts.filter((a) => !a.success);
  const isLocked = failedAttempts.length >= policy.lockAfterFailedAttempts;

  let lockExpiresAt: number | null = null;
  if (isLocked && failedAttempts.length > 0) {
    const lastFailed = failedAttempts[failedAttempts.length - 1];
    lockExpiresAt = lastFailed.timestamp + LOCK_DURATION_MINUTES * 60 * 1000;
    if (now >= lockExpiresAt) {
      return {
        isLocked: false,
        failedAttempts: 0,
        lockExpiresAt: null,
        recentAttempts,
      };
    }
  }

  return {
    isLocked,
    failedAttempts: failedAttempts.length,
    lockExpiresAt,
    recentAttempts,
  };
}

/**
 * Calculate session security score.
 */
export function calculateSessionSecurityScore(
  session: SessionInfo,
  policy: SessionPolicy,
  validation: SessionValidation
): number {
  let score = 100;

  // Deduct for no fingerprint
  if (!session.fingerprint) score -= 15;

  // Deduct for long idle
  const idlePercent = 1 - validation.remainingIdleMs / (policy.maxIdleMinutes * 60 * 1000);
  if (idlePercent > 0.8) score -= 10;

  // Deduct for approaching expiry
  const expiryPercent = 1 - validation.remainingAbsoluteMs / (policy.maxSessionHours * 3600 * 1000);
  if (expiryPercent > 0.9) score -= 10;

  // Deduct for needing rotation
  if (validation.shouldRotate) score -= 5;

  // Invalid session = 0
  if (!validation.isValid) score = 0;

  return Math.max(0, Math.min(100, score));
}

/**
 * Format session validation as human-readable string.
 */
export function formatSessionStatus(
  session: SessionInfo,
  validation: SessionValidation
): string {
  const lines = [
    `Session: ${session.id}`,
    `Status: ${validation.isValid ? "✅ Valid" : "❌ Invalid"}`,
  ];

  if (validation.reason) {
    lines.push(`Reason: ${validation.reason}`);
  }

  lines.push(
    `Idle remaining: ${Math.round(validation.remainingIdleMs / 60000)}min`,
    `Absolute remaining: ${Math.round(validation.remainingAbsoluteMs / 3600000)}h`
  );

  if (validation.shouldRotate) {
    lines.push("⚠️ Session should be rotated");
  }

  return lines.join("\n");
}
