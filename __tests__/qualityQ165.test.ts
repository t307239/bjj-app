/**
 * Tests for Q-165: messageFormatter (i18n 93→94)
 */
import { describe, it, expect } from "vitest";

describe("Q-165: messageFormatter", () => {
  it("core formatting: interpolation + plural + select", async () => {
    const m = await import("@/lib/messageFormatter");

    // Simple interpolation
    expect(m.formatMessage("Hi {name}", { name: "T" })).toBe("Hi T");
    expect(m.formatMessage("{a}+{b}", { a: "X", b: "Y" })).toBe("X+Y");
    expect(m.formatMessage("{x}")).toBe("{x}");
    expect(m.formatMessage("N:{n}", { n: 42 })).toBe("N:42");

    // Plural EN
    expect(m.formatMessage("{n, plural, one {# item} other {# items}}", { n: 1 }, "en")).toBe("1 item");
    expect(m.formatMessage("{n, plural, one {# item} other {# items}}", { n: 5 }, "en")).toBe("5 items");

    // Plural =0
    expect(m.formatMessage("{n, plural, =0 {zero} other {#}}", { n: 0 })).toBe("zero");

    // Select
    expect(m.formatMessage("{x, select, a {AA} other {BB}}", { x: "a" })).toBe("AA");
    expect(m.formatMessage("{x, select, a {AA} other {BB}}", { x: "z" })).toBe("BB");

    // Escaped quote
    expect(m.formatMessage("It''s {x}", { x: "ok" })).toBe("It's ok");
  });

  it("compile + validate + utils", async () => {
    const m = await import("@/lib/messageFormatter");

    // getPluralCategory
    expect(m.getPluralCategory(1, "en")).toBe("one");
    expect(m.getPluralCategory(0, "en")).toBe("other");
    expect(m.getPluralCategory(1, "ja")).toBe("other");
    expect(m.getPluralCategory(0, "pt")).toBe("one");

    // compileMessage
    expect(m.compileMessage("Hello").parts[0].type).toBe("literal");
    expect(m.compileMessage("{n, plural, one {#} other {#s}}").parts[0].type).toBe("plural");

    // formatCompiled
    const c = m.compileMessage("{name}!");
    expect(m.formatCompiled(c, { name: "A" })).toBe("A!");

    // validateMessage
    expect(m.validateMessage("{ok}").valid).toBe(true);
    expect(m.validateMessage("{bad").valid).toBe(false);

    // checkMissingParams
    const c2 = m.compileMessage("{a} {b}");
    expect(m.checkMissingParams(c2, { a: "x" })).toEqual(["b"]);

    // extractParams
    expect(m.extractParams("{a} {b}")).toEqual(["a", "b"]);

    // createLocaleFormatter
    const ja = m.createLocaleFormatter("ja");
    expect(ja("{n, plural, other {#個}}", { n: 3 })).toBe("3個");

    // buildMessageDiagnostic
    const d = m.buildMessageDiagnostic("{n, plural, one {#} other {#s}}");
    expect(d.hasPluralRules).toBe(true);
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("formatMessage");
    expect(idx).toContain("getMessagePluralCategory");
  });
});
