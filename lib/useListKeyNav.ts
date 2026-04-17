/**
 * lib/useListKeyNav.ts — Keyboard navigation hook for list/menu UIs
 *
 * Q-143: a11y pillar — provides roving tabindex keyboard navigation
 * for custom list components (BottomSheet menus, technique lists,
 * suggestion dropdowns, etc.).
 *
 * Implements WAI-ARIA Listbox pattern:
 * - Arrow Up/Down: Move focus between items
 * - Home/End: Jump to first/last item
 * - Enter/Space: Select current item
 * - Escape: Close/deactivate
 * - Type-ahead: Jump to item starting with typed character
 *
 * @example
 *   const { activeIndex, getItemProps, getContainerProps } = useListKeyNav({
 *     itemCount: items.length,
 *     onSelect: (index) => handleSelect(items[index]),
 *     onEscape: () => setOpen(false),
 *   });
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface UseListKeyNavOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Callback when an item is selected (Enter/Space) */
  onSelect?: (index: number) => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Whether navigation wraps around (default: true) */
  wrap?: boolean;
  /** Initial active index (default: 0) */
  initialIndex?: number;
  /** Whether the list is currently active/visible (default: true) */
  enabled?: boolean;
  /** Orientation: vertical or horizontal (default: "vertical") */
  orientation?: "vertical" | "horizontal";
  /** Item labels for type-ahead (optional) */
  itemLabels?: string[];
}

export interface ListKeyNavResult {
  /** Currently focused item index (-1 if none) */
  activeIndex: number;
  /** Set active index programmatically */
  setActiveIndex: (index: number) => void;
  /** Props to spread on the list container element */
  getContainerProps: () => ContainerProps;
  /** Props to spread on each list item element */
  getItemProps: (index: number) => ItemProps;
  /** Reset to initial state */
  reset: () => void;
}

export interface ContainerProps {
  role: "listbox";
  "aria-activedescendant": string | undefined;
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent | React.KeyboardEvent) => void;
}

export interface ItemProps {
  id: string;
  role: "option";
  "aria-selected": boolean;
  tabIndex: number;
}

// Not importing React to keep this file isomorphic for testing.
// Consumers will use it with React's KeyboardEvent which extends the native one.

// ── Constants ────────────────────────────────────────────────────────────

/** Prefix for generated item IDs */
export const LIST_ITEM_ID_PREFIX = "listnav-item-";

/** Type-ahead reset delay in ms */
export const TYPEAHEAD_RESET_MS = 500;

// ── Core Logic (framework-agnostic) ──────────────────────────────────────

/**
 * Calculate next index for keyboard navigation.
 * Pure function — no side effects.
 */
export function getNextIndex(
  current: number,
  direction: "up" | "down" | "home" | "end",
  itemCount: number,
  wrap: boolean = true,
): number {
  if (itemCount <= 0) return -1;

  switch (direction) {
    case "home":
      return 0;
    case "end":
      return itemCount - 1;
    case "up": {
      if (current <= 0) return wrap ? itemCount - 1 : 0;
      return current - 1;
    }
    case "down": {
      if (current >= itemCount - 1) return wrap ? 0 : itemCount - 1;
      return current + 1;
    }
  }
}

/**
 * Find the first item whose label starts with the given character.
 * Searches from startIndex + 1 forward, wrapping around.
 */
export function findByTypeAhead(
  char: string,
  labels: string[],
  startIndex: number,
): number {
  if (labels.length === 0) return -1;
  const lowerChar = char.toLowerCase();
  const len = labels.length;

  // Search from next item, wrapping
  for (let i = 1; i <= len; i++) {
    const idx = (startIndex + i) % len;
    if (labels[idx]?.toLowerCase().startsWith(lowerChar)) {
      return idx;
    }
  }
  return -1;
}

/**
 * Map a keyboard event key to a navigation direction.
 * Returns null if the key is not a navigation key.
 */
export function keyToDirection(
  key: string,
  orientation: "vertical" | "horizontal" = "vertical",
): "up" | "down" | "home" | "end" | null {
  const upKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const downKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  switch (key) {
    case upKey:
      return "up";
    case downKey:
      return "down";
    case "Home":
      return "home";
    case "End":
      return "end";
    default:
      return null;
  }
}

/**
 * Determine if a key event should trigger item selection.
 */
export function isSelectionKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

/**
 * Determine if a key event should trigger escape/close.
 */
export function isEscapeKey(key: string): boolean {
  return key === "Escape";
}

/**
 * Generate the item ID for a given index.
 */
export function getItemId(index: number, prefix: string = LIST_ITEM_ID_PREFIX): string {
  return `${prefix}${index}`;
}

/**
 * Build container props for a listbox.
 */
export function buildContainerProps(
  activeIndex: number,
  onKeyDown: (e: KeyboardEvent | React.KeyboardEvent) => void,
): ContainerProps {
  return {
    role: "listbox" as const,
    "aria-activedescendant": activeIndex >= 0 ? getItemId(activeIndex) : undefined,
    tabIndex: 0,
    onKeyDown,
  };
}

/**
 * Build item props for a listbox option.
 */
export function buildItemProps(index: number, activeIndex: number): ItemProps {
  return {
    id: getItemId(index),
    role: "option" as const,
    "aria-selected": index === activeIndex,
    tabIndex: index === activeIndex ? 0 : -1,
  };
}

// React KeyboardEvent type placeholder for isomorphic builds
type React = { KeyboardEvent: KeyboardEvent };
