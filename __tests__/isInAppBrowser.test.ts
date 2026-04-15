/**
 * Q-19: Unit tests for In-App Browser detection.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { isInAppBrowser } from "@/lib/isInAppBrowser";

// ─── Mock navigator.userAgent ───────────────────────────────────────────────
function mockUA(ua: string) {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: ua },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  // Restore default
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "Mozilla/5.0" },
    writable: true,
    configurable: true,
  });
});

describe("isInAppBrowser", () => {
  it("returns false for standard Chrome desktop", () => {
    mockUA(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    expect(isInAppBrowser()).toBe(false);
  });

  it("returns false for Safari on iOS", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(isInAppBrowser()).toBe(false);
  });

  it("detects Instagram IAB", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Instagram 305.0.0.33.111"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects Facebook IAB (FBAN)", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 [FBAN/FBIOS;FBDV/iPhone14,2]"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects LINE IAB", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Line/13.0.0"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects Twitter/X IAB", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Twitter for iPhone"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects TikTok IAB", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 TikTok 32.0"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects WeChat IAB", () => {
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 MicroMessenger/8.0.40"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("detects iOS WebView without Safari (generic IAB)", () => {
    // WebKit on iPhone but no Safari in UA = likely an IAB
    mockUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329"
    );
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns false when navigator is undefined (SSR)", () => {
    const orig = globalThis.navigator;
    // @ts-expect-error — simulate SSR
    delete globalThis.navigator;
    expect(isInAppBrowser()).toBe(false);
    Object.defineProperty(globalThis, "navigator", {
      value: orig,
      writable: true,
      configurable: true,
    });
  });
});
