/**
 * Q-217: SEO Health Monitor — continuous SEO health checking
 *
 * Provides automated SEO health checks that combine technical SEO,
 * Core Web Vitals impact, and content quality signals into a single
 * actionable report.
 *
 * Bridges the gap between performance monitoring and SEO scoring.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SEOHealthCheck {
  name: string;
  category: SEOCategory;
  status: "pass" | "warn" | "fail";
  severity: "critical" | "major" | "minor";
  message: string;
  recommendation?: string;
}

export type SEOCategory =
  | "technical"
  | "content"
  | "performance"
  | "mobile"
  | "indexing"
  | "social";

export interface SEOPageAudit {
  url: string;
  checks: SEOHealthCheck[];
  score: number;
  grade: string;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface SEOSiteHealth {
  pages: SEOPageAudit[];
  overallScore: number;
  overallGrade: string;
  criticalIssues: SEOHealthCheck[];
  topRecommendations: string[];
  categoryScores: Record<SEOCategory, number>;
}

export interface PageMeta {
  url: string;
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  hreflang?: Array<{ lang: string; href: string }>;
  h1Count?: number;
  imgWithoutAlt?: number;
  internalLinks?: number;
  externalLinks?: number;
  wordCount?: number;
  hasStructuredData?: boolean;
  hasBreadcrumb?: boolean;
  isIndexable?: boolean;
  mobileViewport?: boolean;
  httpsOnly?: boolean;
  loadTimeMs?: number;
  lcpMs?: number;
  clsScore?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MIN_LENGTH = 70;
const DESCRIPTION_MAX_LENGTH = 160;
const MIN_WORD_COUNT = 300;
const MAX_LOAD_TIME_MS = 3000;
const MAX_LCP_MS = 2500;
const MAX_CLS = 0.1;

const CATEGORY_WEIGHTS: Record<SEOCategory, number> = {
  technical: 25,
  content: 20,
  performance: 25,
  mobile: 10,
  indexing: 15,
  social: 5,
};

// ---------------------------------------------------------------------------
// Core checks
// ---------------------------------------------------------------------------

/**
 * Run all SEO health checks against a page's metadata.
 */
export function checkPageSEO(meta: PageMeta): SEOPageAudit {
  const checks: SEOHealthCheck[] = [
    // Technical checks
    checkTitle(meta),
    checkDescription(meta),
    checkCanonical(meta),
    checkHTTPS(meta),
    checkStructuredData(meta),
    checkBreadcrumb(meta),
    // Content checks
    checkH1(meta),
    checkWordCount(meta),
    checkImageAlt(meta),
    checkInternalLinks(meta),
    // Performance checks
    checkLoadTime(meta),
    checkLCP(meta),
    checkCLS(meta),
    // Mobile checks
    checkMobileViewport(meta),
    // Indexing checks
    checkIndexability(meta),
    checkHreflang(meta),
    // Social checks
    checkOGMeta(meta),
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passCount / total) * 100) : 0;

  return {
    url: meta.url,
    checks,
    score,
    grade: scoreToGrade(score),
    passCount,
    warnCount,
    failCount,
  };
}

/**
 * Run SEO health checks across multiple pages and build a site-level report.
 */
export function checkSiteHealth(pages: PageMeta[]): SEOSiteHealth {
  const audits = pages.map(checkPageSEO);
  const overallScore =
    audits.length > 0
      ? Math.round(audits.reduce((sum, a) => sum + a.score, 0) / audits.length)
      : 0;

  const allChecks = audits.flatMap((a) => a.checks);
  const criticalIssues = allChecks.filter(
    (c) => c.status === "fail" && c.severity === "critical"
  );

  // Calculate per-category scores
  const categoryScores = calculateCategoryScores(allChecks);

  // Generate top recommendations
  const failChecks = allChecks.filter((c) => c.status === "fail");
  const topRecommendations = deduplicateRecommendations(
    failChecks
      .filter((c) => c.recommendation)
      .map((c) => c.recommendation as string)
  ).slice(0, 5);

  return {
    pages: audits,
    overallScore,
    overallGrade: scoreToGrade(overallScore),
    criticalIssues,
    topRecommendations,
    categoryScores,
  };
}

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------

