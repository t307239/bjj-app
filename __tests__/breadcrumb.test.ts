/**
 * breadcrumb — unit tests for BreadcrumbList JSON-LD helper
 */
import { describe, it, expect } from "vitest";
import { buildBreadcrumbJsonLd } from "../lib/breadcrumb";

describe("buildBreadcrumbJsonLd", () => {
  it("generates valid BreadcrumbList schema", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://example.com" },
      { name: "Page", url: "https://example.com/page" },
    ]);

    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("BreadcrumbList");
    expect(result.itemListElement).toHaveLength(2);
  });

  it("assigns correct positions starting at 1", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "A", url: "https://a.com" },
      { name: "B", url: "https://b.com" },
      { name: "C", url: "https://c.com" },
    ]);

    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[1].position).toBe(2);
    expect(result.itemListElement[2].position).toBe(3);
  });

  it("maps name and item correctly", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "BJJ App", url: "https://bjj-app.net" },
    ]);

    expect(result.itemListElement[0].name).toBe("BJJ App");
    expect(result.itemListElement[0].item).toBe("https://bjj-app.net");
    expect(result.itemListElement[0]["@type"]).toBe("ListItem");
  });

  it("handles empty array", () => {
    const result = buildBreadcrumbJsonLd([]);
    expect(result.itemListElement).toHaveLength(0);
  });

  it("generates JSON-serializable output", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://bjj-app.net" },
      { name: "Help", url: "https://bjj-app.net/help" },
    ]);

    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toHaveLength(2);
  });
});
