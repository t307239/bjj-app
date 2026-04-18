/**
 * supportTicketRouter.ts — Automated support ticket classification & routing
 *
 * Classifies user issues, suggests auto-responses, routes to appropriate
 * handling queues, and tracks resolution metrics.
 *
 * Pure functions — no external APIs.
 *
 * @module Q-192 Ops 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type TicketCategory =
  | "billing"
  | "account"
  | "bug"
  | "feature_request"
  | "data_export"
  | "privacy"
  | "general";

export type TicketPriority = "p1_critical" | "p2_high" | "p3_medium" | "p4_low";

export interface SupportTicket {
  readonly id: string;
  readonly subject: string;
  readonly body: string;
  readonly userEmail: string;
  readonly isPro: boolean;
  readonly createdAt: number;
  readonly language: string;
}

export interface ClassifiedTicket {
  readonly ticket: SupportTicket;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly confidence: number;
  readonly suggestedResponse: string | null;
  readonly autoResolvable: boolean;
  readonly escalationRequired: boolean;
  readonly tags: readonly string[];
}

export interface ResponseTemplate {
  readonly id: string;
  readonly category: TicketCategory;
  readonly pattern: string;
  readonly response_ja: string;
  readonly response_en: string;
  readonly autoResolvable: boolean;
}

export interface RoutingRule {
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly queue: string;
  readonly slaMinutes: number;
  readonly autoResponse: boolean;
}

export interface TicketMetrics {
  readonly totalTickets: number;
  readonly byCategory: Record<TicketCategory, number>;
  readonly byPriority: Record<TicketPriority, number>;
  readonly autoResolved: number;
  readonly autoResolveRate: number;
  readonly avgConfidence: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Keyword patterns for classification */
export const CATEGORY_PATTERNS: Record<TicketCategory, readonly RegExp[]> = {
  billing: [
    /支払い|請求|課金|返金|refund|billing|payment|charge|invoice|stripe|subscription|cancel|解約|pro|premium|プラン/i,
  ],
  account: [
    /ログイン|パスワード|アカウント|login|password|account|auth|認証|sign.?in|サインイン|削除|delete.?account/i,
  ],
  bug: [
    /バグ|エラー|動かない|表示されない|bug|error|crash|broken|not.?working|fix|おかしい|壊れ/i,
  ],
  feature_request: [
    /機能|追加|要望|ほしい|feature|request|suggest|improvement|改善|追加してほしい|want/i,
  ],
  data_export: [
    /エクスポート|データ|export|download|csv|pdf|ダウンロード|バックアップ|backup/i,
  ],
  privacy: [
    /プライバシー|個人情報|privacy|gdpr|ccpa|data.?protection|削除依頼|right.?to.?be.?forgotten/i,
  ],
  general: [],
};

/** Priority rules based on category and user type */
export const ROUTING_RULES: readonly RoutingRule[] = [
  { category: "billing", priority: "p2_high", queue: "billing", slaMinutes: 120, autoResponse: true },
  { category: "account", priority: "p2_high", queue: "account", slaMinutes: 60, autoResponse: true },
  { category: "bug", priority: "p2_high", queue: "engineering", slaMinutes: 240, autoResponse: false },
  { category: "feature_request", priority: "p4_low", queue: "product", slaMinutes: 1440, autoResponse: true },
  { category: "data_export", priority: "p3_medium", queue: "account", slaMinutes: 240, autoResponse: true },
  { category: "privacy", priority: "p1_critical", queue: "legal", slaMinutes: 60, autoResponse: false },
  { category: "general", priority: "p3_medium", queue: "support", slaMinutes: 480, autoResponse: false },
];

/** Auto-response templates */
export const RESPONSE_TEMPLATES: readonly ResponseTemplate[] = [
  {
    id: "billing_cancel",
    category: "billing",
    pattern: "cancel|解約|キャンセル",
    response_ja: "解約はマイページ > 設定 > サブスクリプション管理からいつでも可能です。7日以内であれば返金も承ります。",
    response_en: "You can cancel anytime from Profile > Settings > Manage Subscription. Refunds are available within 7 days.",
    autoResolvable: true,
  },
  {
    id: "billing_refund",
    category: "billing",
    pattern: "refund|返金",
    response_ja: "購入から7日以内であれば全額返金いたします。マイページの設定から解約後、このメールに返信してください。",
    response_en: "Full refunds are available within 7 days of purchase. Please cancel from Settings and reply to this email.",
    autoResolvable: false,
  },
  {
    id: "account_password",
    category: "account",
    pattern: "password|パスワード|ログインできない",
    response_ja: "ログインページの「パスワードを忘れた場合」からリセットできます。Magic Linkでのログインも可能です。",
    response_en: "You can reset your password from the login page. Magic Link login is also available.",
    autoResolvable: true,
  },
  {
    id: "account_delete",
    category: "account",
    pattern: "delete.?account|アカウント削除",
    response_ja: "マイページ > 設定 > アカウント削除から削除できます。30日間の復元猶予があります。",
    response_en: "You can delete your account from Profile > Settings > Delete Account. There's a 30-day recovery period.",
    autoResolvable: true,
  },
  {
    id: "export_data",
    category: "data_export",
    pattern: "export|エクスポート|download|ダウンロード",
    response_ja: "記録ページの「エクスポート」ボタンからCSV・PDF・JSONでダウンロードできます。",
    response_en: "You can download your data as CSV, PDF, or JSON from the Records page export button.",
    autoResolvable: true,
  },
  {
    id: "privacy_data_request",
    category: "privacy",
    pattern: "personal.?data|個人情報|gdpr|right.?to",
    response_ja: "データに関するリクエストは48時間以内に対応いたします。記録のエクスポートはアプリ内から即時可能です。",
    response_en: "Data requests are processed within 48 hours. You can export your records immediately from the app.",
    autoResolvable: false,
  },
];

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Classify ticket category based on keyword matching.
 */
