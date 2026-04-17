/**
 * lib/costAllocator.ts — Per-user cost allocation & ROI analysis
 *
 * Q-155: Cost pillar — provides user-level cost allocation,
 * LTV/CAC ratio calculation, and unit economics analysis
 * for understanding profitability at different user segments.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { allocateUserCost, calculateLTV, analyzeUnitEconomics, COST_CENTERS } from "@/lib/costAllocator";
 *   const cost = allocateUserCost(usage, "free");
 *   const ltv = calculateLTV(monthlyRevenue, churnRate);
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface UserUsage {
  /** Monthly API requests */
  apiRequests: number;
  /** Storage used in MB */
  storageMB: number;
  /** AI Coach queries (Pro only) */
  aiQueries: number;
  /** Push notifications sent */
  pushNotifications: number;
  /** Email sends */
  emailsSent: number;
}

export interface CostAllocation {
  /** User tier */
  tier: UserTier;
  /** Compute cost (Vercel serverless) */
  compute: number;
  /** Storage cost (Supabase) */
  storage: number;
  /** AI cost (OpenAI) */
  ai: number;
  /** Notification cost (Push + Email) */
  notification: number;
  /** Stripe fees (if paying) */
  stripeFees: number;
  /** Total monthly cost */
  total: number;
  /** Cost per API request */
  costPerRequest: number;
}

export type UserTier = "free" | "pro_monthly" | "pro_annual";

export interface UnitEconomics {
  /** LTV (Lifetime Value) */
  ltv: number;
  /** CAC (Customer Acquisition Cost) */
  cac: number;
  /** LTV/CAC ratio */
  ltvCacRatio: number;
  /** Monthly ARPU */
  arpu: number;
  /** Gross margin */
  grossMargin: number;
  /** Payback period in months */
  paybackMonths: number;
  /** Assessment */
  assessment: "excellent" | "healthy" | "concerning" | "unsustainable";
}

