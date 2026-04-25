/**
 * safeJsonLd — defense-in-depth helper for JSON-LD `<script>` tags.
 *
 * `JSON.stringify` alone is vulnerable when serialized data contains the
 * substring `</script>` because browsers terminate the script tag at the
 * literal closing tag, allowing the rest of the JSON to be parsed as HTML
 * (and arbitrary tags / handlers to follow).
 *
 * Mitigation per https://html.spec.whatwg.org/multipage/scripting.html#restrictions-for-contents-of-script-elements
 * is to escape any `<` immediately followed by `/` (as `\u003c\/`).
 *
 * Use:
 *   <script type="application/ld+json"
 *           dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
 *
 * Use this for EVERY `<script type="application/ld+json">` even when the
 * source is fully server-controlled — defense-in-depth costs us 1 regex
 * replace and removes a whole class of XSS vectors if any field ever starts
 * embedding admin-editable content (page titles/descriptions, user names,
 * etc.).
 *
 * @see z168 (Day 6_237) — added after security systematic scan flagged 18
 *   call sites of `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`
 *   with no `</script>` escape.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\//g, "<\\/")
    // U+2028 / U+2029 break JS string literals in some engines; escape too
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
