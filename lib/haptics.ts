/**
 * MA-5: Haptic feedback utility.
 * Wraps navigator.vibrate with semantic patterns.
 * iOS Safari does NOT support vibrate — calls are safely no-op.
 */

/** Short tap — save, add, toggle */
export function hapticTap() {
  if (typeof navigator !== "undefined") navigator.vibrate?.([50]);
}

/** Double pulse — delete, undo */
export function hapticDouble() {
  if (typeof navigator !== "undefined") navigator.vibrate?.([30, 20, 30]);
}

/** Success burst — celebration, milestone, goal completion */
export function hapticSuccess() {
  if (typeof navigator !== "undefined") navigator.vibrate?.([50, 100, 50]);
}

/** Light nudge — minor UI interaction */
export function hapticNudge() {
  if (typeof navigator !== "undefined") navigator.vibrate?.([20]);
}
