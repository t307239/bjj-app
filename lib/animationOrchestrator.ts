/**
 * animationOrchestrator.ts — Animation sequencing & orchestration
 *
 * Coordinates staggered animations, respects prefers-reduced-motion,
 * manages intersection-based triggers, and enforces animation budgets.
 *
 * Pure functions — no DOM access. Outputs CSS/timing configurations.
 *
 * @module Q-193 UI 95→97
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type EasingFunction =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "bounce";

export interface AnimationKeyframe {
  readonly offset: number; // 0-1
  readonly properties: Readonly<Record<string, string | number>>;
}

export interface AnimationConfig {
  readonly name: string;
  readonly duration: number; // ms
  readonly delay: number; // ms
  readonly easing: EasingFunction;
  readonly fillMode: "none" | "forwards" | "backwards" | "both";
  readonly iterations: number;
  readonly keyframes: readonly AnimationKeyframe[];
}

export interface StaggerConfig {
  readonly baseDelay: number;
  readonly staggerDelay: number;
  readonly maxDelay: number;
  readonly easing: EasingFunction;
  readonly direction: "forward" | "reverse" | "center";
}

export interface AnimationSequence {
  readonly steps: readonly AnimationStep[];
  readonly totalDuration: number;
  readonly respectsReducedMotion: boolean;
}

export interface AnimationStep {
  readonly target: string;
  readonly animation: AnimationConfig;
  readonly startAt: number; // ms from sequence start
}

export interface IntersectionTrigger {
  readonly target: string;
  readonly threshold: number; // 0-1
  readonly rootMargin: string;
  readonly triggerOnce: boolean;
  readonly animation: AnimationConfig;
}

export interface AnimationBudget {
  readonly maxConcurrent: number;
  readonly maxTotalDuration: number;
  readonly maxAnimationsPerPage: number;
  readonly preferReducedMotion: boolean;
}

export interface AnimationAudit {
  readonly totalAnimations: number;
  readonly totalDuration: number;
  readonly maxConcurrent: number;
  readonly budgetViolations: readonly string[];
  readonly score: number;
  readonly reducedMotionReady: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const EASING_VALUES: Record<EasingFunction, string> = {
  linear: "linear",
  ease: "ease",
  "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
  "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
  "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
};

export const DEFAULT_BUDGET: AnimationBudget = {
  maxConcurrent: 5,
  maxTotalDuration: 3000,
  maxAnimationsPerPage: 20,
  preferReducedMotion: false,
};

/** Pre-built animation presets */
export const PRESETS: Record<string, AnimationConfig> = {
  fadeIn: {
    name: "fadeIn",
    duration: 300,
    delay: 0,
    easing: "ease-out",
    fillMode: "both",
    iterations: 1,
    keyframes: [
      { offset: 0, properties: { opacity: 0 } },
      { offset: 1, properties: { opacity: 1 } },
    ],
  },
  slideUp: {
    name: "slideUp",
    duration: 400,
    delay: 0,
    easing: "ease-out",
    fillMode: "both",
    iterations: 1,
    keyframes: [
      { offset: 0, properties: { opacity: 0, transform: "translateY(20px)" } },
      { offset: 1, properties: { opacity: 1, transform: "translateY(0)" } },
    ],
  },
  slideDown: {
    name: "slideDown",
    duration: 400,
    delay: 0,
    easing: "ease-out",
    fillMode: "both",
    iterations: 1,
    keyframes: [
      { offset: 0, properties: { opacity: 0, transform: "translateY(-20px)" } },
      { offset: 1, properties: { opacity: 1, transform: "translateY(0)" } },
    ],
  },
  scaleIn: {
    name: "scaleIn",
    duration: 250,
    delay: 0,
    easing: "spring",
    fillMode: "both",
    iterations: 1,
    keyframes: [
      { offset: 0, properties: { opacity: 0, transform: "scale(0.9)" } },
      { offset: 1, properties: { opacity: 1, transform: "scale(1)" } },
    ],
  },
  shimmer: {
    name: "shimmer",
    duration: 1500,
    delay: 0,
    easing: "linear",
    fillMode: "none",
    iterations: Infinity,
    keyframes: [
      { offset: 0, properties: { backgroundPosition: "-200% 0" } },
      { offset: 1, properties: { backgroundPosition: "200% 0" } },
    ],
  },
};

const REDUCED_MOTION_DURATION = 1; // 1ms — effectively instant

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Apply reduced motion preferences to an animation config.
 */
export function applyReducedMotion(config: AnimationConfig): AnimationConfig {
  return {
    ...config,
    duration: REDUCED_MOTION_DURATION,
    delay: 0,
    iterations: 1,
    keyframes: config.keyframes.length >= 2
      ? [config.keyframes[0], config.keyframes[config.keyframes.length - 1]]
      : config.keyframes,
  };
}

/**
 * Calculate staggered delays for a list of items.
 */
export function calculateStaggerDelays(
  itemCount: number,
  config: StaggerConfig
): number[] {
  const delays: number[] = [];

  for (let i = 0; i < itemCount; i++) {
    let index: number;

    switch (config.direction) {
      case "reverse":
        index = itemCount - 1 - i;
        break;
      case "center": {
        const center = (itemCount - 1) / 2;
        index = Math.abs(i - center);
        break;
      }
      default:
        index = i;
    }

    const delay = Math.min(
      config.baseDelay + index * config.staggerDelay,
      config.maxDelay
    );
    delays.push(delay);
  }

  return delays;
}

