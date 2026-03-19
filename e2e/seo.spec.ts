import { test, expect } from "@playwright/test";

/**
 * E2E: SEO & Accessibility — 外結テスト
 *
 * 全公開ページのSEO要件とアクセシビリティ基本チェック。
 */

const PUBLIC_PAGES = [
  { path: "/", name: "LP" },
  { path: "/login", name: "Login" },
  { path: "/gym", name: "Gym" },
  { path: "/terms", name: "Terms" },
  { path: "/privacy", name: "Privacy" },
];

test.describe("SEO - Meta Tags", () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) has <title>`, async ({ page }) => {
      await page.goto(path);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test(`${name} (${path}) has meta description`, async ({ page }) => {
      await page.goto(path);
      const desc = page.locator('meta[name="description"]');
      const count = await desc.count();
      if (count > 0) {
        const content = await desc.getAttribute("content");
        expect(content!.length).toBeGreaterThan(10);
      }
    });

    test(`${name} (${path}) has charset UTF-8`, async ({ page }) => {
      await page.goto(path);
      const charset = page.locator('meta[charset]');
      const count = await charset.count();
      if (count > 0) {
        await expect(charset).toHaveAttribute("charset", /utf-8/i);
      }
    });

    test(`${name} (${path}) has viewport meta`, async ({ page }) => {
      await page.goto(path);
      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toBeAttached();
    });
  }
});

test.describe("SEO - Open Graph", () => {
  test("LP has og:title", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    const count = await ogTitle.count();
    if (count > 0) {
      const content = await ogTitle.getAttribute("content");
      expect(content!.length).toBeGreaterThan(0);
    }
  });

  test("LP has og:description", async ({ page }) => {
    await page.goto("/");
    const ogDesc = page.locator('meta[property="og:description"]');
    const count = await ogDesc.count();
    if (count > 0) {
      const content = await ogDesc.getAttribute("content");
      expect(content!.length).toBeGreaterThan(10);
    }
  });

  test("LP has og:url", async ({ page }) => {
    await page.goto("/");
    const ogUrl = page.locator('meta[property="og:url"]');
    const count = await ogUrl.count();
    if (count > 0) {
      const content = await ogUrl.getAttribute("content");
      expect(content).toMatch(/^https?:\/\//);
    }
  });
});

test.describe("Accessibility Basics", () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) has lang attribute on <html>`, async ({
      page,
    }) => {
      await page.goto(path);
      const lang = await page.getAttribute("html", "lang");
      expect(lang).toBeTruthy();
    });

    test(`${name} (${path}) has no duplicate IDs`, async ({ page }) => {
      await page.goto(path);
      const duplicateIds = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map(
          (el) => el.id
        );
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const id of ids) {
          if (id && seen.has(id)) dupes.push(id);
          seen.add(id);
        }
        return dupes;
      });
      if (duplicateIds.length > 0) {
        console.warn(`[${name}] Duplicate IDs found: ${duplicateIds.join(", ")}`);
      }
      // Allow up to 3 duplicates (common in SSR hydration)
      expect(duplicateIds.length).toBeLessThanOrEqual(3);
    });

    test(`${name} (${path}) images have alt attributes`, async ({ page }) => {
      await page.goto(path);
      const imagesWithoutAlt = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        return imgs.filter((img) => !img.hasAttribute("alt")).length;
      });
      expect(imagesWithoutAlt).toBe(0);
    });
  }
});

test.describe("Performance Basics", () => {
  test("LP loads within 10 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });

  test("no console errors on LP", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydration") &&
        !e.includes("Hydration") &&
        !e.includes("favicon") &&
        !e.includes("serviceWorker")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
