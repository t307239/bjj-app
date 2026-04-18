/**
 * notificationOptimizer.ts — Push notification send-time optimization
 *
 * Optimizes notification delivery timing based on user engagement patterns,
 * manages notification fatigue, and tracks notification effectiveness.
 *
 * Pure functions — no push API access.
 *
 * @module Q-195 Retention 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type NotificationChannel = "push" | "email" | "in_app";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun

export interface NotificationEvent {
  readonly sentAt: number;
  readonly channel: NotificationChannel;
  readonly opened: boolean;
  readonly openedAt?: number;
  readonly clicked: boolean;
  readonly clickedAt?: number;
  readonly dismissed: boolean;
  readonly category: string;
}

export interface UserActivityPattern {
  readonly userId: string;
  readonly hourlyActivity: readonly number[]; // 24 slots (0-23h), count of events
  readonly dailyActivity: readonly number[]; // 7 slots (Sun-Sat)
  readonly lastActiveAt: number;
  readonly timezone: string;
}

export interface OptimalSendTime {
  readonly hour: number; // 0-23
  readonly dayOfWeek: DayOfWeek;
  readonly confidence: number; // 0-1
  readonly reason: string;
}

export interface FatigueStatus {
  readonly userId: string;
  readonly recentNotifications: number;
  readonly recentDismissals: number;
  readonly dismissRate: number;
  readonly isFatigued: boolean;
  readonly cooldownUntil: number | null;
  readonly recommendation: string;
}

export interface NotificationEffectiveness {
  readonly channel: NotificationChannel;
  readonly category: string;
  readonly sent: number;
  readonly opened: number;
  readonly clicked: number;
  readonly dismissed: number;
  readonly openRate: number;
  readonly clickRate: number;
  readonly dismissRate: number;
}

export interface OptimizationReport {
  readonly optimalTimes: readonly OptimalSendTime[];
  readonly fatigueStatus: FatigueStatus;
  readonly effectiveness: readonly NotificationEffectiveness[];
  readonly recommendations: readonly string[];
  readonly overallScore: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Silent hours (no notifications) */
export const SILENT_HOURS = { start: 22, end: 8 } as const;

/** Maximum notifications per day */
export const MAX_DAILY_NOTIFICATIONS = 3;

/** Maximum notifications per week */
export const MAX_WEEKLY_NOTIFICATIONS = 10;

/** Fatigue threshold: dismiss rate over this = fatigued */
export const FATIGUE_DISMISS_RATE = 0.5;

/** Cooldown period after fatigue detection (hours) */
export const FATIGUE_COOLDOWN_HOURS = 48;

/** Minimum notifications to calculate fatigue */
export const MIN_FATIGUE_SAMPLE = 5;

/** Default fallback send times when no data */
export const DEFAULT_SEND_TIMES: readonly OptimalSendTime[] = [
  { hour: 19, dayOfWeek: 1, confidence: 0.5, reason: "Default: Monday evening" },
  { hour: 19, dayOfWeek: 3, confidence: 0.5, reason: "Default: Wednesday evening" },
  { hour: 10, dayOfWeek: 6, confidence: 0.5, reason: "Default: Saturday morning" },
];

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Check if a given hour is within silent hours.
 */
export function isSilentHour(hour: number): boolean {
  if (SILENT_HOURS.start > SILENT_HOURS.end) {
    // Wraps midnight: e.g. 22-8
    return hour >= SILENT_HOURS.start || hour < SILENT_HOURS.end;
  }
  return hour >= SILENT_HOURS.start && hour < SILENT_HOURS.end;
}

/**
 * Find optimal send time based on user activity patterns.
 */
export function findOptimalSendTime(
  pattern: UserActivityPattern
): OptimalSendTime[] {
  const hourlyScores: { hour: number; score: number }[] = [];

  for (let h = 0; h < 24; h++) {
    if (isSilentHour(h)) continue;
    hourlyScores.push({ hour: h, score: pattern.hourlyActivity[h] || 0 });
  }

  // Sort by activity score descending
  hourlyScores.sort((a, b) => b.score - a.score);

  if (hourlyScores.length === 0 || hourlyScores[0].score === 0) {
    return [...DEFAULT_SEND_TIMES];
  }

  const maxScore = hourlyScores[0].score;

  // Find best day
  const dailyScores = pattern.dailyActivity
    .map((score, day) => ({ day: day as DayOfWeek, score }))
    .sort((a, b) => b.score - a.score);

  const bestDay = dailyScores[0]?.day ?? 1;

  // Return top 3 hours with best day
  return hourlyScores.slice(0, 3).map((hs) => ({
    hour: hs.hour,
    dayOfWeek: bestDay,
    confidence: Math.round((hs.score / maxScore) * 100) / 100,
    reason: `Peak activity hour (${hs.score} events)`,
  }));
}

