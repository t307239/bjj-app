/**
 * lib/gestureManager.ts — Standardized touch gesture recognition
 *
 * Q-164: UX pillar 93→94 — Pure-function gesture detection utilities
 * for mobile/touch UX. Provides swipe direction detection, long-press
 * timing, pinch scale calculation, and gesture conflict resolution.
 *
 * All functions are DOM-independent — they operate on coordinate/time
 * data, making them easy to test and compose with React event handlers.
 *
 * Respects prefers-reduced-motion by providing configuration hooks.
 *
 * @example
 *   import { detectSwipe, SWIPE_CONFIG } from "@/lib/gestureManager";
 *   const result = detectSwipe(
 *     { x: 100, y: 200, time: 0 },
 *     { x: 300, y: 210, time: 150 }
 *   );
 *   // { direction: "right", distance: 200, velocity: 1.33, valid: true }
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  time: number; // ms timestamp
}

export type SwipeDirection = "up" | "down" | "left" | "right";

export interface SwipeResult {
  direction: SwipeDirection;
  distance: number;      // px
  velocity: number;      // px/ms
  angle: number;         // degrees (0=right, 90=up, 180=left, 270=down)
  valid: boolean;        // meets threshold requirements
  deltaX: number;
  deltaY: number;
}

export interface LongPressResult {
  elapsed: number;       // ms
  triggered: boolean;
  position: Point;
}

export interface PinchResult {
  scale: number;         // ratio (1 = no change, <1 = pinch in, >1 = pinch out)
  center: Point;
  distance: number;      // px between fingers
  initialDistance: number;
  valid: boolean;
}

export interface GestureConfig {
  /** Minimum swipe distance in px (default: 50) */
  minSwipeDistance: number;
  /** Maximum swipe time in ms (default: 300) */
  maxSwipeTime: number;
  /** Minimum swipe velocity in px/ms (default: 0.3) */
  minSwipeVelocity: number;
  /** Long press duration in ms (default: 500) */
  longPressDuration: number;
  /** Maximum movement during long press in px (default: 10) */
  longPressMaxMove: number;
  /** Minimum pinch distance change ratio to register (default: 0.1) */
  minPinchScale: number;
  /** Whether animations/gestures should be reduced (default: false) */
  reducedMotion: boolean;
}

// ── Config ──────────────────────────────────────────────────────────────

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  minSwipeDistance: 50,
  maxSwipeTime: 300,
  minSwipeVelocity: 0.3,
  longPressDuration: 500,
  longPressMaxMove: 10,
  minPinchScale: 0.1,
  reducedMotion: false,
};

/**
 * Create a gesture config with custom overrides.
 */
export function createGestureConfig(
  overrides: Partial<GestureConfig> = {}
): GestureConfig {
  return { ...DEFAULT_GESTURE_CONFIG, ...overrides };
}

// ── Swipe Detection ─────────────────────────────────────────────────────

/**
 * Detect swipe direction and validity from start/end touch points.
 *
 * @param start - Touch start point with timestamp
 * @param end   - Touch end point with timestamp
 * @param config - Gesture thresholds
 * @returns SwipeResult with direction, distance, velocity, and validity
 */
export function detectSwipe(
  start: TimedPoint,
  end: TimedPoint,
  config: GestureConfig = DEFAULT_GESTURE_CONFIG
): SwipeResult {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const elapsed = Math.max(end.time - start.time, 1); // avoid division by zero
  const velocity = distance / elapsed;
  const angle = calculateAngle(deltaX, deltaY);
  const direction = angleToDirection(angle);

  const valid =
    !config.reducedMotion &&
    distance >= config.minSwipeDistance &&
    elapsed <= config.maxSwipeTime &&
    velocity >= config.minSwipeVelocity;

  return { direction, distance, velocity, angle, valid, deltaX, deltaY };
}

/**
 * Determine primary axis of a swipe (horizontal or vertical).
 * Useful for preventing gesture conflicts (e.g., scroll vs swipe).
 */
export function getSwipeAxis(
  start: Point,
  end: Point
): "horizontal" | "vertical" {
  const absX = Math.abs(end.x - start.x);
  const absY = Math.abs(end.y - start.y);
  return absX >= absY ? "horizontal" : "vertical";
}

// ── Long Press Detection ────────────────────────────────────────────────

/**
 * Check if a touch qualifies as a long press.
 *
 * @param start     - Initial touch point with timestamp
 * @param current   - Current touch point with timestamp
 * @param config    - Gesture thresholds
 * @returns LongPressResult with elapsed time and trigger status
 */
export function detectLongPress(
  start: TimedPoint,
  current: TimedPoint,
  config: GestureConfig = DEFAULT_GESTURE_CONFIG
): LongPressResult {
  const elapsed = current.time - start.time;
  const movement = Math.sqrt(
    (current.x - start.x) ** 2 + (current.y - start.y) ** 2
  );

  const triggered =
    !config.reducedMotion &&
    elapsed >= config.longPressDuration &&
    movement <= config.longPressMaxMove;

  return {
    elapsed,
    triggered,
    position: { x: start.x, y: start.y },
  };
}

// ── Pinch Detection ─────────────────────────────────────────────────────

