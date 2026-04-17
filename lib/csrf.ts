/**
 * lib/csrf.ts — Q-128: CSRF double-submit cookie protection
 *
 * Implements the Double Submit Cookie pattern:
 * 1. Server sets a random token in a SameSite=Strict, HttpOnly=false cookie
 * 2. Client reads cookie and sends token in X-CSRF-Token header
 * 3. Server validates header matches cookie
 *
 * Usage in API routes:
 *   import { validateCsrf, setCsrfCookie } from "@/lib/csrf";
 *
 *   // In layout.tsx or middleware: setCsrfCookie(response)
 *   // In API POST/PUT/DELETE routes: validateCsrf(request)
 */

import { NextResponse } from "next/server";

export const CSRF_COOKIE_NAME = "bjj-csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically random CSRF token.
 * Uses Web Crypto API (available in Node 18+ and Edge Runtime).
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Set the CSRF cookie on a NextResponse.
 * Cookie is SameSite=Strict but NOT HttpOnly (client JS must read it).
 */
export function setCsrfCookie(
  response: NextResponse,
  token?: string
): string {
  const csrfToken = token ?? generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    path: "/",
    sameSite: "strict",
    httpOnly: false, // Client must read this to send in header
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return csrfToken;
}

/**
 * Validate CSRF token by comparing cookie value to header value.
 *
 * @returns true if valid, false if mismatch or missing
 */
export function validateCsrf(request: Request): boolean {
  // GET/HEAD/OPTIONS are safe methods — no CSRF check needed
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // Extract cookie token
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = parseCookieValue(cookieHeader, CSRF_COOKIE_NAME);

  // Extract header token
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return false;
  }

  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Parse a specific cookie value from Cookie header string.
 */
function parseCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key?.trim() === name) {
      return valueParts.join("=").trim();
    }
  }
  return null;
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Falls back to simple comparison if crypto.timingSafeEqual isn't available.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  // Use constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