function checkTitle(meta: PageMeta): SEOHealthCheck {
  if (!meta.title) {
    return {
      name: "Page title",
      category: "technical",
      status: "fail",
      severity: "critical",
      message: "Missing page title",
      recommendation: "Add a descriptive title between 30-60 characters",
    };
  }
  if (meta.title.length < TITLE_MIN_LENGTH) {
    return {
      name: "Page title length",
      category: "technical",
      status: "warn",
      severity: "minor",
      message: `Title too short (${meta.title.length} chars, min ${TITLE_MIN_LENGTH})`,
      recommendation: "Expand title to at least 30 characters for better CTR",
    };
  }
  if (meta.title.length > TITLE_MAX_LENGTH) {
    return {
      name: "Page title length",
      category: "technical",
      status: "warn",
      severity: "minor",
      message: `Title too long (${meta.title.length} chars, max ${TITLE_MAX_LENGTH})`,
      recommendation: "Shorten title to under 60 characters to avoid truncation",
    };
  }
  return {
    name: "Page title",
    category: "technical",
    status: "pass",
    severity: "critical",
    message: `Title OK (${meta.title.length} chars)`,
  };
}

function checkDescription(meta: PageMeta): SEOHealthCheck {
  if (!meta.description) {
    return {
      name: "Meta description",
      category: "technical",
      status: "fail",
      severity: "major",
      message: "Missing meta description",
      recommendation: "Add a meta description between 70-160 characters",
    };
  }
  if (meta.description.length < DESCRIPTION_MIN_LENGTH || meta.description.length > DESCRIPTION_MAX_LENGTH) {
    return {
      name: "Meta description length",
      category: "technical",
      status: "warn",
      severity: "minor",
      message: `Description ${meta.description.length} chars (ideal: ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH})`,
    };
  }
  return {
    name: "Meta description",
    category: "technical",
    status: "pass",
    severity: "major",
    message: `Description OK (${meta.description.length} chars)`,
  };
}

function checkCanonical(meta: PageMeta): SEOHealthCheck {
  return {
    name: "Canonical URL",
    category: "indexing",
    status: meta.canonical ? "pass" : "warn",
    severity: "major",
    message: meta.canonical ? "Canonical URL set" : "No canonical URL found",
    recommendation: meta.canonical ? undefined : "Add a canonical URL to prevent duplicate content issues",
  };
}

function checkHTTPS(meta: PageMeta): SEOHealthCheck {
  return {
    name: "HTTPS",
    category: "technical",
    status: meta.httpsOnly !== false ? "pass" : "fail",
    severity: "critical",
    message: meta.httpsOnly !== false ? "HTTPS enforced" : "HTTP detected, HTTPS required",
    recommendation: meta.httpsOnly === false ? "Enforce HTTPS across all pages" : undefined,
  };
}

function checkStructuredData(meta: PageMeta): SEOHealthCheck {
  return {
    name: "Structured data",
    category: "content",
    status: meta.hasStructuredData ? "pass" : "warn",
    severity: "minor",
    message: meta.hasStructuredData ? "JSON-LD structured data found" : "No structured data detected",
    recommendation: meta.hasStructuredData ? undefined : "Add JSON-LD structured data (FAQPage, BreadcrumbList, etc.)",
  };
}

function checkBreadcrumb(meta: PageMeta): SEOHealthCheck {
  return {
    name: "Breadcrumb navigation",
    category: "content",
    status: meta.hasBreadcrumb ? "pass" : "warn",
    severity: "minor",
    message: meta.hasBreadcrumb ? "Breadcrumb present" : "No breadcrumb found",
  };
}