/**
 * Calculate pinch gesture from two finger positions.
 *
 * @param initialA  - First finger start position
 * @param initialB  - Second finger start position
 * @param currentA  - First finger current position
 * @param currentB  - Second finger current position
 * @param config    - Gesture thresholds
 * @returns PinchResult with scale ratio and center point
 */
export function detectPinch(
  initialA: Point,
  initialB: Point,
  currentA: Point,
  currentB: Point,
  config: GestureConfig = DEFAULT_GESTURE_CONFIG
): PinchResult {
  const initialDistance = getDistance(initialA, initialB);
  const currentDistance = getDistance(currentA, currentB);

  // Avoid division by zero
  const scale = initialDistance > 0 ? currentDistance / initialDistance : 1;

  const center: Point = {
    x: (currentA.x + currentB.x) / 2,
    y: (currentA.y + currentB.y) / 2,
  };

  const valid =
    !config.reducedMotion &&
    Math.abs(scale - 1) >= config.minPinchScale;

  return {
    scale,
    center,
    distance: currentDistance,
    initialDistance,
    valid,
  };
}

/**
 * Classify pinch as zoom-in, zoom-out, or none.
 */
export function classifyPinch(
  result: PinchResult
): "zoom-in" | "zoom-out" | "none" {
  if (!result.valid) return "none";
  return result.scale > 1 ? "zoom-in" : "zoom-out";
}

// ── Gesture Conflict Resolution ─────────────────────────────────────────

export type GestureType = "swipe" | "long-press" | "pinch" | "tap" | "none";

export interface GesturePriority {
  type: GestureType;
  confidence: number; // 0-1
}

/**
 * Resolve which gesture should take priority when multiple are possible.
 *
 * Priority order (highest first): pinch > long-press > swipe > tap
 * Confidence is based on how clearly the gesture matches its thresholds.
 *
 * @param touchCount - Number of active touch points
 * @param elapsed    - Time since touch start (ms)
 * @param movement   - Total movement distance (px)
 * @param config     - Gesture thresholds
 * @returns Prioritized gesture type with confidence score
 */
export function resolveGesture(
  touchCount: number,
  elapsed: number,
  movement: number,
  config: GestureConfig = DEFAULT_GESTURE_CONFIG
): GesturePriority {
  if (config.reducedMotion) {
    return { type: "none", confidence: 1 };
  }

  // Pinch: 2+ fingers
  if (touchCount >= 2) {
    return { type: "pinch", confidence: 0.9 };
  }

  // Long press: minimal movement, long duration
  if (
    elapsed >= config.longPressDuration &&
    movement <= config.longPressMaxMove
  ) {
    const durationRatio = Math.min(elapsed / (config.longPressDuration * 2), 1);
    return { type: "long-press", confidence: 0.7 + 0.3 * durationRatio };
  }

  // Swipe: significant movement, short duration
  if (movement >= config.minSwipeDistance && elapsed <= config.maxSwipeTime) {
    const velocity = movement / Math.max(elapsed, 1);
    const velocityRatio = Math.min(velocity / (config.minSwipeVelocity * 3), 1);
    return { type: "swipe", confidence: 0.6 + 0.4 * velocityRatio };
  }

  // Tap: minimal movement, short duration
  if (movement <= config.longPressMaxMove && elapsed < config.longPressDuration) {
    return { type: "tap", confidence: 0.8 };
  }

  return { type: "none", confidence: 0 };
}

// ── Utility Functions ───────────────────────────────────────────────────

/** Calculate distance between two points */
export function getDistance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Calculate angle in degrees from delta (0=right, 90=up, 180=left, 270=down) */
function calculateAngle(deltaX: number, deltaY: number): number {
  // atan2 gives angle from positive x-axis, counterclockwise
  // We negate deltaY because screen Y is inverted
  const radians = Math.atan2(-deltaY, deltaX);
  let degrees = (radians * 180) / Math.PI;
  if (degrees < 0) degrees += 360;
  return Math.round(degrees * 100) / 100;
}

/** Convert angle to cardinal direction */
function angleToDirection(angle: number): SwipeDirection {
  // Right: 315-45, Up: 45-135, Left: 135-225, Down: 225-315
  if (angle >= 315 || angle < 45) return "right";
  if (angle >= 45 && angle < 135) return "up";
  if (angle >= 135 && angle < 225) return "left";
  return "down";
}

/**
 * Create a velocity tracker for smooth gesture animations.
 * Tracks recent positions and calculates average velocity.
 */
export function createVelocityTracker(windowSize: number = 5): {
  addPoint: (point: TimedPoint) => void;
  getVelocity: () => Point;
  reset: () => void;
} {
  const points: TimedPoint[] = [];

  return {
    addPoint(point: TimedPoint) {
      points.push(point);
      if (points.length > windowSize) {
        points.shift();
      }
    },

    getVelocity(): Point {
      if (points.length < 2) return { x: 0, y: 0 };

      const first = points[0];
      const last = points[points.length - 1];
      const elapsed = Math.max(last.time - first.time, 1);

      return {
        x: (last.x - first.x) / elapsed,
        y: (last.y - first.y) / elapsed,
      };
    },

    reset() {
      points.length = 0;
    },
  };
}

/**
 * Format gesture result as human-readable string for debugging.
 */
export function formatGestureDebug(gesture: GesturePriority): string {
  return `Gesture: ${gesture.type} (confidence: ${(gesture.confidence * 100).toFixed(0)}%)`;
}
