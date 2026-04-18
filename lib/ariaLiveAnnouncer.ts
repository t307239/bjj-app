/**
 * ariaLiveAnnouncer.ts — Centralized aria-live announcement manager
 *
 * Provides a pure-function approach to managing screen reader announcements,
 * keyboard trap detection, and reduced-motion preference handling.
 *
 * Pure functions — no DOM access. Returns configuration objects.
 *
 * @module Q-188 a11y 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type Politeness = "polite" | "assertive" | "off";

export interface Announcement {
  readonly message: string;
  readonly politeness: Politeness;
  readonly timestamp: number;
  readonly clearAfterMs: number;
  readonly id: string;
}

export interface AnnouncerConfig {
  readonly maxQueueSize: number;
  readonly defaultPoliteness: Politeness;
  readonly defaultClearAfterMs: number;
  readonly deduplicateWindowMs: number;
}

export interface AnnouncerState {
  readonly queue: readonly Announcement[];
  readonly history: readonly Announcement[];
  readonly config: AnnouncerConfig;
}

export interface KeyboardTrapCheck {
  readonly elementId: string;
  readonly hasFocusableChildren: boolean;
  readonly hasEscapeHandler: boolean;
  readonly hasTabTrapping: boolean;
  readonly issues: readonly string[];
  readonly severity: "pass" | "warning" | "fail";
}

export interface ReducedMotionConfig {
  readonly animationDuration: string;
  readonly transitionDuration: string;
  readonly useAnimations: boolean;
  readonly useParallax: boolean;
  readonly autoplayVideos: boolean;
}

export interface A11yAuditItem {
  readonly rule: string;
  readonly description: string;
  readonly severity: "error" | "warning" | "info";
  readonly element?: string;
  readonly fix: string;
}

export interface A11yAuditResult {
  readonly items: readonly A11yAuditItem[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly score: number;
  readonly grade: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_ANNOUNCER_CONFIG: AnnouncerConfig = {
  maxQueueSize: 10,
  defaultPoliteness: "polite",
  defaultClearAfterMs: 5000,
  deduplicateWindowMs: 1000,
};

export const REDUCED_MOTION_CONFIG: ReducedMotionConfig = {
  animationDuration: "0.01ms",
  transitionDuration: "0.01ms",
  useAnimations: false,
  useParallax: false,
  autoplayVideos: false,
};

export const FULL_MOTION_CONFIG: ReducedMotionConfig = {
  animationDuration: "300ms",
  transitionDuration: "200ms",
  useAnimations: true,
  useParallax: true,
  autoplayVideos: true,
};

/** ARIA roles that require specific attributes */
export const ROLE_REQUIREMENTS: Record<string, readonly string[]> = {
  alert: ["aria-live"],
  alertdialog: ["aria-label", "aria-describedby"],
  dialog: ["aria-label", "aria-modal"],
  progressbar: ["aria-valuenow", "aria-valuemin", "aria-valuemax"],
  slider: ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-label"],
  tab: ["aria-selected", "aria-controls"],
  tabpanel: ["aria-labelledby"],
  combobox: ["aria-expanded", "aria-controls"],
  listbox: ["aria-label"],
  menu: ["aria-label"],
  menuitem: ["role"],
  tree: ["aria-label"],
  treeitem: ["aria-expanded"],
};

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Create initial announcer state.
 */
export function createAnnouncerState(
  config?: Partial<AnnouncerConfig>
): AnnouncerState {
  return {
    queue: [],
    history: [],
    config: { ...DEFAULT_ANNOUNCER_CONFIG, ...config },
  };
}

/**
 * Generate a unique announcement ID.
 */
