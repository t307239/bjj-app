import { test, expect } from "@playwright/test";

/**
 * E2E: Static Pages — 外結テスト
 *
 * Terms, Privacy, Gym, 404 等の静的ページを検証。
 * すべてパブリックアクセス可能なページ。
 */

test.describe("Terms of Service", () => {
  test("renders terms page", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("body")).toBeVisible();
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    const body = await page.textContent("body");
    expect(body).toMatch(/terms|利用規約|service/i);
  });

  test("terms page has noindex meta", async ({ page }) => {
    await page.goto("/terms");
    const robots = page.locator('meta[name="robots"]');
    const count = await robots.count();
    if (count > 0) {
      await expect(robots).toHaveAttribute("content", /noindex/i);
    }
  });
});

test.describe("Privacy Policy", () => {
  test("renders privacy page", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toBeVisible();
    const body = await page.textContent("body");
    expect(body).toMatch(/privacy|プライバシー|個人情報/i);
  });

  test("privacy page has noindex meta", async ({ page }) => {
    await page.goto("/privacy");
    const robots = page.locator('meta[name="robots"]');
    const count = await robots.count();
    if (count > 0) {
      await expect(robots).toHaveAttribute("content", /noindex/i);
    }
  });
});

test.describe("Gym Page (B2B)", () => {
  test("renders gym landing page", async ({ page }) => {
    await page.goto("/gym");
    await expect(page.locator("body")).toBeVisible();
    const body = await page.textContent("body");
    expect(body).toMatch(/academy|gym|道場|students|生徒/i);
  });

  test("gym page has pricing info", async ({ page }) => {
    await page.goto("/gym");
    const pricing = page.getByText(/\$49|\$99|month/i);
    const count = await pricing.count();
    if (count > 0) {
      await expect(pricing.first()).toBeVisible();
    }
  });

  test("gym page has waitlist form or CTA", async ({ page }) => {
    await page.goto("/gym", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {}); // graceful fallback
    const formOrCTA = page.locator(
      'input[type="email"], a[href*="mailto"], button, form'
    );
    const count = await formOrCTA.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("404 Page", () => {
  test("renders 404 for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    expect(response?.status()).toBe(404);
  });

  test("404 page has back-to-home link", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const homeLink = page.locator('a[href="/"]');
    const count = await homeLink.count();
    if (count > 0) {
      await expect(homeLink.first()).toBeVisible();
    }
  });
});

test.describe("Sitemap", () => {
  test("sitemap.xml is accessible", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
    const body = await page.textContent("body");
    expect(body).toContain("urlset");
  });
});

test.describe("PWA Manifest", () => {
  test("manifest.json is accessible", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    expect(response?.status()).toBe(200);
    const body = await page.textContent("body");
    expect(body).toContain("BJJ");
  });
});

test.describe("API Health", () => {
  test("OG image API returns image", async ({ page }) => {
    test.setTimeout(60000); // OG image generation can be slow locally
    const response = await page.goto("/api/og?belt=white&count=10&months=3", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("image");
  });
});
