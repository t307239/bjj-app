/**
 * lib/strictIndexAccess.ts — Safe indexed access helpers
 *
 * Q-231: DX pillar — provides explicit safe access for arrays, objects,
 * and Maps to mitigate `noUncheckedIndexedAccess` without enabling
 * it globally. Eliminates runtime undefined crashes from unguarded
 * bracket notation.
 *
 * Pure utility layer — no DB access, no UI.
 *
 * @example
 *   import { safeGet, assertGet, isNonEmpty } from "@/lib/strictIndexAccess";
 *   const val = safeGet(items, 3); // T | undefined
 *   const first = assertGet(items, 0, "items must not be empty");
 *   if (isNonEmpty(arr)) { const head = arr[0]; } // head: T
 */

// ── Array Access ─────────────────────────────────────────────────────────

/** Explicit safe array access — returns undefined if out of bounds */
export function safeGet<T>(arr: readonly T[], index: number): T | undefined {
  if (index < 0 || index >= arr.length) return undefined;
  return arr[index];
}

/** Safe first element */
export function safeFirst<T>(arr: readonly T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined;
}

/** Safe last element */
export function safeLast<T>(arr: readonly T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/** Throws if index is out of bounds */
export function assertGet<T>(
  arr: readonly T[],
  index: number,
  message?: string,
): T {
  if (index < 0 || index >= arr.length) {
    throw new RangeError(
      message ?? `Index ${index} out of bounds (length: ${arr.length})`,
    );
  }
  return arr[index] as T;
}

/** Throws if array is empty, returns first element */
export function assertFirst<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new RangeError("assertFirst called on empty array");
  }
  return arr[0] as T;
}

/** Returns element at index or a fallback default */
export function getOrDefault<T>(
  arr: readonly T[],
  index: number,
  defaultValue: T,
): T {
  if (index < 0 || index >= arr.length) return defaultValue;
  return arr[index] as T;
}

// ── Object / Record Access ───────────────────────────────────────────────

/** Safe record access — makes the possible `undefined` explicit */
export function safeObjectGet<T>(
  obj: Record<string, T>,
  key: string,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key)
    ? obj[key]
    : undefined;
}

/** Filter out undefined values from a Partial record, returning typed entries */
export function safeEntries<K extends string, V>(
  obj: Partial<Record<K, V>>,
): Array<[K, V]> {
  return (Object.entries(obj) as Array<[K, V | undefined]>).filter(
    (entry): entry is [K, V] => entry[1] !== undefined,
  );
}

// ── Map Access ───────────────────────────────────────────────────────────

/** Explicit Map.get — identical to Map.get but signals intent in reviews */
export function safeMapGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  return map.get(key);
}

// ── Find ─────────────────────────────────────────────────────────────────

/** Explicit find — identical to Array.find but signals safe-access intent */
export function safeFind<T>(
  arr: readonly T[],
  predicate: (item: T) => boolean,
): T | undefined {
  return arr.find(predicate);
}

// ── Type Guards ──────────────────────────────────────────────────────────

/** Type guard: narrows T[] to [T, ...T[]] (non-empty tuple) */
export function isNonEmpty<T>(arr: readonly T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

// ── Result Pattern ───────────────────────────────────────────────────────

/** Result-type pattern for indexed access */
export function narrowIndex<T>(
  arr: readonly T[],
  index: number,
): { value: T; valid: true } | { value: undefined; valid: false } {
  if (index < 0 || index >= arr.length) {
    return { value: undefined, valid: false };
  }
  return { value: arr[index] as T, valid: true };
}

// ── Audit / Reporting ────────────────────────────────────────────────────

/** Build a report on safe vs unsafe indexed access usage */
export function buildStrictAccessReport(
  fileCount: number,
  unsafeAccessCount: number,
  safeAccessCount: number,
): {
  fileCount: number;
  unsafeAccessCount: number;
  safeAccessCount: number;
  safeRatio: number;
  grade: "A" | "B" | "C" | "D" | "F";
} {
  const total = unsafeAccessCount + safeAccessCount;
  const safeRatio = total > 0 ? safeAccessCount / total : 1;

  let grade: "A" | "B" | "C" | "D" | "F";
  if (safeRatio >= 0.95) grade = "A";
  else if (safeRatio >= 0.8) grade = "B";
  else if (safeRatio >= 0.6) grade = "C";
  else if (safeRatio >= 0.4) grade = "D";
  else grade = "F";

  return { fileCount, unsafeAccessCount, safeAccessCount, safeRatio, grade };
}

// ── Migration Guide ──────────────────────────────────────────────────────

/** Documentation string for gradual adoption of strict index access */
export const MIGRATION_GUIDE = `
=== Strict Index Access Migration Guide ===

1. Replace bare bracket access with safeGet():
   BEFORE: const val = arr[i];
   AFTER:  const val = safeGet(arr, i);

2. Use assertGet() when the index MUST be valid:
   const val = assertGet(arr, 0, "Expected at least one item");

3. Use isNonEmpty() for conditional first-access:
   if (isNonEmpty(items)) { const first = items[0]; }

4. Use narrowIndex() for result-pattern:
   const result = narrowIndex(arr, i);
   if (result.valid) { use(result.value); }

5. Use safeEntries() for Partial<Record<K, V>> iteration:
   for (const [key, val] of safeEntries(partialObj)) { ... }

Tip: Run buildStrictAccessReport() to track migration progress.
` as const;