function generateId(message: string, timestamp: number): string {
  let hash = 0;
  const str = `${message}-${timestamp}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `ann_${Math.abs(hash).toString(36)}`;
}

/**
 * Check if a message is a duplicate within the dedup window.
 */
function isDuplicate(
  state: AnnouncerState,
  message: string,
  timestamp: number
): boolean {
  const window = state.config.deduplicateWindowMs;
  return state.history.some(
    (a) =>
      a.message === message &&
      timestamp - a.timestamp < window
  );
}

/**
 * Add announcement to state (immutable).
 */
export function announce(
  state: AnnouncerState,
  message: string,
  options?: {
    politeness?: Politeness;
    clearAfterMs?: number;
    timestamp?: number;
  }
): AnnouncerState {
  const timestamp = options?.timestamp ?? Date.now();

  if (isDuplicate(state, message, timestamp)) {
    return state;
  }

  const announcement: Announcement = {
    message,
    politeness: options?.politeness ?? state.config.defaultPoliteness,
    timestamp,
    clearAfterMs: options?.clearAfterMs ?? state.config.defaultClearAfterMs,
    id: generateId(message, timestamp),
  };

  const newQueue = [...state.queue, announcement].slice(
    -state.config.maxQueueSize
  );

  return {
    ...state,
    queue: newQueue,
    history: [...state.history, announcement].slice(-50),
  };
}

/**
 * Clear expired announcements from queue.
 */
export function clearExpired(
  state: AnnouncerState,
  now: number
): AnnouncerState {
  const queue = state.queue.filter(
    (a) => now - a.timestamp < a.clearAfterMs
  );
  return { ...state, queue };
}

/**
 * Get the current announcement to display.
 */
export function getCurrentAnnouncement(
  state: AnnouncerState
): Announcement | null {
  if (state.queue.length === 0) return null;

  // Assertive messages take priority
  const assertive = state.queue.find((a) => a.politeness === "assertive");
  if (assertive) return assertive;

  return state.queue[state.queue.length - 1];
}

/**
 * Build aria-live region props.
 */
export function buildLiveRegionProps(
  politeness: Politeness = "polite"
): Record<string, string> {
  return {
    role: politeness === "assertive" ? "alert" : "status",
    "aria-live": politeness,
    "aria-atomic": "true",
  };
}

/**
 * Check for potential keyboard trap issues.
 */
export function checkKeyboardTrap(
  elementId: string,
  focusableCount: number,
  hasEscapeHandler: boolean,
  hasTabTrapping: boolean
): KeyboardTrapCheck {
  const issues: string[] = [];

  if (focusableCount === 0) {
    issues.push("No focusable children — keyboard users cannot interact");
  }

  if (hasTabTrapping && !hasEscapeHandler) {
    issues.push("Tab trapping without Escape handler — users may be stuck");
  }

  if (!hasTabTrapping && focusableCount > 0) {
    issues.push("Focusable children without tab trapping — focus may escape modal");
  }

  let severity: "pass" | "warning" | "fail" = "pass";
  if (issues.length > 0) {
    severity = issues.some((i) => i.includes("stuck") || i.includes("cannot"))
      ? "fail"
      : "warning";
  }

  return {
    elementId,
    hasFocusableChildren: focusableCount > 0,
    hasEscapeHandler,
    hasTabTrapping,
    issues,
    severity,
  };
}

/**
 * Get motion config based on user preference.
 */
export function getMotionConfig(prefersReducedMotion: boolean): ReducedMotionConfig {
  return prefersReducedMotion ? REDUCED_MOTION_CONFIG : FULL_MOTION_CONFIG;
}

/**
 * Validate ARIA role requirements.
 */
export function validateRoleAttributes(
  role: string,
  presentAttributes: readonly string[]
): A11yAuditItem[] {
  const required = ROLE_REQUIREMENTS[role];
  if (!required) return [];

  const items: A11yAuditItem[] = [];
  for (const attr of required) {
    if (!presentAttributes.includes(attr)) {
      items.push({
        rule: "role-has-required-aria",
        description: `Role "${role}" requires "${attr}" attribute`,
        severity: "error",
        element: `[role="${role}"]`,
        fix: `Add ${attr} attribute to the element with role="${role}"`,
      });
    }
  }
  return items;
}

/**
 * Run a11y audit on a set of elements (described as data).
 */
export function runA11yAudit(
  elements: readonly {
    tag: string;
    role?: string;
    attributes: readonly string[];
    textContent?: string;
    hasVisibleLabel?: boolean;
  }[]
): A11yAuditResult {
  const items: A11yAuditItem[] = [];

  for (const el of elements) {
    // Check role requirements
    if (el.role) {
      items.push(...validateRoleAttributes(el.role, el.attributes));
    }

    // Check interactive elements need labels
    const interactive = ["button", "a", "input", "select", "textarea"];
    if (interactive.includes(el.tag)) {
      const hasLabel =
        el.hasVisibleLabel ||
        el.attributes.includes("aria-label") ||
        el.attributes.includes("aria-labelledby") ||
        (el.textContent && el.textContent.trim().length > 0);

      if (!hasLabel) {
        items.push({
          rule: "interactive-has-label",
          description: `<${el.tag}> element missing accessible name`,
          severity: "error",
          element: `<${el.tag}>`,
          fix: `Add aria-label, aria-labelledby, or visible text to <${el.tag}>`,
        });
      }
    }

    // Check images need alt
    if (el.tag === "img" && !el.attributes.includes("alt")) {
      items.push({
        rule: "img-alt",
        description: "Image missing alt attribute",
        severity: "error",
        element: "<img>",
        fix: 'Add alt="" for decorative images or descriptive alt text',
      });
    }
  }

  const errorCount = items.filter((i) => i.severity === "error").length;
  const warningCount = items.filter((i) => i.severity === "warning").length;
  const infoCount = items.filter((i) => i.severity === "info").length;

  const score = Math.max(0, 100 - errorCount * 10 - warningCount * 3 - infoCount);
  const grade =
    score >= 95 ? "A+" :
    score >= 90 ? "A" :
    score >= 80 ? "B" :
    score >= 70 ? "C" :
    score >= 50 ? "D" : "F";

  return { items, errorCount, warningCount, infoCount, score, grade };
}

/**
 * Format a11y audit result as string.
 */
export function formatA11yAudit(result: A11yAuditResult): string {
  const lines = [
    `=== Accessibility Audit ===`,
    `Score: ${result.score}/100 (${result.grade})`,
    `Errors: ${result.errorCount} | Warnings: ${result.warningCount} | Info: ${result.infoCount}`,
  ];

  if (result.items.length > 0) {
    lines.push("");
    for (const item of result.items) {
      const icon = item.severity === "error" ? "❌" : item.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`${icon} [${item.rule}] ${item.description}`);
      lines.push(`   Fix: ${item.fix}`);
    }
  }

  return lines.join("\n");
}
