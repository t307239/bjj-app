/**
 * BreadcrumbList JSON-LD generator for SEO.
 *
 * Usage:
 *   const jsonLd = buildBreadcrumbJsonLd([
 *     { name: "Home", url: "https://bjj-app.net" },
 *     { name: "Records", url: "https://bjj-app.net/records" },
 *   ]);
 */

type BreadcrumbItem = { name: string; url: string };

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
