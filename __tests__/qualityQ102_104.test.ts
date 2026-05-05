/**
 * Quality tests for Q-102 (UI), Q-103 (Legal), Q-104 (DX)
 */
import fs from "fs";
import path from "path";

// ─── Q-102: UI improvements ────────────────────────────────
describe("Q-102 UI improvements", () => {
  const lpPath = path.join(process.cwd(), "app/page.tsx");
  const lpSrc = fs.readFileSync(lpPath, "utf-8");
  const helpPath = path.join(process.cwd(), "app/help/page.tsx");
  const helpSrc = fs.readFileSync(helpPath, "utf-8");

  test("LP FAQ section uses responsive grid", () => {
    expect(lpSrc).toContain("md:grid-cols-2");
  });

  test("LP feature cards have emerald hover effect", () => {
    expect(lpSrc).toContain("hover:border-emerald-500/30");
    expect(lpSrc).toContain("hover:shadow-emerald-500/5");
  });

  test("Help page uses wider container on tablet", () => {
    expect(helpSrc).toContain("md:max-w-3xl");
  });
});

// ─── Q-103: Legal improvements ─────────────────────────────
// z255d cont: i18n 化で content を messages/en.json privacy.* に移行。
// テストも tsx + en.json 両方を見て検証する。
describe("Q-103 Legal improvements", () => {
  const privacyPath = path.join(process.cwd(), "app/privacy/page.tsx");
  const privacySrc = fs.readFileSync(privacyPath, "utf-8");
  const en = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages/en.json"), "utf-8")
  );
  const privacyContent = JSON.stringify(en.privacy);

  test("Privacy Policy has CCPA section", () => {
    expect(privacySrc).toContain('id="ccpa"');
    expect(privacyContent).toContain("California Consumer Privacy Act");
  });

  test("CCPA section covers Right to Know, Delete, Opt-Out, Non-Discrimination", () => {
    expect(privacyContent).toContain("Right to Know");
    expect(privacyContent).toContain("Right to Delete");
    expect(privacyContent).toContain("Right to Opt-Out of Sale");
    expect(privacyContent).toContain("Right to Non-Discrimination");
  });

  test("Privacy Policy states we do not sell personal information", () => {
    expect(privacyContent).toContain("does not sell");
  });

  test("CCPA 45-day response requirement mentioned", () => {
    expect(privacyContent).toContain("45 days");
  });

  test("Cookies section expanded with 3 categories", () => {
    expect(privacyContent).toContain("Essential");
    expect(privacyContent).toContain("Analytics");
    expect(privacyContent).toContain("Marketing");
  });

  test("Cookies section mentions no fingerprinting", () => {
    expect(privacyContent).toContain("fingerprinting");
  });

  test("Privacy Policy has 14 sections in TOC", () => {
    // z255d: TOC は en.json privacy.toc の key 数で検証
    const tocKeys = Object.keys(en.privacy.toc ?? {});
    expect(tocKeys.length).toBe(14);
  });

  test("Privacy footer has DPA link", () => {
    expect(privacySrc).toContain('href="/legal/dpa"');
  });

  test("DPA page has error.tsx", () => {
    const errorPath = path.join(process.cwd(), "app/legal/dpa/error.tsx");
    expect(fs.existsSync(errorPath)).toBe(true);
  });
});

// ─── Q-104: DX / lint cleanup ──────────────────────────────
describe("Q-104 DX improvements", () => {
  test("DPA error.tsx uses ErrorFallback component", () => {
    const errorPath = path.join(process.cwd(), "app/legal/dpa/error.tsx");
    const src = fs.readFileSync(errorPath, "utf-8");
    expect(src).toContain("ErrorFallback");
    expect(src).toContain('"use client"');
  });

  test("LP footer has DPA link", () => {
    const lpPath = path.join(process.cwd(), "app/page.tsx");
    const lpSrc = fs.readFileSync(lpPath, "utf-8");
    expect(lpSrc).toContain('href="/legal/dpa"');
  });
});
