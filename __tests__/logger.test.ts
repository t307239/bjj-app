/**
 * Q-28: Unit tests for structured logger + Sentry integration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Sentry before importing logger
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it("logger.info writes JSON to console.log", () => {
    logger.info("test.event", { userId: "abc" });
    expect(console.log).toHaveBeenCalledOnce();
    const line = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("test.event");
    expect(parsed.level).toBe("info");
    expect(parsed.userId).toBe("abc");
    expect(parsed.ts).toBeDefined();
  });

  it("logger.debug writes to console.debug", () => {
    logger.debug("debug.event");
    expect(console.debug).toHaveBeenCalledOnce();
  });

  it("logger.warn writes to console.warn and forwards to Sentry", () => {
    logger.warn("warn.event", { detail: "test" });
    expect(console.warn).toHaveBeenCalledOnce();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[warn.event] warning",
      expect.objectContaining({
        level: "warning",
        tags: { event: "warn.event" },
        extra: { detail: "test" },
      })
    );
  });

  it("logger.error with Error object sends to Sentry.captureException", () => {
    const err = new Error("test error");
    logger.error("api.crash", { route: "/test" }, err);
    expect(console.error).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: { event: "api.crash" },
        extra: { route: "/test" },
      })
    );
  });

  it("logger.error with string error sends to Sentry.captureMessage", () => {
    logger.error("api.fail", { route: "/x" }, "timeout");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[api.fail] timeout",
      expect.objectContaining({
        level: "error",
        tags: { event: "api.fail" },
      })
    );
  });

  it("logger.error without error arg sends unknown error to Sentry", () => {
    logger.error("api.unknown", {});
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[api.unknown] unknown error",
      expect.objectContaining({ level: "error" })
    );
  });

  it("logger.info does NOT forward to Sentry", () => {
    logger.info("just.info");
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("error entry includes error details in JSON", () => {
    const err = new Error("boom");
    logger.error("crash", {}, err);
    const line = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.error.message).toBe("boom");
    expect(parsed.error.name).toBe("Error");
  });
});
