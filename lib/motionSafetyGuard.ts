/**
 * Q-216: Motion Safety Guard — prefers-reduced-motion enforcement
 *
 * Provides utilities to detect and respect the user's motion preference
 * at both CSS and JavaScript levels. Ensures vestibular/motion-sensitive
 * users have a safe experience.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html
 * @see WCAG 2.1 SC 2.3.3 (Animation from Interactions)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MotionPreference = "no-preference" | "reduce";

export interface MotionConfig {
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Animation duration in ms (0 for reduced motion) */
  animationDuration: number;
  /** Transition duration in ms (0 for reduced motion) */
  transitionDuration: number;
  /** Whether to allow auto-playing animations */
  allowAutoplay: boolean;
  /** Whether parallax effects should be disabled */
  disableParallax: boolean;
  /** Scale factor for animation intensity (0-1) */
  intensityScale: number;
}

export interface MotionAuditResult {
  /** Total animations found */
  totalAnimations: number;
  /** Animations missing reduced-motion handling */
  unsafeAnimations: UnsafeAnimation[];
  /** CSS transitions without reduced-motion media query */
  unsafeTransitions: UnsafeAnimation[];
  /** Score 0-100 */
  score: number;
  /** Grade A+ through F */
  grade: string;
  /** Recommendations for improvement */
  recommendations: string[];
}

export interface UnsafeAnimation {
  /** Identifier (component name, CSS class, etc.) */
  identifier: string;
  /** Type of motion */
  type: "animation" | "transition" | "transform" | "scroll";
  /** Severity */
  severity: "critical" | "warning" | "info";
  /** Description of the issue */
  issue: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default durations when motion is allowed */
const DEFAULT_DURATIONS = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 1000,
} as const;

/** Reduced motion durations (near-instant) */
const REDUCED_DURATIONS = {
  instant: 0,
  fast: 0,
  normal: 1,
  slow: 1,
  verySlow: 1,
} as const;

/** CSS properties that trigger motion and need reduced-motion handling */
const MOTION_CSS_PROPERTIES = [
  "animation",
  "animation-name",
  "animation-duration",
  "transition",
  "transition-duration",
  "transform",
  "scroll-behavior",
  "scroll-snap-type",
] as const;

/** Tailwind classes that imply animation */
const TAILWIND_MOTION_CLASSES = [
  "animate-",
  "transition-",
  "duration-",
  "ease-",
  "delay-",
  "hover:scale-",
  "active:scale-",
  "hover:rotate-",
  "hover:translate-",
] as const;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect the user's motion preference.
 * Returns "reduce" if the user prefers reduced motion, "no-preference" otherwise.
 * Safe to call on the server (returns "no-preference" by default).
 */
export function detectMotionPreference(): MotionPreference {
  if (typeof window === "undefined") return "no-preference";
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  return mq.matches ? "reduce" : "no-preference";
}

/**
 * Check if reduced motion is preferred.
 * Shorthand for `detectMotionPreference() === "reduce"`.
 */
