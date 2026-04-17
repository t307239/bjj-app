/**
 * lib/designTokens.ts — Centralized design system tokens
 *
 * Q-136: UI pillar — single source of truth for the BJJ App design system.
 * All visual constants (colors, spacing, breakpoints, shadows, radii, z-index)
 * are defined here and referenced by components.
 *
 * These tokens correspond to the Tailwind config but provide:
 * 1. TypeScript type safety for color/spacing references
 * 2. Documentation of the design rationale
 * 3. Easy audit of the visual system
 *
 * @example
 *   import { COLORS, BREAKPOINTS, SPACING } from "@/lib/designTokens";
 *   const bgClass = COLORS.surface.primary; // "bg-[#0B1120]"
 */

// ── Color Palette ────────────────────────────────────────────────────────

/**
 * Brand and UI color tokens.
 * Dark-first design: backgrounds are dark, text is light.
 */
export const COLORS = {
  /** Brand colors */
  brand: {
    primary: "#10B981",       // emerald-500 — primary CTA, active states
    primaryHover: "#059669",  // emerald-600 — hover state
    primaryMuted: "#065F46",  // emerald-800 — subtle backgrounds
    primaryLight: "#D1FAE5",  // emerald-100 — text on dark for emphasis
  },

  /** Surface/background colors (dark theme) */
  surface: {
    base: "#0B1120",          // deepest background (body)
    card: "#111827",          // gray-900 — card surfaces
    cardHover: "#1F2937",     // gray-800 — card hover state
    elevated: "#1F2937",      // gray-800 — modals, dropdowns
    input: "#1E293B",         // slate-800 — input fields
    border: "#374151",        // gray-700 — borders, dividers
  },

  /** Text colors */
  text: {
    primary: "#F9FAFB",      // gray-50 — headings, important text
    secondary: "#A1A1AA",    // zinc-400 — WCAG AA compliant body text
    muted: "#71717A",        // zinc-500 — labels, hints
    inverse: "#111827",      // gray-900 — text on light backgrounds
    link: "#10B981",         // emerald-500 — links
  },

  /** Semantic status colors */
  status: {
    success: "#10B981",      // emerald-500
    warning: "#F59E0B",      // amber-500
    error: "#EF4444",        // red-500
    info: "#3B82F6",         // blue-500
  },

  /** Belt colors for BJJ-specific UI */
  belt: {
    white: "#F9FAFB",
    blue: "#3B82F6",
    purple: "#8B5CF6",
    brown: "#92400E",
    black: "#1F2937",
  },

  /** Heatmap intensity scale (training activity) */
  heatmap: {
    empty: "#1F2937",        // gray-800 — no activity
    low: "#065F46",          // emerald-800
    medium: "#059669",       // emerald-600
    high: "#10B981",         // emerald-500
    max: "#34D399",          // emerald-400
  },
} as const;

// ── Breakpoints ──────────────────────────────────────────────────────────

/**
 * Responsive breakpoints matching Tailwind defaults.
 * Use for JS-based responsive logic (e.g., chart sizing).
 */
export const BREAKPOINTS = {
  /** Small phones (portrait) */
  xs: 320,
  /** Standard phones */
  sm: 640,
  /** Tablets / large phones (landscape) */
  md: 768,
  /** Small laptops / tablets (landscape) */
  lg: 1024,
  /** Desktops */
  xl: 1280,
  /** Large desktops */
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Check if a pixel width matches or exceeds a breakpoint.
 */
export function isAboveBreakpoint(width: number, bp: Breakpoint): boolean {
  return width >= BREAKPOINTS[bp];
}

/**
 * Get the current breakpoint name for a given width.
 */
export function getCurrentBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

// ── Spacing Scale ────────────────────────────────────────────────────────

/**
 * Named spacing constants (in Tailwind units and px).
 * Consistent spacing prevents "random padding" drift.
 */
export const SPACING = {
  /** Touch target minimum (44px per WCAG) */
  touchTarget: 44,
  /** Standard page horizontal padding */
  pageX: 16,         // px-4
  /** Page padding on tablet+ */
  pageXMd: 24,       // md:px-6
  /** Card inner padding */
  cardPadding: 16,   // p-4
  /** Gap between cards in a grid */
  cardGap: 16,       // gap-4
  /** Section vertical spacing */
  sectionGap: 24,    // gap-6
  /** Nav bar height */
  navHeight: 56,
  /** Bottom bar height (mobile) */
  bottomBarHeight: 64,
  /** Safe area bottom (env(safe-area-inset-bottom) fallback) */
  safeAreaBottom: 34,
} as const;

// ── Border Radius ────────────────────────────────────────────────────────

export const RADII = {
  /** Small elements (badges, chips) */
  sm: 6,     // rounded-md
  /** Cards, inputs */
  md: 8,     // rounded-lg
  /** Modals, sheets */
  lg: 12,    // rounded-xl
  /** Pills, full-round buttons */
  full: 9999, // rounded-full
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────

export const SHADOWS = {
  /** Card shadow on dark background */
  card: "0 1px 3px rgba(0, 0, 0, 0.3)",
  /** Elevated elements (modals, dropdowns) */
  elevated: "0 4px 12px rgba(0, 0, 0, 0.4)",
  /** Floating action button */
  fab: "0 6px 20px rgba(0, 0, 0, 0.5)",
} as const;

// ── Z-Index Scale ────────────────────────────────────────────────────────

/**
 * Z-index layers to prevent stacking conflicts.
 */
export const Z_INDEX = {
  /** Base content */
  base: 0,
  /** Sticky headers, navbars */
  sticky: 10,
  /** Dropdowns, popovers */
  dropdown: 20,
  /** Overlay backgrounds */
  overlay: 30,
  /** Modals, bottom sheets */
  modal: 40,
  /** Toast notifications */
  toast: 50,
  /** Skip navigation link */
  skipNav: 60,
} as const;

// ── Animation ────────────────────────────────────────────────────────────

export const ANIMATION = {
  /** Standard easing curve */
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Duration for micro-interactions (ms) */
  fast: 150,
  /** Duration for page transitions (ms) */
  normal: 300,
  /** Duration for complex animations (ms) */
  slow: 500,
} as const;

// ── Typography ───────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  /** Font family stack */
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  /** Font sizes (Tailwind text-* equivalents in px) */
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
  },
  /** Line heights */
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;
