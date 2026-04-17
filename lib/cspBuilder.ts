/**
 * lib/cspBuilder.ts — Content Security Policy builder + SRI utilities
 *
 * Q-144: Security pillar — provides nonce generation, CSP header
 * construction, and Subresource Integrity hash calculation.
 *
 * Designed for progressive adoption:
 * 1. Start with report-only mode to identify violations
 * 2. Tighten directives incrementally
 * 3. Add nonce-based script-src when Next.js supports it
 *
 * @example
 *   import { buildCSPHeader, generateNonce, CSP_DIRECTIVES } from "@/lib/cspBuilder";
 *   const nonce = generateNonce();
 *   const csp = buildCSPHeader({ nonce, reportOnly: true });
 */

// ── Types ────────────────────────────────────────────────────────────────

export type CSPDirective =
  | "default-src"
  | "script-src"
  | "style-src"
  | "img-src"
  | "font-src"
  | "connect-src"
  | "frame-src"
  | "frame-ancestors"
  | "object-src"
  | "base-uri"
  | "form-action"
  | "media-src"
  | "worker-src"
  | "manifest-src"
  | "report-uri"
  | "report-to";

export interface CSPConfig {
  /** Nonce for inline scripts (generated per request) */
  nonce?: string;
  /** Whether to use Content-Security-Policy-Report-Only header */
  reportOnly?: boolean;
  /** Report URI for violation reports */
  reportUri?: string;
  /** Additional directives to merge */
  extraDirectives?: Partial<Record<CSPDirective, string[]>>;
}

export interface CSPResult {
  /** Header name */
  headerName: string;
  /** Header value */
  headerValue: string;
  /** Individual directives for debugging */
  directives: Record<string, string[]>;
  /** Nonce used (if any) */
  nonce?: string;
}

export interface SRIHash {
  /** Algorithm used */
  algorithm: "sha256" | "sha384" | "sha512";
  /** Base64-encoded hash */
  hash: string;
  /** Full integrity attribute value */
  integrity: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Nonce length in bytes (32 bytes = 256 bits of entropy) */
export const NONCE_BYTES = 32;

/** Base CSP directives for BJJ App */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co"],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.sentry.io",
    "https://*.vercel-analytics.com",
    "https://*.vercel-insights.com",
    "https://api.stripe.com",
  ],
  "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https://checkout.stripe.com"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
};

/** Trusted external script domains (for script-src) */
export const TRUSTED_SCRIPT_DOMAINS = [
  "https://js.stripe.com",
  "https://*.sentry.io",
  "https://va.vercel-scripts.com",
] as const;

/** Supported SRI algorithms in preference order */
export const SRI_ALGORITHMS = ["sha384", "sha256", "sha512"] as const;

// ── Nonce Generation ────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure nonce for CSP.
 * Returns a base64url-encoded string.
 *
 * In Node.js environments, uses crypto.randomBytes.
 * In browser, uses crypto.getRandomValues.
 */
export function generateNonce(bytes: number = NONCE_BYTES): string {
  // Use a simple approach that works in both environments
  const array = new Uint8Array(bytes);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(array);
  } else {
    // Fallback for test environments
    for (let i = 0; i < bytes; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return uint8ToBase64url(array);
}

/**
 * Convert Uint8Array to base64url string.
 */
export function uint8ToBase64url(bytes: Uint8Array): string {
  const binStr = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  // Use btoa if available, otherwise manual encoding
  if (typeof btoa === "function") {
    return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Node.js Buffer fallback
  return Buffer.from(bytes).toString("base64url");
}

// ── CSP Header Builder ──────────────────────────────────────────────────

/**
 * Build a Content Security Policy header.
 */
export function buildCSPHeader(config: CSPConfig = {}): CSPResult {
  const directives: Record<string, string[]> = {};

  // Start with base directives
  for (const [key, values] of Object.entries(CSP_DIRECTIVES)) {
    directives[key] = [...values];
  }

  // Add nonce to script-src if provided
  if (config.nonce) {
    directives["script-src"] = [
      ...(directives["script-src"] || []),
      `'nonce-${config.nonce}'`,
      "'strict-dynamic'",
    ];
  }

  // Add trusted script domains
  directives["script-src"] = [
    ...(directives["script-src"] || []),
    ...TRUSTED_SCRIPT_DOMAINS,
  ];

  // Merge extra directives
  if (config.extraDirectives) {
    for (const [key, values] of Object.entries(config.extraDirectives)) {
      if (values && values.length > 0) {
        directives[key] = [...(directives[key] || []), ...values];
      }
    }
  }

  // Add report-uri if provided
  if (config.reportUri) {
    directives["report-uri"] = [config.reportUri];
  }

  // Build header value
  const headerValue = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  return {
    headerName: config.reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    headerValue,
    directives,
    nonce: config.nonce,
  };
}

// ── SRI Hash Calculation ────────────────────────────────────────────────

/**
 * Calculate SRI hash for a given content string.
 * Uses Web Crypto API (works in both Node.js 18+ and browsers).
 */
export async function calculateSRIHash(
  content: string,
  algorithm: "sha256" | "sha384" | "sha512" = "sha384",
): Promise<SRIHash> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Map to Web Crypto algorithm names
  const algoMap: Record<string, string> = {
    sha256: "SHA-256",
    sha384: "SHA-384",
    sha512: "SHA-512",
  };

  const hashBuffer = await globalThis.crypto.subtle.digest(algoMap[algorithm], data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = uint8ToBase64(hashArray);

  return {
    algorithm,
    hash: hashBase64,
    integrity: `${algorithm}-${hashBase64}`,
  };
}

/**
 * Convert Uint8Array to standard base64 string.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  const binStr = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  if (typeof btoa === "function") {
    return btoa(binStr);
  }
  return Buffer.from(bytes).toString("base64");
}

/**
 * Build an integrity attribute string for a script/link tag.
 */
export function buildIntegrityAttr(hash: SRIHash): string {
  return hash.integrity;
}

/**
 * Validate an SRI integrity value format.
 */
export function isValidSRIFormat(integrity: string): boolean {
  return /^(sha256|sha384|sha512)-[A-Za-z0-9+/]+=*$/.test(integrity);
}

// ── CSP Violation Parsing ───────────────────────────────────────────────

export interface CSPViolation {
  /** Directive that was violated */
  violatedDirective: string;
  /** The blocked URI */
  blockedUri: string;
  /** The document URI where violation occurred */
  documentUri: string;
  /** Original policy */
  originalPolicy: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Parse a CSP violation report body.
 */
export function parseCSPViolation(
  body: Record<string, unknown>,
): CSPViolation | null {
  const report = (body["csp-report"] ?? body) as Record<string, unknown>;
  if (!report["violated-directive"] && !report["effectiveDirective"]) return null;

  return {
    violatedDirective: String(report["violated-directive"] || report["effectiveDirective"] || ""),
    blockedUri: String(report["blocked-uri"] || report["blockedURL"] || ""),
    documentUri: String(report["document-uri"] || report["documentURL"] || ""),
    originalPolicy: String(report["original-policy"] || report["originalPolicy"] || ""),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a CSP config summary for logging.
 */
export function formatCSPSummary(result: CSPResult): string {
  const directiveCount = Object.keys(result.directives).length;
  const mode = result.headerName.includes("Report-Only") ? "report-only" : "enforced";
  const hasNonce = result.nonce ? "with nonce" : "no nonce";
  return `CSP: ${directiveCount} directives, ${mode}, ${hasNonce}`;
}