function checkH1(meta: PageMeta): SEOHealthCheck {
  if (meta.h1Count === undefined) {
    return { name: "H1 tag", category: "content", status: "warn", severity: "major", message: "H1 count unknown" };
  }
  if (meta.h1Count === 0) {
    return {
      name: "H1 tag",
      category: "content",
      status: "fail",
      severity: "major",
      message: "No H1 tag found",
      recommendation: "Add exactly one H1 tag per page",
    };
  }
  if (meta.h1Count > 1) {
    return {
      name: "H1 tag",
      category: "content",
      status: "warn",
      severity: "minor",
      message: `Multiple H1 tags found (${meta.h1Count})`,
      recommendation: "Use only one H1 tag per page",
    };
  }
  return { name: "H1 tag", category: "content", status: "pass", severity: "major", message: "Single H1 tag found" };
}

function checkWordCount(meta: PageMeta): SEOHealthCheck {
  if (meta.wordCount === undefined) {
    return { name: "Word count", category: "content", status: "warn", severity: "minor", message: "Word count unknown" };
  }
  return {
    name: "Word count",
    category: "content",
    status: meta.wordCount >= MIN_WORD_COUNT ? "pass" : "warn",
    severity: "minor",
    message: `${meta.wordCount} words (min recommended: ${MIN_WORD_COUNT})`,
  };
}

function checkImageAlt(meta: PageMeta): SEOHealthCheck {
  if (meta.imgWithoutAlt === undefined) {
    return { name: "Image alt text", category: "content", status: "warn", severity: "minor", message: "Image alt check skipped" };
  }
  return {
    name: "Image alt text",
    category: "content",
    status: meta.imgWithoutAlt === 0 ? "pass" : "fail",
    severity: "major",
    message: meta.imgWithoutAlt === 0 ? "All images have alt text" : `${meta.imgWithoutAlt} images missing alt text`,
    recommendation: meta.imgWithoutAlt > 0 ? "Add descriptive alt text to all images" : undefined,
  };
}

function checkInternalLinks(meta: PageMeta): SEOHealthCheck {
  if (meta.internalLinks === undefined) {
    return { name: "Internal links", category: "indexing", status: "warn", severity: "minor", message: "Internal link count unknown" };
  }
  return {
    name: "Internal links",
    category: "indexing",
    status: meta.internalLinks >= 3 ? "pass" : "warn",
    severity: "minor",
    message: `${meta.internalLinks} internal links`,
    recommendation: meta.internalLinks < 3 ? "Add more internal links to improve crawlability" : undefined,
  };
}

function checkLoadTime(meta: PageMeta): SEOHealthCheck {
  if (meta.loadTimeMs === undefined) {
    return { name: "Page load time", category: "performance", status: "warn", severity: "major", message: "Load time not measured" };
  }
  return {
    name: "Page load time",
    category: "performance",
    status: meta.loadTimeMs <= MAX_LOAD_TIME_MS ? "pass" : "fail",
    severity: "critical",
    message: `${meta.loadTimeMs}ms (target: <${MAX_LOAD_TIME_MS}ms)`,
    recommendation: meta.loadTimeMs > MAX_LOAD_TIME_MS ? "Optimize page load time with resource hints, lazy loading, and code splitting" : undefined,
  };
}

function checkLCP(meta: PageMeta): SEOHealthCheck {
  if (meta.lcpMs === undefined) {
    return { name: "Largest Contentful Paint", category: "performance", status: "warn", severity: "critical", message: "LCP not measured" };
  }
  const status = meta.lcpMs <= MAX_LCP_MS ? "pass" : meta.lcpMs <= 4000 ? "warn" : "fail";
  return {
    name: "Largest Contentful Paint",
    category: "performance",
    status,
    severity: "critical",
    message: `LCP: ${meta.lcpMs}ms (good: <${MAX_LCP_MS}ms)`,
    recommendation: status !== "pass" ? "Optimize LCP: preconnect origins, optimize images, reduce render-blocking resources" : undefined,
  };
}