export function prefersReducedMotion(): boolean {
  return detectMotionPreference() === "reduce";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Build a MotionConfig based on the user's preference.
 */
export function buildMotionConfig(
  preference?: MotionPreference
): MotionConfig {
  const pref = preference ?? detectMotionPreference();
  const isReduced = pref === "reduce";

  return {
    prefersReducedMotion: isReduced,
    animationDuration: isReduced ? 0 : DEFAULT_DURATIONS.normal,
    transitionDuration: isReduced ? 0 : DEFAULT_DURATIONS.fast,
    allowAutoplay: !isReduced,
    disableParallax: isReduced,
    intensityScale: isReduced ? 0 : 1,
  };
}

/**
 * Get a safe duration that respects the user's motion preference.
 *
 * @param speed - The desired speed category
 * @param preference - Override the detected preference
 * @returns Duration in milliseconds
 */
export function getSafeDuration(
  speed: keyof typeof DEFAULT_DURATIONS = "normal",
  preference?: MotionPreference
): number {
  const pref = preference ?? detectMotionPreference();
  return pref === "reduce" ? REDUCED_DURATIONS[speed] : DEFAULT_DURATIONS[speed];
}

/**
 * Build CSS transition string respecting motion preference.
 *
 * @example
 * getSafeTransition("opacity", "fast") // "opacity 200ms ease"
 * getSafeTransition("opacity", "fast", "reduce") // "opacity 0ms ease"
 */
export function getSafeTransition(
  property: string,
  speed: keyof typeof DEFAULT_DURATIONS = "normal",
  preference?: MotionPreference,
  easing = "ease"
): string {
  const duration = getSafeDuration(speed, preference);
  return `${property} ${duration}ms ${easing}`;
}

// ---------------------------------------------------------------------------
// Tailwind class helpers
// ---------------------------------------------------------------------------

/**
 * Build Tailwind classes that include motion-reduce variants.
 *
 * @example
 * motionSafeClasses("transition-all duration-300")
 * // "transition-all duration-300 motion-reduce:transition-none motion-reduce:duration-0"
 */
export function motionSafeClasses(classes: string): string {
  const hasTransition = classes.includes("transition");
  const hasDuration = classes.includes("duration-");
  const hasAnimate = classes.includes("animate-");

  const safeClasses: string[] = [classes];

  if (hasTransition) {
    safeClasses.push("motion-reduce:transition-none");
  }
  if (hasDuration) {
    safeClasses.push("motion-reduce:duration-0");
  }
  if (hasAnimate) {
    safeClasses.push("motion-reduce:animate-none");
  }

  return safeClasses.join(" ");
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Audit a list of CSS class strings for motion safety.
 * Returns a report of animations/transitions that lack reduced-motion handling.
 */
export function auditMotionSafety(
  classStrings: Array<{ identifier: string; classes: string }>
): MotionAuditResult {
  const unsafeAnimations: UnsafeAnimation[] = [];
  const unsafeTransitions: UnsafeAnimation[] = [];

  for (const { identifier, classes } of classStrings) {
    const hasMotionReduce =
      classes.includes("motion-reduce:") ||
      classes.includes("motion-safe:");

    // Check for animation classes without reduced-motion handling
    if (classes.includes("animate-") && !hasMotionReduce) {
      unsafeAnimations.push({
        identifier,
        type: "animation",
        severity: "warning",
        issue: `Animation class without motion-reduce variant: ${extractMotionClasses(classes)}`,
      });
    }

    // Check for transition classes without reduced-motion handling
    if (
      (classes.includes("transition") || classes.includes("duration-")) &&
      !hasMotionReduce
    ) {
      unsafeTransitions.push({
        identifier,
        type: "transition",
        severity: "info",
        issue: `Transition without motion-reduce variant: ${extractMotionClasses(classes)}`,
      });
    }

    // Check for transform classes that could cause vestibular issues
    if (
      (classes.includes("hover:scale-") ||
        classes.includes("hover:rotate-") ||
        classes.includes("hover:translate-")) &&
      !hasMotionReduce
    ) {
      unsafeAnimations.push({
        identifier,
        type: "transform",
        severity: "warning",
        issue: `Transform on hover without motion-reduce variant`,
      });
    }
  }

  const totalAnimations = classStrings.filter(({ classes }) =>
    TAILWIND_MOTION_CLASSES.some((mc) => classes.includes(mc))
  ).length;

  const unsafeCount = unsafeAnimations.length + unsafeTransitions.length;
  const score =
    totalAnimations === 0
      ? 100
      : Math.max(0, Math.round(100 - (unsafeCount / totalAnimations) * 100));

  const grade = scoreToGrade(score);

  const recommendations: string[] = [];
  if (unsafeAnimations.length > 0) {
    recommendations.push(
      `Add motion-reduce:animate-none to ${unsafeAnimations.length} animation(s)`
    );
  }
  if (unsafeTransitions.length > 0) {
    recommendations.push(
      `Add motion-reduce:transition-none to ${unsafeTransitions.length} transition(s)`
    );
  }
  if (score === 100) {
    recommendations.push("All animations respect prefers-reduced-motion");
  }

  return {
    totalAnimations,
    unsafeAnimations,
    unsafeTransitions,
    score,
    grade,
    recommendations,
  };
}

/**
 * Format the motion audit result as a human-readable string.
 */
export function formatMotionAudit(result: MotionAuditResult): string {
  const lines: string[] = [
    `Motion Safety Audit: ${result.score}/100 (${result.grade})`,
    `Total animations: ${result.totalAnimations}`,
    `Unsafe animations: ${result.unsafeAnimations.length}`,
    `Unsafe transitions: ${result.unsafeTransitions.length}`,
    "",
    "Recommendations:",
    ...result.recommendations.map((r) => `  - ${r}`),
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMotionClasses(classes: string): string {
  return classes
    .split(/\s+/)
    .filter((cls) => TAILWIND_MOTION_CLASSES.some((mc) => cls.includes(mc)))
    .join(" ");
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
