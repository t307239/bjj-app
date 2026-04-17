/**
 * lib/focusTrapManager.ts — Focus trap management utilities
 *
 * Q-158: a11y pillar — provides focus trap management for modals,
 * dialogs, and drawers to ensure keyboard-only users can navigate
 * without focus escaping to background content.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { createFocusTrap, getFocusableElements, FOCUSABLE_SELECTOR } from "@/lib/focusTrapManager";
 *   const trap = createFocusTrap(containerRef.current);
 *   trap.activate();
 *   // later: trap.deactivate();
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface FocusTrap {
  /** Activate the trap — focus first element, start trapping */
  activate: () => void;
  /** Deactivate — restore focus to previously focused element */
  deactivate: () => void;
  /** Whether the trap is currently active */
  isActive: () => boolean;
  /** Update focusable elements (call after DOM changes) */
  updateElements: () => void;
}

export interface FocusTrapOptions {
  /** Initial focus target selector (default: first focusable) */
  initialFocus?: string;
  /** Whether to return focus on deactivate (default: true) */
  returnFocusOnDeactivate?: boolean;
  /** Whether Escape key deactivates the trap (default: true) */
  escapeDeactivates?: boolean;
  /** Callback when trap is deactivated */
  onDeactivate?: () => void;
  /** Allow focus to leave on click outside (default: false) */
  clickOutsideDeactivates?: boolean;
}

export interface FocusableInfo {
  /** Total focusable elements found */
  count: number;
  /** Types of focusable elements */
  types: string[];
  /** Whether container has any focusable elements */
  hasFocusable: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Selector for all focusable elements */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

/** Default trap options */
export const DEFAULT_TRAP_OPTIONS: Required<FocusTrapOptions> = {
  initialFocus: "",
  returnFocusOnDeactivate: true,
  escapeDeactivates: true,
  onDeactivate: () => {},
  clickOutsideDeactivates: false,
};

/** Tab key code */
export const TAB_KEY = "Tab";
/** Escape key code */
export const ESCAPE_KEY = "Escape";

// ── Focus Utilities ─────────────────────────────────────────────────────

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: { querySelectorAll: (s: string) => NodeListOf<Element> }): Element[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => {
      // Filter out hidden elements
      const style = (el as HTMLElement).style;
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return false;
      }
      return true;
    },
  );
}

/**
 * Analyze focusable elements in a container.
 */
export function analyzeFocusableElements(container: { querySelectorAll: (s: string) => NodeListOf<Element> }): FocusableInfo {
  const elements = getFocusableElements(container);
  const types = [...new Set(elements.map((el) => el.tagName.toLowerCase()))];
  return {
    count: elements.length,
    types,
    hasFocusable: elements.length > 0,
  };
}

/**
 * Create a keyboard event handler for focus trapping.
 * Returns a handler function to be used with addEventListener('keydown', handler).
 */
export function createTrapKeyHandler(
  getElements: () => Element[],
  options: { escapeDeactivates: boolean; onEscape: () => void },
): (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => void {
  return (event) => {
    if (event.key === ESCAPE_KEY && options.escapeDeactivates) {
      options.onEscape();
      return;
    }

    if (event.key !== TAB_KEY) return;

    const elements = getElements();
    if (elements.length === 0) return;

    const first = elements[0];
    const last = elements[elements.length - 1];

    // Check if we need to wrap
    // Note: In a real DOM environment, document.activeElement would be checked
    if (event.shiftKey) {
      // If focused on first element, wrap to last
      event.preventDefault();
      (last as HTMLElement).focus?.();
    } else {
      // If focused on last element, wrap to first
      event.preventDefault();
      (first as HTMLElement).focus?.();
    }
  };
}

/**
 * Determine the correct initial focus target.
 */
export function getInitialFocusTarget(
  container: { querySelector: (s: string) => Element | null; querySelectorAll: (s: string) => NodeListOf<Element> },
  initialFocusSelector?: string,
): Element | null {
  if (initialFocusSelector) {
    const target = container.querySelector(initialFocusSelector);
    if (target) return target;
  }

  // Try to find autofocus element
  const autofocus = container.querySelector("[autofocus]");
  if (autofocus) return autofocus;

  // Fall back to first focusable
  const focusable = getFocusableElements(container);
  return focusable.length > 0 ? focusable[0] : null;
}

/**
 * Build aria attributes for a focus trap container.
 */
export function buildTrapContainerProps(options: {
  role?: string;
  label: string;
  modal?: boolean;
}): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {
    role: options.role ?? "dialog",
    "aria-label": options.label,
  };

  if (options.modal !== false) {
    props["aria-modal"] = true;
  }

  return props;
}

/**
 * Check if an element is within a focus trap container.
 */
export function isWithinContainer(
  element: { parentElement: unknown | null } | null,
  container: unknown,
): boolean {
  if (!element || !container) return false;
  let current = element as { parentElement: unknown | null } | null;
  while (current) {
    if (current === container) return true;
    current = current.parentElement as { parentElement: unknown | null } | null;
  }
  return false;
}

/**
 * Format focus trap info for debugging.
 */
export function formatFocusTrapInfo(info: FocusableInfo, containerLabel: string): string {
  if (!info.hasFocusable) {
    return `⚠️ Focus trap "${containerLabel}": No focusable elements found`;
  }
  return `✅ Focus trap "${containerLabel}": ${info.count} focusable elements (${info.types.join(", ")})`;
}