function checkCLS(meta: PageMeta): SEOHealthCheck {
  if (meta.clsScore === undefined) {
    return { name: "Cumulative Layout Shift", category: "performance", status: "warn", severity: "major", message: "CLS not measured" };
  }
  return {
    name: "Cumulative Layout Shift",
    category: "performance",
    status: meta.clsScore <= MAX_CLS ? "pass" : "fail",
    severity: "major",
    message: `CLS: ${meta.clsScore} (target: <${MAX_CLS})`,
    recommendation: meta.clsScore > MAX_CLS ? "Reduce CLS: set explicit dimensions on images/embeds, avoid inserting content above the fold" : undefined,
  };
}

function checkMobileViewport(meta: PageMeta): SEOHealthCheck {
  return {
    name: "Mobile viewport",
    category: "mobile",
    status: meta.mobileViewport !== false ? "pass" : "fail",
    severity: "critical",
    message: meta.mobileViewport !== false ? "Mobile viewport configured" : "Missing mobile viewport meta tag",
  };
}

function checkIndexability(meta: PageMeta): SEOHealthCheck {
  return {
    name: "Indexability",
    category: "indexing",
    status: meta.isIndexable !== false ? "pass" : "warn",
    severity: "critical",
    message: meta.isIndexable !== false ? "Page is indexable" : "Page is not indexable (noindex)",
  };
}

function checkHreflang(meta: PageMeta): SEOHealthCheck {
  if (!meta.hreflang || meta.hreflang.length === 0) {
    return {
      name: "Hreflang tags",
      category: "indexing",
      status: "warn",
      severity: "minor",
      message: "No hreflang tags found",
      recommendation: "Add hreflang tags for multilingual content",
    };
  }
  return {
    name: "Hreflang tags",
    category: "indexing",
    status: "pass",
    severity: "minor",
    message: `${meta.hreflang.length} hreflang tags found`,
  };
}

function checkOGMeta(meta: PageMeta): SEOHealthCheck {
  const hasOG = meta.ogTitle && meta.ogDescription && meta.ogImage;
  return {
    name: "Open Graph meta",
    category: "social",
    status: hasOG ? "pass" : "warn",
    severity: "minor",
    message: hasOG ? "OG title, description, and image set" : "Incomplete Open Graph meta tags",
    recommendation: hasOG ? undefined : "Add og:title, og:description, and og:image for social sharing",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateCategoryScores(
  checks: SEOHealthCheck[]
): Record<SEOCategory, number> {
  const categories = Object.keys(CATEGORY_WEIGHTS) as SEOCategory[];
  const scores: Record<SEOCategory, number> = {} as Record<SEOCategory, number>;

  for (const cat of categories) {
    const catChecks = checks.filter((c) => c.category === cat);
    if (catChecks.length === 0) {
      scores[cat] = 100;
      continue;
    }
    const passCount = catChecks.filter((c) => c.status === "pass").length;
    scores[cat] = Math.round((passCount / catChecks.length) * 100);
  }

  return scores;
}

function deduplicateRecommendations(recs: string[]): string[] {
  return [...new Set(recs)];
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Format a site health report as a human-readable string.
 */
export function formatSiteHealth(health: SEOSiteHealth): string {
  const lines: string[] = [
    `SEO Site Health: ${health.overallScore}/100 (${health.overallGrade})`,
    `Pages audited: ${health.pages.length}`,
    `Critical issues: ${health.criticalIssues.length}`,
    "",
    "Category Scores:",
    ...Object.entries(health.categoryScores).map(
      ([cat, score]) => `  ${cat}: ${score}/100`
    ),
    "",
    "Top Recommendations:",
    ...health.topRecommendations.map((r) => `  - ${r}`),
  ];
  return lines.join("\n");
}
