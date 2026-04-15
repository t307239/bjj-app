/**
 * Q-19: Unit tests for validation.ts (Zod-based API validation helpers).
 */
import { describe, it, expect } from "vitest";
import { parseBody } from "@/lib/validation";
import { z } from "zod";

// ─── Helper to create mock Request ──────────────────────────────────────────
function mockRequest(body: unknown): Request {
  return new Request("https://example.com/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function invalidJsonRequest(): Request {
  return new Request("https://example.com/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not valid json{{{",
  });
}

const TestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

describe("parseBody", () => {
  it("returns parsed data for valid input", async () => {
    const req = mockRequest({ name: "Toshiki", age: 30 });
    const result = await parseBody(req, TestSchema);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: "Toshiki", age: 30 });
  });

  it("returns parsed data with optional field", async () => {
    const req = mockRequest({ name: "Toshiki", age: 30, email: "test@example.com" });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toEqual({ name: "Toshiki", age: 30, email: "test@example.com" });
  });

  it("returns error for invalid JSON body", async () => {
    const req = invalidJsonRequest();
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    // Check status is 400
    const errorResponse = result.error!;
    expect(errorResponse.status).toBe(400);
    const body = await errorResponse.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns validation error for missing required field", async () => {
    const req = mockRequest({ name: "Toshiki" }); // missing 'age'
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("returns validation error for wrong type", async () => {
    const req = mockRequest({ name: "Toshiki", age: "not-a-number" });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    const body = await result.error!.json();
    expect(body.issues.some((i: { path: string }) => i.path === "age")).toBe(true);
  });

  it("returns validation error for invalid email format", async () => {
    const req = mockRequest({ name: "Toshiki", age: 30, email: "not-email" });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    const body = await result.error!.json();
    expect(body.issues.some((i: { path: string }) => i.path === "email")).toBe(true);
  });

  it("strips unknown fields (Zod strip mode)", async () => {
    const req = mockRequest({ name: "Toshiki", age: 30, hackField: "evil" });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toEqual({ name: "Toshiki", age: 30 });
    expect((result.data as Record<string, unknown>)["hackField"]).toBeUndefined();
  });

  it("returns error for empty name", async () => {
    const req = mockRequest({ name: "", age: 30 });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  it("returns error for negative age", async () => {
    const req = mockRequest({ name: "Toshiki", age: -5 });
    const result = await parseBody(req, TestSchema);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});
