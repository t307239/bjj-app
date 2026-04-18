/**
 * seoStructuredData.ts — Structured data validation and JSON-LD schema generation
 *
 * Pure-function utility for validating and generating JSON-LD structured data
 * schemas (WebSite, FAQPage, BreadcrumbList, SoftwareApplication, etc.)
 * to improve SEO and search engine understanding.
 *
 * @module Q-196
 * @since Q-196
 */

/* ---------- Types ---------- */

export type SchemaType =
  | "WebSite"
  | "WebPage"
  | "FAQPage"
  | "BreadcrumbList"
  | "Organization"
  | "SoftwareApplication"
  | "Article";

export interface StructuredDataEntry {
  readonly "@context"?: string;
  readonly "@type": SchemaType;
  readonly [key: string]: unknown;
}

export interface SEOValidationError {
  readonly field: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface SEOAuditResult {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly schemas: readonly SchemaType[];
  readonly errors: readonly SEOValidationError[];
  readonly warnings: readonly SEOValidationError[];
  readonly recommendations: readonly string[];
  readonly hasTitle: boolean;
  readonly hasDescription: boolean;
  readonly hasCanonical: boolean;
  readonly hasOgImage: boolean;
}

/* ---------- Constants ---------- */

export const SCHEMA_CONTEXT = "https://schema.org" as const;

/** Required fields per schema type */
export const REQUIRED_FIELDS: Record<SchemaType, readonly string[]> = {
  WebSite: ["name", "url"],
  WebPage: ["name", "url"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
  Organization: ["name", "url"],
  SoftwareApplication: ["name", "operatingSystem", "applicationCategory"],
  Article: ["headline", "author", "datePublished"],
} as const;

/** Recommended fields per schema type (not required but boost SEO) */
const RECOMMENDED_FIELDS: Record<SchemaType, readonly string[]> = {
  WebSite: ["description", "potentialAction"],
  WebPage: ["description", "breadcrumb"],
  FAQPage: [],
  BreadcrumbList: [],
  Organization: ["logo", "sameAs", "contactPoint"],
  SoftwareApplication: ["aggregateRating", "offers"],
  Article: ["image", "dateModified", "publisher"],
};

/* ---------- Functions ---------- */

/**
 * Validate a structured data entry for required fields and correct format.
 */
export function validateStructuredData(
  entry: StructuredDataEntry
): readonly SEOValidationError[] {
  const errors: SEOValidationError[] = [];
  const type = entry["@type"];

  if (!entry["@context"] || entry["@context"] !== SCHEMA_CONTEXT) {
    errors.push({
      field: "@context",
      message: `Missing or invalid @context. Expected "${SCHEMA_CONTEXT}"`,
      severity: "error",
    });
  }

  const required = REQUIRED_FIELDS[type];
  if (!required) {
    errors.push({
      field: "@type",
      message: `Unknown schema type: ${type}`,
      severity: "error",
    });
    return errors;
  }

  for (const field of required) {
    const value = entry[field];
    if (value === undefined || value === null || value === "") {
      errors.push({
        field,
        message: `Required field "${field}" is missing for ${type}`,
        severity: "error",
      });
    }
  }

  const recommended = RECOMMENDED_FIELDS[type] ?? [];
  for (const field of recommended) {
    if (entry[field] === undefined) {
      errors.push({
        field,
        message: `Recommended field "${field}" is missing for ${type}`,
        severity: "warning",
      });
    }
  }

  return errors;
}

/**
 * Generate a WebSite JSON-LD schema with optional search action.
 */
export function generateWebSiteSchema(
  name: string,
  url: string,
  searchUrl?: string
): StructuredDataEntry {
  const schema: Record<string, unknown> = {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite" as SchemaType,
    name,
    url,
  };

  if (searchUrl) {
    schema.potentialAction = {
      "@type": "SearchAction",
      target: `${searchUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    };
  }

  return schema as StructuredDataEntry;
}

/**
 * Generate a BreadcrumbList JSON-LD schema from navigation items.
 */
export function generateBreadcrumbSchema(
  items: readonly { readonly name: string; readonly url: string }[]
): StructuredDataEntry {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  } as StructuredDataEntry;
}

/**
 * Generate a FAQPage JSON-LD schema from question/answer pairs.
 */
export function generateFAQSchema(
  faqs: readonly { readonly question: string; readonly answer: string }[]
): StructuredDataEntry {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } as StructuredDataEntry;
}

/**
 * Generate a SoftwareApplication JSON-LD schema.
 */
export function generateSoftwareAppSchema(
  name: string,
  os: string,
  rating: number,
  price: string
): StructuredDataEntry {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SoftwareApplication",
    name,
    operatingSystem: os,
    applicationCategory: "SportsApplication",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(Math.round(rating * 100) / 100),
      bestRating: "5",
    },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
    },
  } as StructuredDataEntry;
}

/**
 * Audit a page's SEO structured data, meta tags, and overall quality.
 */
export function auditPageSEO(
  schemas: readonly StructuredDataEntry[],
  title: string | undefined,
  description: string | undefined,
  canonical: string | undefined,
  ogImage: string | undefined
): SEOAuditResult {
  let score = 100;
  const errors: SEOValidationError[] = [];
  const warnings: SEOValidationError[] = [];
  const recommendations: string[] = [];
  const schemaTypes: SchemaType[] = [];

  // Meta tag checks
  const hasTitle = !!title && title.length > 0;
  const hasDescription = !!description && description.length > 0;
  const hasCanonical = !!canonical && canonical.length > 0;
  const hasOgImage = !!ogImage && ogImage.length > 0;

  if (!hasTitle) {
    score -= 20;
    errors.push({ field: "title", message: "Missing page title", severity: "error" });
  } else if (title!.length > 60) {
    score -= 5;
    warnings.push({ field: "title", message: `Title too long (${title!.length} chars, max 60)`, severity: "warning" });
  }

  if (!hasDescription) {
    score -= 15;
    errors.push({ field: "description", message: "Missing meta description", severity: "error" });
  } else if (description!.length > 160) {
    score -= 3;
    warnings.push({ field: "description", message: `Description too long (${description!.length} chars, max 160)`, severity: "warning" });
  } else if (description!.length < 50) {
    score -= 3;
    warnings.push({ field: "description", message: `Description too short (${description!.length} chars, min 50)`, severity: "warning" });
  }

  if (!hasCanonical) {
    score -= 10;
    errors.push({ field: "canonical", message: "Missing canonical URL", severity: "error" });
    recommendations.push("Add a canonical URL to prevent duplicate content issues");
  }

  if (!hasOgImage) {
    score -= 5;
    warnings.push({ field: "ogImage", message: "Missing Open Graph image", severity: "warning" });
    recommendations.push("Add an OG image for better social sharing appearance");
  }

  // Schema validation
  if (schemas.length === 0) {
    score -= 15;
    recommendations.push("Add structured data (JSON-LD) to improve search appearance");
  }

  for (const schema of schemas) {
    schemaTypes.push(schema["@type"]);
    const validationErrors = validateStructuredData(schema);
    for (const err of validationErrors) {
      if (err.severity === "error") {
        score -= 5;
        errors.push(err);
      } else {
        score -= 2;
        warnings.push(err);
      }
    }
  }

  // Bonus recommendations
  if (!schemaTypes.includes("BreadcrumbList")) {
    recommendations.push("Add BreadcrumbList schema for better navigation display in search results");
  }
  if (!schemaTypes.includes("Organization") && !schemaTypes.includes("WebSite")) {
    recommendations.push("Add Organization or WebSite schema for brand identity");
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    grade: finalScore >= 90 ? "A" : finalScore >= 80 ? "B" : finalScore >= 70 ? "C" : finalScore >= 60 ? "D" : "F",
    schemas: schemaTypes,
    errors,
    warnings,
    recommendations,
    hasTitle,
    hasDescription,
    hasCanonical,
    hasOgImage,
  };
}

/**
 * Format an SEO audit result as a human-readable string report.
 */
export function formatSEOAudit(result: SEOAuditResult): string {
  const lines: string[] = [
    "=== SEO Structured Data Audit ===",
    `Score: ${result.score}/100 (${result.grade})`,
    "",
    "Meta Tags:",
    `  Title:       ${result.hasTitle ? "OK" : "MISSING"}`,
    `  Description: ${result.hasDescription ? "OK" : "MISSING"}`,
    `  Canonical:   ${result.hasCanonical ? "OK" : "MISSING"}`,
    `  OG Image:    ${result.hasOgImage ? "OK" : "MISSING"}`,
    "",
    `Schemas Found: ${result.schemas.length > 0 ? result.schemas.join(", ") : "None"}`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    for (const err of result.errors) {
      lines.push(`  [ERROR] ${err.field}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warn of result.warnings) {
      lines.push(`  [WARN] ${warn.field}: ${warn.message}`);
    }
  }

  if (result.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of result.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join("\n");
}
