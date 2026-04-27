/**
 * Q-48/Q-51: Verify ProGate component structure, contrast, and benefit-focused copy.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const componentPath = path.resolve(__dirname, "../components/ProGate.tsx");
const jaMessagesPath = path.resolve(__dirname, "../messages/ja.json");
const enMessagesPath = path.resolve(__dirname, "../messages/en.json");

describe("ProGate paywall component", () => {
  const source = fs.readFileSync(componentPath, "utf-8");

  it("returns children directly when user is Pro (no paywall)", () => {
    // Guard clause: `if (isPro) return <>{children}</>`
    expect(source).toMatch(/if\s*\(\s*isPro\s*\)\s*\{[\s\S]*?return\s*<>\{children\}<\/>/);
  });

  it("renders blurred preview with pointer-events disabled", () => {
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("blur-sm");
    expect(source).toContain("select-none");
  });

  it("uses text-zinc-* instead of text-gray-* for WCAG AA contrast (Q-48)", () => {
    // Migrated entirely from text-gray-400/500 to text-zinc-300/400
    expect(source).not.toMatch(/text-gray-(500|600|700)/);
    expect(source).not.toMatch(/text-gray-400/);
  });

  it("disables upgrade button until disclaimer checkbox is accepted (Stripe pre-checkout)", () => {
    expect(source).toContain("disclaimerAccepted");
    expect(source).toMatch(/href=\{disclaimerAccepted\s*\?\s*paymentUrl\s*:\s*undefined\}/);
    expect(source).toContain("aria-disabled={!disclaimerAccepted}");
  });

  it("tracks upgrade click events for analytics", () => {
    expect(source).toContain('trackEvent("pro_upgrade_click"');
  });

  it("supports monthly/annual toggle with client_reference_id for webhook attribution", () => {
    expect(source).toContain("client_reference_id=${userId}");
    expect(source).toContain("STRIPE_MONTHLY_LINK");
    expect(source).toContain("STRIPE_ANNUAL_LINK");
  });

  it("billing toggle has aria-label for screen readers", () => {
    // i18n 化済 (common.toggleBillingPeriod を 3 locale に持つ) — hardcoded 文字列ではなく
    // t() 経由で aria-label が付与されていることを assert。
    expect(source).toMatch(/aria-label=\{t\(["']common\.toggleBillingPeriod["']\)\}/);
  });
});

describe("ProGate benefit-focused copy (Q-46)", () => {
  const ja = JSON.parse(fs.readFileSync(jaMessagesPath, "utf-8"));
  const en = JSON.parse(fs.readFileSync(enMessagesPath, "utf-8"));

  it("Japanese pro.features emphasizes AI/streak/export benefits (not feature list)", () => {
    const features: string = ja.pro.features;
    // Must contain at least one benefit keyword
    expect(features).toMatch(/AI|ストリーク|エクスポート/);
    // Must not be a generic feature list
    expect(features).not.toMatch(/^機能1 ·/);
  });

  it("English pro.features uses benefit-oriented framing", () => {
    const features: string = en.pro.features;
    expect(features.toLowerCase()).toMatch(/ai|streak|export/);
  });

  it("disclaimer string exists in all locales (Stripe compliance)", () => {
    expect(ja.pro.disclaimer).toBeTruthy();
    expect(en.pro.disclaimer).toBeTruthy();
  });
});
