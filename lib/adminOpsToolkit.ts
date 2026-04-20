/**
 * lib/adminOpsToolkit.ts — Self-service admin operations toolkit
 *
 * Q-232: Ops pillar — provides structured query builders, ticket
 * classification, canned responses, and dashboard metrics for
 * admin/support workflows.
 *
 * Pure utility layer — no DB access, no UI. Consumers pass data in,
 * get computed results back.
 *
 * @example
 *   import { classifyTicketPriority, generateCannedResponse } from "@/lib/adminOpsToolkit";
 *   const priority = classifyTicketPriority("Payment failed", "My card was declined");
 *   const response = generateCannedResponse("billing", "ja");
 */

// ── Types ────────────────────────────────────────────────────────────────

export type TicketPriority = "P1" | "P2" | "P3" | "P4";

export type TicketCategory =
  | "billing"
  | "account"
  | "bug"
  | "feature"
  | "security"
  | "general";

export type SupportLocale = "ja" | "en";

export interface AdminOperation {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly requiresConfirmation: boolean;
}

export interface OperationResult {
  readonly operationId: string;
  readonly success: boolean;
  readonly message: string;
  readonly data: unknown;
  readonly timestamp: string;
}

export interface BulkOperationResult {
  readonly operationId: string;
  readonly totalItems: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errors: Array<{ index: number; message: string }>;
  readonly timestamp: string;
}

export interface AdminQuery {
  readonly type: string;
  readonly filters: Record<string, unknown>;
  readonly description: string;
}

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export interface UserHealthIssue {
  readonly field: string;
  readonly severity: "low" | "medium" | "high";
  readonly message: string;
}

export interface UserProfile {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly subscriptionStatus?: string;
  readonly subscriptionEndDate?: string;
  readonly lastLoginAt?: string;
  readonly createdAt?: string;
  readonly beltRank?: string;
}

