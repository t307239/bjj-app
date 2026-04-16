/**
 * qualityQ82_86 — tests for Q-82 through Q-86 quality improvements
 *
 * Tests:
 * - loading.tsx presence for all app routes
 * - SUPABASE_NO_ERROR fixes in cron routes
 * - Tablet responsive breakpoints
 * - ProGate comparison table i18n keys
 * - BreadcrumbList JSON-LD presence in pages
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const MESSAGES_DIR = path.resolve(__dirname, "../messages");

// ── Q-82: loading.tsx coverage ─────────────────────────────────────────────
describe("Q-82: loading.tsx coverage", () => {
  const routes = [
    "legal",
    "privacy",
    "terms",
    "account-deleted",
    "dashboard",
    "records",
    "profile",
    "techniques",
    "help",
    "settings",
    "login",
    "admin",
  ];

  for (const route of routes) {
    it(`app/${route}/loading.tsx exists`, () => {
      const loadingPath = path.join(APP_DIR, route, "loading.tsx");
      expect(fs.existsSync(loadingPath)).toBe(true);
    });
  }
});

// ── Q-82: SUPABASE_NO_ERROR fixes ──────────────────────────────────────────
describe("Q-82: SUPABASE_NO_ERROR fixes", () => {
  it("db-check handles error on push_subscriptions query", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/db-check/route.ts"),
      "utf-8"
    );
    // The duplicate push endpoints query should destructure error
    const pushSection = source.split("Duplicate push subscriptions")[1] ?? source;
    expect(pushSection).toContain("error");
    expect(pushSection).toContain("logger.warn");
  });

  it("db-check handles error on orphan push RPC", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/db-check/route.ts"),
      "utf-8"
    );
    const rpcSection = source.split("Push subscriptions without profiles")[1]?.split("Profiles with invalid belt")[0] ?? "";
    expect(rpcSection).toContain("const { data, error }");
  });

  it("weekly-goal handles error on training logs query", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "api/cron/weekly-goal/route.ts"),
      "utf-8"
    );
    expect(source).toContain("logErr");
    expect(source).toContain("logger.warn");
  });
});

// ── Q-83: Tablet responsive breakpoints ────────────────────────────────────
describe("Q-83: Tablet responsive breakpoints", () => {
  it("dashboard uses md:grid for widget pairs", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "dashboard/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("md:grid");
    expect(source).toContain("md:grid-cols-2");
    expect(source).toContain("md:gap-5");
  });

  it("records uses md:grid for analytics cards", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "records/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("md:grid");
    expect(source).toContain("md:grid-cols-2");
  });

  it("profile uses md: responsive sizing", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "profile/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("md:w-20");
    expect(source).toContain("md:h-20");
    expect(source).toContain("md:p-6");
  });
});

// ── Q-84: ProGate comparison table ─────────────────────────────────────────
describe("Q-84: ProGate comparison table", () => {
  it("ProGate.tsx has comparison table structure", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/ProGate.tsx"),
      "utf-8"
    );
    expect(source).toContain("compareTitle");
    expect(source).toContain("compareFree");
    expect(source).toContain("comparePro");
    expect(source).toContain("grid grid-cols-3");
  });

  it("ProGate.tsx has urgency badge", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/ProGate.tsx"),
      "utf-8"
    );
    expect(source).toContain("urgencyBadge");
  });

  for (const lang of ["en", "ja", "pt"]) {
    it(`${lang}.json has comparison table keys`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, `${lang}.json`), "utf-8")
      );
      expect(data.pro.compareTitle).toBeDefined();
      expect(data.pro.compareFree).toBeDefined();
      expect(data.pro.comparePro).toBeDefined();
      expect(data.pro.compareLog).toBeDefined();
      expect(data.pro.compareAI).toBeDefined();
      expect(data.pro.urgencyBadge).toBeDefined();
    });
  }
});

// ── Q-85: BreadcrumbList JSON-LD ───────────────────────────────────────────
describe("Q-85: BreadcrumbList JSON-LD", () => {
  const pagesWithBreadcrumb = [
    { file: "help/page.tsx", name: "help" },
    { file: "records/page.tsx", name: "records" },
    { file: "profile/page.tsx", name: "profile" },
    { file: "techniques/page.tsx", name: "techniques" },
  ];

  for (const { file, name } of pagesWithBreadcrumb) {
    it(`${name} page uses buildBreadcrumbJsonLd`, () => {
      const source = fs.readFileSync(path.join(APP_DIR, file), "utf-8");
      expect(source).toContain("buildBreadcrumbJsonLd");
      expect(source).toContain("application/ld+json");
    });
  }

  it("lib/breadcrumb.ts exists", () => {
    expect(
      fs.existsSync(path.resolve(__dirname, "../lib/breadcrumb.ts"))
    ).toBe(true);
  });

  it("barrel export includes breadcrumb", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../lib/index.ts"),
      "utf-8"
    );
    expect(source).toContain("buildBreadcrumbJsonLd");
  });
});