/**
 * Check notification fatigue for a user.
 */
export function checkFatigue(
  events: readonly NotificationEvent[],
  now: number,
  windowDays: number = 7
): FatigueStatus {
  const windowMs = windowDays * 24 * 3600 * 1000;
  const recent = events.filter((e) => now - e.sentAt < windowMs);

  if (recent.length < MIN_FATIGUE_SAMPLE) {
    return {
      userId: "",
      recentNotifications: recent.length,
      recentDismissals: 0,
      dismissRate: 0,
      isFatigued: false,
      cooldownUntil: null,
      recommendation: "Insufficient data for fatigue analysis",
    };
  }

  const dismissed = recent.filter((e) => e.dismissed).length;
  const dismissRate = dismissed / recent.length;
  const isFatigued = dismissRate >= FATIGUE_DISMISS_RATE;

  let cooldownUntil: number | null = null;
  let recommendation: string;

  if (isFatigued) {
    cooldownUntil = now + FATIGUE_COOLDOWN_HOURS * 3600 * 1000;
    recommendation = `User is fatigued (${Math.round(dismissRate * 100)}% dismiss rate). Reduce frequency for ${FATIGUE_COOLDOWN_HOURS}h.`;
  } else if (dismissRate > 0.3) {
    recommendation = "Approaching fatigue threshold. Consider reducing frequency.";
  } else {
    recommendation = "Notification engagement is healthy.";
  }

  return {
    userId: "",
    recentNotifications: recent.length,
    recentDismissals: dismissed,
    dismissRate: Math.round(dismissRate * 100) / 100,
    isFatigued,
    cooldownUntil,
    recommendation,
  };
}

/**
 * Check daily notification limit.
 */
export function checkDailyLimit(
  events: readonly NotificationEvent[],
  now: number
): { withinLimit: boolean; sent: number; remaining: number } {
  const dayMs = 24 * 3600 * 1000;
  const today = events.filter((e) => now - e.sentAt < dayMs);
  const sent = today.length;
  return {
    withinLimit: sent < MAX_DAILY_NOTIFICATIONS,
    sent,
    remaining: Math.max(0, MAX_DAILY_NOTIFICATIONS - sent),
  };
}

/**
 * Check weekly notification limit.
 */
export function checkWeeklyLimit(
  events: readonly NotificationEvent[],
  now: number
): { withinLimit: boolean; sent: number; remaining: number } {
  const weekMs = 7 * 24 * 3600 * 1000;
  const thisWeek = events.filter((e) => now - e.sentAt < weekMs);
  const sent = thisWeek.length;
  return {
    withinLimit: sent < MAX_WEEKLY_NOTIFICATIONS,
    sent,
    remaining: Math.max(0, MAX_WEEKLY_NOTIFICATIONS - sent),
  };
}

/**
 * Calculate notification effectiveness per channel and category.
 */
