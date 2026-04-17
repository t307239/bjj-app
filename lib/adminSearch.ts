/**
 * lib/adminSearch.ts — Admin panel search and filter utilities
 *
 * Q-141: Ops pillar — provides user search, log filtering,
 * and pagination utilities for the admin panel.
 * Reduces manual DB queries and Supabase Dashboard dependency.
 *
 * @example
 *   import { buildUserSearchQuery, paginateResults, maskEmail } from "@/lib/adminSearch";
 *   const query = buildUserSearchQuery("toshi", { belt: "purple" });
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface UserSearchFilters {
  /** Search by email (partial match) */
  email?: string;
  /** Filter by belt color */
  belt?: string;
  /** Filter by Pro status */
  isPro?: boolean;
  /** Filter by active in last N days */
  activeWithinDays?: number;
  /** Filter by signup date (after) */
  signupAfter?: string;
  /** Filter by signup date (before) */
  signupBefore?: string;
}

export interface SearchQuery {
  /** SQL WHERE conditions */
  conditions: string[];
  /** Parameter values (for parameterized queries) */
  params: unknown[];
  /** ORDER BY clause */
  orderBy: string;
}

export interface PaginationOptions {
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  perPage: number;
}

export interface PaginatedResult<T> {
  /** Current page items */
  items: T[];
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

export interface AdminLogFilter {
  /** Filter by user ID */
  userId?: string;
  /** Filter by action type */
  action?: string;
  /** Date range start (ISO) */
  from?: string;
  /** Date range end (ISO) */
  to?: string;
  /** Filter by severity */
  severity?: "info" | "warning" | "error";
}

// ── Constants ────────────────────────────────────────────────────────────

/** Default pagination */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

// ── Email Masking ────────────────────────────────────────────────────────

/**
 * Mask an email address for admin display.
 * Shows first 2 chars + domain: "to***@gmail.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

/**
 * Mask an email partially for search result display.
 * Shows more context: "tosh***@gmail.com"
 */
export function maskEmailPartial(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = Math.min(4, Math.floor(local.length * 0.6));
  return `${local.slice(0, visible)}***@${domain}`;
}

// ── Search Query Builder ─────────────────────────────────────────────────

/**
 * Build a search query from filters.
 * Returns SQL-like conditions for Supabase .or() / .filter() chaining.
 */
export function buildUserSearchQuery(
  searchTerm: string,
  filters: UserSearchFilters = {},
): SearchQuery {
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Text search (email or display name)
  if (searchTerm.trim()) {
    conditions.push("email.ilike.%$1%,display_name.ilike.%$1%");
    params.push(searchTerm.trim().toLowerCase());
  }

  // Email filter
  if (filters.email) {
    conditions.push("email.ilike.%$%");
    params.push(filters.email.toLowerCase());
  }

  // Belt filter
  if (filters.belt) {
    conditions.push("belt.eq.$");
    params.push(filters.belt);
  }

  // Pro status filter
  if (filters.isPro !== undefined) {
    conditions.push("is_pro.eq.$");
    params.push(filters.isPro);
  }

  // Signup date range
  if (filters.signupAfter) {
    conditions.push("created_at.gte.$");
    params.push(filters.signupAfter);
  }
  if (filters.signupBefore) {
    conditions.push("created_at.lte.$");
    params.push(filters.signupBefore);
  }

  return {
    conditions,
    params,
    orderBy: "created_at.desc",
  };
}

// ── Pagination ───────────────────────────────────────────────────────────

/**
 * Apply pagination to an array of items.
 */
export function paginateResults<T>(
  items: T[],
  options: PaginationOptions = { page: DEFAULT_PAGE, perPage: DEFAULT_PER_PAGE },
): PaginatedResult<T> {
  const page = Math.max(1, options.page);
  const perPage = Math.min(Math.max(1, options.perPage), MAX_PER_PAGE);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const start = (page - 1) * perPage;
  const end = start + perPage;
  const pageItems = items.slice(start, end);

  return {
    items: pageItems,
    page,
    perPage,
    totalItems,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Calculate Supabase range parameters for pagination.
 * Returns [from, to] for .range(from, to).
 */
export function supabaseRange(
  page: number,
  perPage: number = DEFAULT_PER_PAGE,
): [number, number] {
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(Math.max(1, perPage), MAX_PER_PAGE);
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  return [from, to];
}

// ── Log Filtering ────────────────────────────────────────────────────────

/**
 * Build filter conditions for admin log queries.
 */
export function buildLogFilter(filter: AdminLogFilter): SearchQuery {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    conditions.push("user_id.eq.$");
    params.push(filter.userId);
  }
  if (filter.action) {
    conditions.push("action.eq.$");
    params.push(filter.action);
  }
  if (filter.from) {
    conditions.push("created_at.gte.$");
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push("created_at.lte.$");
    params.push(filter.to);
  }
  if (filter.severity) {
    conditions.push("severity.eq.$");
    params.push(filter.severity);
  }

  return {
    conditions,
    params,
    orderBy: "created_at.desc",
  };
}

/**
 * Format admin activity summary for display.
 */
export function formatAdminSummary(stats: {
  totalUsers: number;
  proUsers: number;
  activeToday: number;
  newSignups7d: number;
}): string {
  const proRate = stats.totalUsers > 0
    ? Math.round((stats.proUsers / stats.totalUsers) * 100)
    : 0;
  return [
    `Users: ${stats.totalUsers} (${stats.proUsers} Pro, ${proRate}%)`,
    `Active today: ${stats.activeToday}`,
    `New signups (7d): ${stats.newSignups7d}`,
  ].join(" | ");
}