export interface CostCenter {
  /** Center name */
  name: string;
  /** Per-unit cost */
  unitCost: number;
  /** Unit description */
  unit: string;
  /** Provider */
  provider: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Per-unit costs for each resource */
export const COST_CENTERS: Record<string, CostCenter> = {
  vercelInvocation: {
    name: "Serverless Invocation",
    unitCost: 0.000006, // ~$6 per 1M invocations (Hobby estimate)
    unit: "invocation",
    provider: "Vercel",
  },
  supabaseStorage: {
    name: "Database Storage",
    unitCost: 0.021, // ~$0.021/MB/month
    unit: "MB/month",
    provider: "Supabase",
  },
  openaiQuery: {
    name: "AI Coach Query",
    unitCost: 0.003, // ~$0.003 per query (GPT-4o-mini average)
    unit: "query",
    provider: "OpenAI",
  },
  pushNotification: {
    name: "Push Notification",
    unitCost: 0.0001, // ~$0.0001 per push (self-hosted VAPID)
    unit: "notification",
    provider: "Self-hosted",
  },
  emailSend: {
    name: "Email Send",
    unitCost: 0.001, // ~$0.001 per email (Resend)
    unit: "email",
    provider: "Resend",
  },
  stripeTransaction: {
    name: "Stripe Fee",
    unitCost: 0.036, // 3.6% of transaction
    unit: "% of amount",
    provider: "Stripe",
  },
};

/** Pricing for each tier (monthly) */
export const TIER_PRICING: Record<UserTier, number> = {
  free: 0,
  pro_monthly: 9.99,
  pro_annual: 6.67, // $80/year = $6.67/month
};

/** LTV/CAC ratio thresholds */
export const ECONOMICS_THRESHOLDS = {
  /** Excellent: LTV/CAC > 5x */
  excellent: 5,
  /** Healthy: LTV/CAC > 3x */
  healthy: 3,
  /** Concerning: LTV/CAC > 1x */
  concerning: 1,
} as const;

// ── Cost Allocation ─────────────────────────────────────────────────────

/**
 * Allocate costs to a single user based on usage.
 */
export function allocateUserCost(
  usage: UserUsage,
  tier: UserTier,
): CostAllocation {
  const compute = usage.apiRequests * COST_CENTERS.vercelInvocation.unitCost;
  const storage = usage.storageMB * COST_CENTERS.supabaseStorage.unitCost;
  const ai = usage.aiQueries * COST_CENTERS.openaiQuery.unitCost;
  const notification =
    usage.pushNotifications * COST_CENTERS.pushNotification.unitCost +
    usage.emailsSent * COST_CENTERS.emailSend.unitCost;

  const revenue = TIER_PRICING[tier];
  const stripeFees = revenue > 0 ? revenue * COST_CENTERS.stripeTransaction.unitCost + 0.11 : 0; // 3.6% + ¥40 ≈ $0.11

  const total = compute + storage + ai + notification + stripeFees;
  const costPerRequest = usage.apiRequests > 0 ? total / usage.apiRequests : 0;

  return {
    tier,
    compute,
    storage,
    ai,
    notification,
    stripeFees,
    total,
    costPerRequest,
  };
}

/**
 * Calculate LTV (Lifetime Value).
 * Formula: ARPU / monthly churn rate
 */
export function calculateLTV(
  monthlyRevenue: number,
  monthlyChurnRate: number,
): number {
  if (monthlyChurnRate <= 0) return monthlyRevenue * 120; // cap at 10 years
  return monthlyRevenue / monthlyChurnRate;
}

/**
 * Calculate CAC (Customer Acquisition Cost).
 */
export function calculateCAC(
  totalMarketingSpend: number,
  newCustomers: number,
): number {
  if (newCustomers <= 0) return 0;
  return totalMarketingSpend / newCustomers;
}

/**
 * Analyze unit economics.
 */
export function analyzeUnitEconomics(
  monthlyRevenue: number,
  monthlyCost: number,
  monthlyChurnRate: number,
  cac: number,
): UnitEconomics {
  const ltv = calculateLTV(monthlyRevenue, monthlyChurnRate);
  const ltvCacRatio = cac > 0 ? ltv / cac : ltv > 0 ? Infinity : 0;
  const grossMargin = monthlyRevenue > 0 ? (monthlyRevenue - monthlyCost) / monthlyRevenue : 0;
  const paybackMonths = monthlyRevenue > monthlyCost
    ? cac / (monthlyRevenue - monthlyCost)
    : Infinity;

  let assessment: UnitEconomics["assessment"];
  if (ltvCacRatio >= ECONOMICS_THRESHOLDS.excellent) {
    assessment = "excellent";
  } else if (ltvCacRatio >= ECONOMICS_THRESHOLDS.healthy) {
    assessment = "healthy";
  } else if (ltvCacRatio >= ECONOMICS_THRESHOLDS.concerning) {
    assessment = "concerning";
  } else {
    assessment = "unsustainable";
  }

  return {
    ltv,
    cac,
    ltvCacRatio,
    arpu: monthlyRevenue,
    grossMargin,
    paybackMonths,
    assessment,
  };
}

/**
 * Format a cost allocation as a human-readable string.
 */
export function formatCostAllocation(alloc: CostAllocation): string {
  return [
    `Cost (${alloc.tier}): $${alloc.total.toFixed(4)}/mo`,
    `  Compute: $${alloc.compute.toFixed(4)}`,
    `  Storage: $${alloc.storage.toFixed(4)}`,
    `  AI: $${alloc.ai.toFixed(4)}`,
    `  Notifications: $${alloc.notification.toFixed(4)}`,
    `  Stripe: $${alloc.stripeFees.toFixed(4)}`,
    `  Per request: $${alloc.costPerRequest.toFixed(6)}`,
  ].join("\n");
}

/**
 * Format unit economics summary.
 */
export function formatUnitEconomics(econ: UnitEconomics): string {
  const icon = econ.assessment === "excellent" ? "🟢" :
    econ.assessment === "healthy" ? "✅" :
    econ.assessment === "concerning" ? "⚠️" : "🔴";
  return `${icon} Unit Economics: LTV $${econ.ltv.toFixed(0)} / CAC $${econ.cac.toFixed(0)} = ${econ.ltvCacRatio.toFixed(1)}x (${econ.assessment})`;
}