export function classifyCategory(
  subject: string,
  body: string
): { category: TicketCategory; confidence: number } {
  const text = `${subject} ${body}`.toLowerCase();
  const scores: Record<TicketCategory, number> = {
    billing: 0,
    account: 0,
    bug: 0,
    feature_request: 0,
    data_export: 0,
    privacy: 0,
    general: 0,
  };

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS) as [TicketCategory, RegExp[]][]) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        scores[category] += matches.length;
      }
    }
  }

  const entries = Object.entries(scores) as [TicketCategory, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);

  if (sorted[0][1] === 0) {
    return { category: "general", confidence: 0.3 };
  }

  const topScore = sorted[0][1];
  const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(0.95, topScore / Math.max(1, totalScore));

  return {
    category: sorted[0][0],
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Determine priority based on category and user context.
 */
export function determinePriority(
  category: TicketCategory,
  isPro: boolean
): TicketPriority {
  // Privacy is always P1
  if (category === "privacy") return "p1_critical";

  // Pro users get elevated priority
  if (isPro) {
    if (category === "billing" || category === "account" || category === "bug") {
      return "p1_critical";
    }
    return "p2_high";
  }

  const rule = ROUTING_RULES.find((r) => r.category === category);
  return rule?.priority ?? "p3_medium";
}

/**
 * Find matching response template.
 */
export function findResponseTemplate(
  category: TicketCategory,
  text: string,
  language: string
): ResponseTemplate | null {
  const templates = RESPONSE_TEMPLATES.filter((t) => t.category === category);

  for (const template of templates) {
    const pattern = new RegExp(template.pattern, "i");
    if (pattern.test(text)) {
      return template;
    }
  }

  return null;
}

/**
 * Get suggested response text.
 */
export function getSuggestedResponse(
  template: ResponseTemplate | null,
  language: string
): string | null {
  if (!template) return null;
  return language.startsWith("ja") ? template.response_ja : template.response_en;
}

/**
 * Get routing rule for a category.
 */
export function getRoutingRule(category: TicketCategory): RoutingRule | null {
  return ROUTING_RULES.find((r) => r.category === category) ?? null;
}

/**
 * Classify and route a support ticket.
 */
export function classifyTicket(ticket: SupportTicket): ClassifiedTicket {
  const text = `${ticket.subject} ${ticket.body}`;
  const { category, confidence } = classifyCategory(ticket.subject, ticket.body);
  const priority = determinePriority(category, ticket.isPro);
  const template = findResponseTemplate(category, text, ticket.language);
  const suggestedResponse = getSuggestedResponse(template, ticket.language);
  const autoResolvable = template?.autoResolvable ?? false;
  const escalationRequired = priority === "p1_critical" || category === "privacy";

  const tags: string[] = [category];
  if (ticket.isPro) tags.push("pro_user");
  if (escalationRequired) tags.push("needs_escalation");
  if (autoResolvable) tags.push("auto_resolvable");

  return {
    ticket,
    category,
    priority,
    confidence,
    suggestedResponse,
    autoResolvable,
    escalationRequired,
    tags,
  };
}

/**
 * Build ticket metrics from classified tickets.
 */
export function buildTicketMetrics(
  tickets: readonly ClassifiedTicket[]
): TicketMetrics {
  const byCategory: Record<TicketCategory, number> = {
    billing: 0, account: 0, bug: 0, feature_request: 0,
    data_export: 0, privacy: 0, general: 0,
  };
  const byPriority: Record<TicketPriority, number> = {
    p1_critical: 0, p2_high: 0, p3_medium: 0, p4_low: 0,
  };

  let autoResolved = 0;
  let totalConfidence = 0;

  for (const t of tickets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    if (t.autoResolvable) autoResolved++;
    totalConfidence += t.confidence;
  }

  return {
    totalTickets: tickets.length,
    byCategory,
    byPriority,
    autoResolved,
    autoResolveRate: tickets.length > 0 ? Math.round((autoResolved / tickets.length) * 100) / 100 : 0,
    avgConfidence: tickets.length > 0 ? Math.round((totalConfidence / tickets.length) * 100) / 100 : 0,
  };
}

/**
 * Format ticket metrics as string.
 */
export function formatTicketMetrics(metrics: TicketMetrics): string {
  const lines = [
    `=== Support Ticket Metrics ===`,
    `Total: ${metrics.totalTickets}`,
    `Auto-resolved: ${metrics.autoResolved} (${Math.round(metrics.autoResolveRate * 100)}%)`,
    `Avg confidence: ${Math.round(metrics.avgConfidence * 100)}%`,
    "",
    "By category:",
  ];

  for (const [cat, count] of Object.entries(metrics.byCategory)) {
    if (count > 0) lines.push(`  ${cat}: ${count}`);
  }

  lines.push("", "By priority:");
  for (const [pri, count] of Object.entries(metrics.byPriority)) {
    if (count > 0) lines.push(`  ${pri}: ${count}`);
  }

  return lines.join("\n");
}