/**
 * Build a sequential animation sequence.
 */
export function buildSequence(
  steps: readonly { target: string; animation: AnimationConfig }[],
  reducedMotion: boolean = false
): AnimationSequence {
  let currentTime = 0;
  const sequenceSteps: AnimationStep[] = [];

  for (const step of steps) {
    const anim = reducedMotion ? applyReducedMotion(step.animation) : step.animation;
    sequenceSteps.push({
      target: step.target,
      animation: anim,
      startAt: currentTime,
    });
    currentTime += anim.duration + anim.delay;
  }

  return {
    steps: sequenceSteps,
    totalDuration: currentTime,
    respectsReducedMotion: reducedMotion,
  };
}

/**
 * Build a parallel animation sequence (all start at same time).
 */
export function buildParallel(
  steps: readonly { target: string; animation: AnimationConfig }[],
  reducedMotion: boolean = false
): AnimationSequence {
  const sequenceSteps: AnimationStep[] = [];
  let maxDuration = 0;

  for (const step of steps) {
    const anim = reducedMotion ? applyReducedMotion(step.animation) : step.animation;
    sequenceSteps.push({
      target: step.target,
      animation: anim,
      startAt: 0,
    });
    maxDuration = Math.max(maxDuration, anim.duration + anim.delay);
  }

  return {
    steps: sequenceSteps,
    totalDuration: maxDuration,
    respectsReducedMotion: reducedMotion,
  };
}

/**
 * Build staggered animation for list items.
 */
export function buildStaggered(
  targets: readonly string[],
  animation: AnimationConfig,
  staggerConfig: StaggerConfig,
  reducedMotion: boolean = false
): AnimationSequence {
  const delays = calculateStaggerDelays(targets.length, staggerConfig);
  const steps: AnimationStep[] = [];
  let maxEnd = 0;

  for (let i = 0; i < targets.length; i++) {
    const anim = reducedMotion
      ? applyReducedMotion({ ...animation, delay: 0 })
      : { ...animation, delay: delays[i] };

    steps.push({
      target: targets[i],
      animation: anim,
      startAt: reducedMotion ? 0 : delays[i],
    });
    maxEnd = Math.max(maxEnd, (reducedMotion ? 0 : delays[i]) + anim.duration);
  }

  return {
    steps,
    totalDuration: maxEnd,
    respectsReducedMotion: reducedMotion,
  };
}

/**
 * Create an intersection trigger configuration.
 */
export function createIntersectionTrigger(
  target: string,
  animation: AnimationConfig,
  options?: {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
  }
): IntersectionTrigger {
  return {
    target,
    threshold: options?.threshold ?? 0.1,
    rootMargin: options?.rootMargin ?? "0px 0px -50px 0px",
    triggerOnce: options?.triggerOnce ?? true,
    animation,
  };
}

/**
 * Audit animations against budget.
 */
export function auditAnimations(
  sequences: readonly AnimationSequence[],
  budget: AnimationBudget = DEFAULT_BUDGET
): AnimationAudit {
  const violations: string[] = [];
  let totalAnimations = 0;
  let totalDuration = 0;
  let maxConcurrent = 0;

  for (const seq of sequences) {
    totalAnimations += seq.steps.length;
    totalDuration += seq.totalDuration;

    // Count max concurrent (simplified: within each sequence)
    const concurrent = seq.steps.filter((s) => s.startAt === 0).length;
    maxConcurrent = Math.max(maxConcurrent, concurrent);

    if (!seq.respectsReducedMotion && budget.preferReducedMotion) {
      violations.push("Animation does not respect prefers-reduced-motion");
    }
  }

  if (totalAnimations > budget.maxAnimationsPerPage) {
    violations.push(`Too many animations: ${totalAnimations} > ${budget.maxAnimationsPerPage}`);
  }
  if (maxConcurrent > budget.maxConcurrent) {
    violations.push(`Too many concurrent animations: ${maxConcurrent} > ${budget.maxConcurrent}`);
  }
  if (totalDuration > budget.maxTotalDuration) {
    violations.push(`Total duration too long: ${totalDuration}ms > ${budget.maxTotalDuration}ms`);
  }

  const score = Math.max(0, 100 - violations.length * 15);

  return {
    totalAnimations,
    totalDuration,
    maxConcurrent,
    budgetViolations: violations,
    score,
    reducedMotionReady: sequences.every((s) => s.respectsReducedMotion),
  };
}

/**
 * Generate CSS animation string from config.
 */
export function toCSS(config: AnimationConfig): string {
  const easing = EASING_VALUES[config.easing];
  const iterations = config.iterations === Infinity ? "infinite" : config.iterations;
  return `${config.name} ${config.duration}ms ${easing} ${config.delay}ms ${iterations} ${config.fillMode}`;
}

/**
 * Format animation audit as string.
 */
export function formatAnimationAudit(audit: AnimationAudit): string {
  const lines = [
    `=== Animation Audit ===`,
    `Score: ${audit.score}/100`,
    `Total animations: ${audit.totalAnimations}`,
    `Total duration: ${audit.totalDuration}ms`,
    `Max concurrent: ${audit.maxConcurrent}`,
    `Reduced motion ready: ${audit.reducedMotionReady ? "✅" : "❌"}`,
  ];

  if (audit.budgetViolations.length > 0) {
    lines.push("", "Violations:");
    for (const v of audit.budgetViolations) {
      lines.push(`  ❌ ${v}`);
    }
  }

  return lines.join("\n");
}
