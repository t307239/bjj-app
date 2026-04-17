/**
 * Tests for Q-165: messageFormatter (i18n 93→94)
 */
import { describe, it, expect } from "vitest";
import {
  formatMessage,
  formatCompiled,
  compileMessage,
  validateMessage,
  checkMissingParams,
  extractParams,
  createLocaleFormatter,
  buildMessageDiagnostic,
  getPluralCategory,
} from "@/lib/messageFormatter";

describe("Q-165: messageFormatter", () => {
  it("getPluralCategory: EN/JA/PT", () => {
    expect(getPluralCategory(1, "en")).toBe("one");
    expect(getPluralCategory(0, "en")).toBe("other");
    expect(getPluralCategory(1, "ja")).toBe("other");
    expect(getPluralCategory(0, "pt")).toBe("one");
    expect(getPluralCategory(2, "pt")).toBe("other");
  });

  it("compileMessage: types", () => {
    expect(compileMessage("Hello").parts[0].type).toBe("literal");
    expect(compileMessage("{name}").requiredParams).toContain("name");
    expect(compileMessage("{n, plural, one {#} other {#s}}").parts[0].type).toBe("plural");
    expect(compileMessage("{x, select, a {A} other {B}}").parts[0].type).toBe("select");
  });

  it("formatMessage: simple", () => {
    expect(formatMessage("Hello, {name}!", { name: "T" })).toBe("Hello, T!");
    expect(formatMessage("{a}+{b}", { a: "X", b: "Y" })).toBe("X+Y");
    expect(formatMessage("{missing}")).toBe("{missing}");
    expect(formatMessage("N:{n}", { n: 42 })).toBe("N:42");
  });

  it("formatMessage: plural", () => {
    const t = "{count, plural, one {# item} other {# items}}";
    expect(formatMessage(t, { count: 1 }, "en")).toBe("1 item");
    expect(formatMessage(t, { count: 5 }, "en")).toBe("5 items");
  });

  it("formatMessage: plural =0 and offset", () => {
    expect(formatMessage("{n, plural, =0 {zero} other {#}}", { n: 0 })).toBe("zero");
    expect(formatMessage("{n, plural, offset:1 one {# more} other {# more}}", { n: 3 })).toBe("2 more");
  });

  it("formatMessage: select", () => {
    expect(formatMessage("{x, select, a {AAA} other {BBB}}", { x: "a" })).toBe("AAA");
    expect(formatMessage("{x, select, a {AAA} other {BBB}}", { x: "z" })).toBe("BBB");
  });

  it("formatCompiled: reuse", () => {
    const c = compileMessage("{name}!");
    expect(formatCompiled(c, { name: "A" })).toBe("A!");
    expect(formatCompiled(c, { name: "B" })).toBe("B!");
  });

  it("escaped quotes", () => {
    expect(formatMessage("It''s {x}", { x: "ok" })).toBe("It's ok");
  });

  it("validateMessage", () => {
    expect(validateMessage("{name}").valid).toBe(true);
    expect(validateMessage("{name").valid).toBe(false);
    expect(validateMessage("{n, plural, one {#}}").errors.length).toBeGreaterThan(0);
  });

  it("checkMissingParams + extractParams", () => {
    const c = compileMessage("{a} {b}");
    expect(checkMissingParams(c, { a: "x" })).toEqual(["b"]);
    expect(extractParams("{a} {b}")).toEqual(["a", "b"]);
  });

  it("createLocaleFormatter + buildMessageDiagnostic", () => {
    const ja = createLocaleFormatter("ja");
    expect(ja("{n, plural, other {#個}}", { n: 3 })).toBe("3個");
    const d = buildMessageDiagnostic("{n, plural, one {#} other {#s}}");
    expect(d.hasPluralRules).toBe(true);
    expect(d.validation.valid).toBe(true);
  });

  it("barrel export", async () => {
    const fs = await import("fs");
    const idx = fs.readFileSync(new URL("../lib/index.ts", import.meta.url), "utf-8");
    expect(idx).toContain("formatMessage");
    expect(idx).toContain("getMessagePluralCategory");
  });
});