export interface SupportTicket {
  readonly id: string;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly subject: string;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export interface AdminDashboardMetrics {
  readonly totalUsers: number;
  readonly activeSubscriptions: number;
  readonly openTickets: number;
  readonly avgResponseTimeHours: number;
  readonly ticketsByPriority: Record<TicketPriority, number>;
  readonly ticketsByCategory: Record<TicketCategory, number>;
  readonly healthScore: number;
  readonly generatedAt: string;
}

// ── Query Builders ───────────────────────────────────────────────────────

/** Build a structured query for user lookup by email or userId */
export function buildUserLookup(identifier: string): AdminQuery {
  const isEmail = identifier.includes("@");
  return {
    type: "user_lookup",
    filters: isEmail
      ? { email: identifier }
      : { userId: identifier },
    description: `Lookup user by ${isEmail ? "email" : "userId"}: ${identifier}`,
  };
}

/** Build a subscription state query */
export function buildSubscriptionQuery(
  status: string,
  dateRange?: DateRange,
): AdminQuery {
  return {
    type: "subscription_query",
    filters: {
      status,
      ...(dateRange ? { startDate: dateRange.start, endDate: dateRange.end } : {}),
    },
    description: `Subscriptions with status "${status}"${dateRange ? ` between ${dateRange.start} and ${dateRange.end}` : ""}`,
  };
}

/** Build a user activity summary query */
export function buildActivityReport(
  userId: string,
  dateRange: DateRange,
): AdminQuery {
  return {
    type: "activity_report",
    filters: {
      userId,
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    description: `Activity report for user ${userId} from ${dateRange.start} to ${dateRange.end}`,
  };
}

// ── Ticket Classification ────────────────────────────────────────────────

const P1_KEYWORDS = [
  "down", "outage", "cannot login", "data loss", "ログインできない",
  "データ消えた", "障害", "セキュリティ", "security breach", "hacked",
];
const P2_KEYWORDS = [
  "payment", "billing", "charged", "refund", "課金", "請求",
  "返金", "subscription", "サブスクリプション", "error", "エラー",
];
const P3_KEYWORDS = [
  "bug", "broken", "not working", "バグ", "動かない", "表示されない",
  "crash", "クラッシュ", "slow", "遅い",
];

/** Classify ticket priority based on keyword analysis (P1 = critical) */
export function classifyTicketPriority(
  subject: string,
  body: string,
): TicketPriority {
  const text = `${subject} ${body}`.toLowerCase();

  if (P1_KEYWORDS.some((kw) => text.includes(kw))) return "P1";
  if (P2_KEYWORDS.some((kw) => text.includes(kw))) return "P2";
  if (P3_KEYWORDS.some((kw) => text.includes(kw))) return "P3";
  return "P4";
}

// ── Canned Responses ─────────────────────────────────────────────────────

export const CANNED_RESPONSES: Record<
  TicketCategory,
  Record<SupportLocale, string>
> = {
  billing: {
    ja: "お支払いに関するお問い合わせありがとうございます。確認の上、1営業日以内にご回答いたします。請求明細をご確認ください。",
    en: "Thank you for contacting us about billing. We will review your account and respond within 1 business day. Please check your billing statement in the meantime.",
  },
  account: {
    ja: "アカウントに関するお問い合わせありがとうございます。本人確認のため、登録メールアドレスからご連絡ください。",
    en: "Thank you for your account inquiry. For security, please contact us from your registered email address.",
  },
  bug: {
    ja: "不具合のご報告ありがとうございます。開発チームにて調査いたします。再現手順をお知らせいただけると早期解決につながります。",
    en: "Thank you for reporting this issue. Our team is investigating. If you can share steps to reproduce, it will help us resolve it faster.",
  },
  feature: {
    ja: "機能リクエストありがとうございます。開発ロードマップへの追加を検討いたします。",
    en: "Thank you for your feature request. We will consider adding it to our development roadmap.",
  },
  security: {
    ja: "セキュリティに関するご報告ありがとうございます。最優先で調査いたします。追加情報があればお知らせください。",
    en: "Thank you for your security report. We are investigating this with the highest priority. Please share any additional information.",
  },
  general: {
    ja: "お問い合わせありがとうございます。内容を確認の上、できるだけ早くご回答いたします。",
    en: "Thank you for reaching out. We will review your inquiry and respond as soon as possible.",
  },
};

/** Generate a canned response for a given category and locale */
export function generateCannedResponse(
  category: TicketCategory,
  locale: SupportLocale,
): string {
  return CANNED_RESPONSES[category][locale];
}

// ── User Health Check ────────────────────────────────────────────────────

/** Check user account health for common issues */
export function buildUserHealthCheck(
  profile: UserProfile,
): UserHealthIssue[] {
  const issues: UserHealthIssue[] = [];

  if (!profile.email) {
    issues.push({
      field: "email",
      severity: "high",
      message: "Missing email address — account recovery impossible",
    });
  }

  if (!profile.displayName) {
    issues.push({
      field: "displayName",
      severity: "low",
      message: "Missing display name",
    });
  }

  if (
    profile.subscriptionStatus === "active" &&
    profile.subscriptionEndDate
  ) {
    const endDate = new Date(profile.subscriptionEndDate);
    const now = new Date();
    if (endDate < now) {
      issues.push({
        field: "subscriptionEndDate",
        severity: "high",
        message: "Active subscription with past end date — stale subscription",
      });
    }
  }

  if (profile.lastLoginAt) {
    const lastLogin = new Date(profile.lastLoginAt);
    const now = new Date();
    const daysSinceLogin = Math.floor(
      (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLogin > 180) {
      issues.push({
        field: "lastLoginAt",
        severity: "medium",
        message: `No login for ${daysSinceLogin} days — potential orphan account`,
      });
    }
  }

  if (!profile.beltRank) {
    issues.push({
      field: "beltRank",
      severity: "low",
      message: "Missing belt rank — profile incomplete",
    });
  }

  return issues;
}

// ── SLA Estimation ───────────────────────────────────────────────────────

/** Estimate response time based on priority and category (in hours) */
export function estimateResponseTime(
  priority: TicketPriority,
  _category: TicketCategory,
): number {
  const slaHours: Record<TicketPriority, number> = {
    P1: 1,
    P2: 4,
    P3: 24,
    P4: 72,
  };
  return slaHours[priority];
}

// ── Dashboard Metrics ────────────────────────────────────────────────────

/** Aggregate admin dashboard metrics from raw data */
export function buildAdminDashboardMetrics(
  users: { total: number },
  subscriptions: { active: number },
  tickets: SupportTicket[],
): AdminDashboardMetrics {
  const byPriority: Record<TicketPriority, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };
  const byCategory: Record<TicketCategory, number> = {
    billing: 0,
    account: 0,
    bug: 0,
    feature: 0,
    security: 0,
    general: 0,
  };

  let resolvedCount = 0;
  let totalResponseHours = 0;

  for (const t of tickets) {
    byPriority[t.priority] += 1;
    byCategory[t.category] += 1;

    if (t.resolvedAt) {
      resolvedCount += 1;
      const created = new Date(t.createdAt).getTime();
      const resolved = new Date(t.resolvedAt).getTime();
      totalResponseHours += (resolved - created) / (1000 * 60 * 60);
    }
  }

  const openTickets = tickets.length - resolvedCount;
  const avgResponseTimeHours =
    resolvedCount > 0
      ? Math.round((totalResponseHours / resolvedCount) * 10) / 10
      : 0;

  // Health score: 100 minus penalties
  let healthScore = 100;
  healthScore -= byPriority.P1 * 10;
  healthScore -= byPriority.P2 * 3;
  healthScore -= openTickets > 20 ? 10 : 0;
  healthScore -= avgResponseTimeHours > 24 ? 10 : 0;
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    totalUsers: users.total,
    activeSubscriptions: subscriptions.active,
    openTickets,
    avgResponseTimeHours,
    ticketsByPriority: byPriority,
    ticketsByCategory: byCategory,
    healthScore,
    generatedAt: new Date().toISOString(),
  };
}

/** Format admin metrics as human-readable text */
export function formatAdminReport(metrics: AdminDashboardMetrics): string {
  const lines = [
    "=== Admin Dashboard Report ===",
    `Generated: ${metrics.generatedAt}`,
    "",
    `Users: ${metrics.totalUsers}`,
    `Active Subscriptions: ${metrics.activeSubscriptions}`,
    `Open Tickets: ${metrics.openTickets}`,
    `Avg Response Time: ${metrics.avgResponseTimeHours}h`,
    `Health Score: ${metrics.healthScore}/100`,
    "",
    "Tickets by Priority:",
    `  P1 (Critical): ${metrics.ticketsByPriority.P1}`,
    `  P2 (High):     ${metrics.ticketsByPriority.P2}`,
    `  P3 (Medium):   ${metrics.ticketsByPriority.P3}`,
    `  P4 (Low):      ${metrics.ticketsByPriority.P4}`,
    "",
    "Tickets by Category:",
    ...Object.entries(metrics.ticketsByCategory).map(
      ([cat, count]) => `  ${cat}: ${count}`,
    ),
  ];
  return lines.join("\n");
}

// ── Pattern Detection ────────────────────────────────────────────────────

/** Detect recurring support patterns from ticket history */
export function detectSupportPatterns(tickets: SupportTicket[]): {
  topCategories: Array<{ category: TicketCategory; count: number }>;
  peakHours: number[];
  resolutionRate: number;
  avgResolutionHours: number;
} {
  const categoryCount: Record<string, number> = {};
  const hourBuckets: Record<number, number> = {};
  let resolvedCount = 0;
  let totalResolutionHours = 0;

  for (const t of tickets) {
    categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1;

    const hour = new Date(t.createdAt).getHours();
    hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;

    if (t.resolvedAt) {
      resolvedCount += 1;
      const created = new Date(t.createdAt).getTime();
      const resolved = new Date(t.resolvedAt).getTime();
      totalResolutionHours += (resolved - created) / (1000 * 60 * 60);
    }
  }

  const topCategories = Object.entries(categoryCount)
    .map(([category, count]) => ({
      category: category as TicketCategory,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Peak hours: top 3 hours by ticket volume
  const peakHours = Object.entries(hourBuckets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => Number(hour));

  return {
    topCategories,
    peakHours,
    resolutionRate:
      tickets.length > 0 ? resolvedCount / tickets.length : 0,
    avgResolutionHours:
      resolvedCount > 0
        ? Math.round((totalResolutionHours / resolvedCount) * 10) / 10
        : 0,
  };
}

// ── Constants ────────────────────────────────────────────────────────────

/** Catalog of all available self-service admin operations */
export const ADMIN_OPERATIONS: readonly AdminOperation[] = [
  {
    id: "user_lookup",
    name: "User Lookup",
    category: "users",
    description: "Look up user by email or ID",
    requiresConfirmation: false,
  },
  {
    id: "subscription_query",
    name: "Subscription Query",
    category: "billing",
    description: "Query subscriptions by status and date range",
    requiresConfirmation: false,
  },
  {
    id: "activity_report",
    name: "Activity Report",
    category: "analytics",
    description: "Generate user activity summary for a date range",
    requiresConfirmation: false,
  },
  {
    id: "ticket_classify",
    name: "Ticket Classification",
    category: "support",
    description: "Auto-classify ticket priority based on content",
    requiresConfirmation: false,
  },
  {
    id: "health_check",
    name: "User Health Check",
    category: "users",
    description: "Check user account for orphan data and stale subscriptions",
    requiresConfirmation: false,
  },
  {
    id: "canned_response",
    name: "Canned Response",
    category: "support",
    description: "Generate template response for common support queries",
    requiresConfirmation: false,
  },
  {
    id: "dashboard_metrics",
    name: "Dashboard Metrics",
    category: "analytics",
    description: "Aggregate admin dashboard metrics",
    requiresConfirmation: false,
  },
  {
    id: "pattern_detection",
    name: "Support Pattern Detection",
    category: "analytics",
    description: "Detect recurring issues from ticket history",
    requiresConfirmation: false,
  },
] as const;