export function calculateEffectiveness(
  events: readonly NotificationEvent[]
): NotificationEffectiveness[] {
  const groups: Record<string, NotificationEvent[]> = {};

  for (const event of events) {
    const key = `${event.channel}:${event.category}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }

  return Object.entries(groups).map(([key, group]) => {
    const [channel, category] = key.split(":") as [NotificationChannel, string];
    const opened = group.filter((e) => e.opened).length;
    const clicked = group.filter((e) => e.clicked).length;
    const dismissed = group.filter((e) => e.dismissed).length;

    return {
      channel,
      category,
      sent: group.length,
      opened,
      clicked,
      dismissed,
      openRate: group.length > 0 ? Math.round((opened / group.length) * 100) / 100 : 0,
      clickRate: group.length > 0 ? Math.round((clicked / group.length) * 100) / 100 : 0,
      dismissRate: group.length > 0 ? Math.round((dismissed / group.length) * 100) / 100 : 0,
    };
  });
}

/**
 * Should we send a notification right now?
 */
export function shouldSendNotification(
  events: readonly NotificationEvent[],
  pattern: UserActivityPattern,
  currentHour: number,
  now: number
): { send: boolean; reason: string } {
  // Check silent hours
  if (isSilentHour(currentHour)) {
    return { send: false, reason: `Silent hours (${SILENT_HOURS.start}:00-${SILENT_HOURS.end}:00)` };
  }

  // Check daily limit
  const daily = checkDailyLimit(events, now);
  if (!daily.withinLimit) {
    return { send: false, reason: `Daily limit reached (${daily.sent}/${MAX_DAILY_NOTIFICATIONS})` };
  }

  // Check weekly limit
  const weekly = checkWeeklyLimit(events, now);
  if (!weekly.withinLimit) {
    return { send: false, reason: `Weekly limit reached (${weekly.sent}/${MAX_WEEKLY_NOTIFICATIONS})` };
  }

  // Check fatigue
  const fatigue = checkFatigue(events, now);
  if (fatigue.isFatigued) {
    return { send: false, reason: fatigue.recommendation };
  }

  return { send: true, reason: "All checks passed" };
}

/**
 * Build optimization report.
 */
export function buildOptimizationReport(
  events: readonly NotificationEvent[],
  pattern: UserActivityPattern,
  now: number
): OptimizationReport {
  const optimalTimes = findOptimalSendTime(pattern);
  const fatigueStatus = checkFatigue(events, now);
  const effectiveness = calculateEffectiveness(events);

  const recommendations: string[] = [];

  // Suggest best channels
  const byChannel = effectiveness.reduce((acc, e) => {
    if (!acc[e.channel]) acc[e.channel] = { total: 0, clicked: 0 };
    acc[e.channel].total += e.sent;
    acc[e.channel].clicked += e.clicked;
    return acc;
  }, {} as Record<string, { total: number; clicked: number }>);

  for (const [channel, stats] of Object.entries(byChannel)) {
    const clickRate = stats.total > 0 ? stats.clicked / stats.total : 0;
    if (clickRate > 0.2) {
      recommendations.push(`${channel} has strong click rate (${Math.round(clickRate * 100)}%) — increase usage`);
    } else if (clickRate < 0.05 && stats.total >= 10) {
      recommendations.push(`${channel} has low click rate (${Math.round(clickRate * 100)}%) — consider reducing or improving content`);
    }
  }

  if (fatigueStatus.isFatigued) {
    recommendations.push("User is fatigued — reduce notification frequency");
  }

  if (optimalTimes.length > 0) {
    recommendations.push(`Best send time: ${optimalTimes[0].hour}:00 (confidence: ${Math.round(optimalTimes[0].confidence * 100)}%)`);
  }

  // Score
  const avgOpenRate = effectiveness.reduce((sum, e) => sum + e.openRate, 0) / Math.max(1, effectiveness.length);
  let score = Math.round(avgOpenRate * 100);
  if (fatigueStatus.isFatigued) score -= 20;
  score = Math.max(0, Math.min(100, score));

  return {
    optimalTimes,
    fatigueStatus,
    effectiveness,
    recommendations,
    overallScore: score,
  };
}

/**
 * Format optimization report as string.
 */
export function formatOptimizationReport(report: OptimizationReport): string {
  const lines = [
    `=== Notification Optimization ===`,
    `Score: ${report.overallScore}/100`,
    `Fatigue: ${report.fatigueStatus.isFatigued ? "⚠️ Yes" : "✅ No"}`,
    "",
    "--- Optimal Send Times ---",
  ];

  for (const time of report.optimalTimes) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    lines.push(`  ${days[time.dayOfWeek]} ${time.hour}:00 (${Math.round(time.confidence * 100)}%)`);
  }

  if (report.effectiveness.length > 0) {
    lines.push("", "--- Channel Effectiveness ---");
    for (const eff of report.effectiveness) {
      lines.push(`  ${eff.channel}/${eff.category}: open=${Math.round(eff.openRate * 100)}% click=${Math.round(eff.clickRate * 100)}% (n=${eff.sent})`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("", "--- Recommendations ---");
    for (const rec of report.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  return lines.join("\n");
}
