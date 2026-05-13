/**
 * safeLocalStorage.test.ts — z261b
 *
 * Verify safeSetItem / safeGetItem / safeRemoveItem behave correctly
 * across happy-path, quota-exceeded, and SSR-like scenarios.
 *
 * Runs in node environment — we mock window.localStorage manually since
 * the test config doesn't bundle jsdom/happy-dom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// clientLogger is imported by safeLocalStorage; stub it so warn() doesn't
// reach Sentry in tests.
vi.mock("@/lib/clientLogger", () => ({
  clientLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
} from "@/lib/safeLocalStorage";
import { clientLogger } from "@/lib/clientLogger";

type StorageStub = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
};

function makeStorage(): StorageStub {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

const originalWindow = (globalThis as { window?: unknown }).window;

function installWindow(storage: StorageStub) {
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

function removeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

describe("safeLocalStorage", () => {
  let storage: StorageStub;

  beforeEach(() => {
    storage = makeStorage();
    installWindow(storage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      removeWindow();
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    vi.restoreAllMocks();
  });

  describe("safeSetItem", () => {
    it("stores a value and returns true on success", () => {
      const ok = safeSetItem("k", "v");
      expect(ok).toBe(true);
      expect(storage.getItem("k")).toBe("v");
    });

    it("returns false and logs when underlying setItem throws (quota)", () => {
      storage.setItem = () => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      };
      const ok = safeSetItem("k", "v");
      expect(ok).toBe(false);
      expect(clientLogger.warn).toHaveBeenCalledWith(
        "localstorage.setitem_failed",
        expect.objectContaining({ key: "k", name: "QuotaExceededError" }),
      );
    });

    it("returns false on SSR (no window)", () => {
      removeWindow();
      const ok = safeSetItem("k", "v");
      expect(ok).toBe(false);
    });
  });

  describe("safeGetItem", () => {
    it("returns the stored value", () => {
      storage.setItem("k", "v");
      expect(safeGetItem("k")).toBe("v");
    });

    it("returns null when key is absent", () => {
      expect(safeGetItem("missing")).toBeNull();
    });

    it("returns null on SSR (no window)", () => {
      removeWindow();
      expect(safeGetItem("k")).toBeNull();
    });

    it("returns null when underlying getItem throws", () => {
      storage.getItem = () => {
        throw new Error("SecurityError");
      };
      expect(safeGetItem("k")).toBeNull();
    });
  });

  describe("safeRemoveItem", () => {
    it("removes a stored value and returns true", () => {
      storage.setItem("k", "v");
      const ok = safeRemoveItem("k");
      expect(ok).toBe(true);
      expect(storage.getItem("k")).toBeNull();
    });

    it("returns false on SSR", () => {
      removeWindow();
      expect(safeRemoveItem("k")).toBe(false);
    });

    it("returns false and logs when removeItem throws", () => {
      storage.removeItem = () => {
        throw new Error("boom");
      };
      const ok = safeRemoveItem("k");
      expect(ok).toBe(false);
      expect(clientLogger.warn).toHaveBeenCalled();
    });
  });
});
