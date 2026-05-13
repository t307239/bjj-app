#!/usr/bin/env python3
"""
detect_unsafe_localstorage_setitem.py — z261b: unwrapped localStorage.setItem audit.

Why:
  `localStorage.setItem(key, value)` can throw in production:
    - QuotaExceededError (Safari private mode is hard-capped at 0 bytes, mobile
      browsers will throw after a few MB of cumulative writes)
    - SecurityError (sandboxed iframes / third-party cookie blockers)
    - SSR (`localStorage` is undefined)

  A bare call surfaces the failure as an uncaught exception in the click
  handler / render — the user thinks they dismissed the banner / saved the
  draft but the next session re-shows it. Classic silent-fail UX bug.

  CLAUDE.md rule -4.5: 5 件超の同種作業は script 化必須 → 11 unguarded
  callsites を `safeSetItem` ヘルパーに集約してから、CI で恒久 block する。

Detects:
  client component / hook 内で `localStorage.setItem(...)` を直接呼んでおり:
    - 同一行に `try { ... } catch` で囲まれていない
    - 同じ scope (関数 body) に `try {` が直前にあり対応する `} catch` がまだ
      無い、状態でもない
  ケース。

Exempt:
  - import path `@/lib/safeLocalStorage` を含む file (helper 自体)
  - safeSetItem / safeRemoveItem の呼び出し
  - test / e2e file (`__tests__`, `.test.`, `e2e/`)
  - `.claude/worktrees/` (parallel session の old code)

Usage:
  python3 scripts/detect_unsafe_localstorage_setitem.py [--ci]

Exit code:
  --ci 指定時: hit > 0 で exit 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks", "lib"]
SCAN_EXTS = (".ts", ".tsx")

EXCLUDE_FRAGMENTS = (
    "/__tests__/",
    "/.next/",
    "/node_modules/",
    "/.claude/worktrees/",
    ".test.",
    ".spec.",
    "/e2e/",
    "/safeLocalStorage.",  # the helper itself
)

# Match localStorage.setItem and also window.localStorage.setItem
SETITEM_RE = re.compile(
    r"(?<!\.safe)(?<!\w)localStorage\.setItem\s*\(",
)


def is_in_try_catch_scope(text: str, idx: int) -> bool:
    """
    Heuristic: walk backwards from idx, track brace depth, look for `try {`
    whose `}` has not yet been closed (i.e. we are inside its body, and a
    `} catch` clause exists for it).

    Returns True iff the setItem call is wrapped in try/catch.
    """
    # Look at the same line first: inline `try { ... } catch` pattern.
    line_start = text.rfind("\n", 0, idx) + 1
    line_end = text.find("\n", idx)
    if line_end == -1:
        line_end = len(text)
    line = text[line_start:line_end]
    if "try" in line and "catch" in line:
        return True

    # Multi-line walk: look back up to 2000 chars, find nearest `try {` that
    # has not been closed by `}` before idx; also confirm there's a matching
    # `} catch (...)`/`} catch {` after the relevant `}`.
    scope_start = max(0, idx - 2000)
    scope = text[scope_start:idx]

    # Find all `try {` and `} catch` boundaries in scope
    try_positions = [m.start() for m in re.finditer(r"\btry\s*\{", scope)]
    catch_positions = [m.start() for m in re.finditer(r"\}\s*catch\b", scope)]

    if not try_positions:
        return False
    # Latest try block that has NOT yet been matched by a catch in scope
    last_try = try_positions[-1]
    last_catch = catch_positions[-1] if catch_positions else -1

    # If a catch came after our latest try, then the try block has been closed
    # already (we're outside it). Otherwise we're inside it.
    if last_catch > last_try:
        return False

    # We're inside an open try block — assume the matching } catch comes after
    # idx (caller will close it). That's the safe pattern.
    return True


def is_client_or_hook(path: Path, content: str) -> bool:
    sp = str(path)
    if "/hooks/" in sp:
        return True
    if path.suffix == ".tsx":
        return True
    head = content[:300]
    return '"use client"' in head or "'use client'" in head


def scan_file(path: Path) -> list[dict]:
    hits = []
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return hits

    # Skip files that import the helper - they should be using safeSetItem
    # but bare callsites still need to be flagged.
    # We don't exempt the whole file just because it imports the helper.

    # Only scan client / hook code
    if not is_client_or_hook(path, content):
        return hits

    for m in SETITEM_RE.finditer(content):
        idx = m.start()
        if is_in_try_catch_scope(content, idx):
            continue
        line_no = content[:idx].count("\n") + 1
        line_start = content.rfind("\n", 0, idx) + 1
        line_end = content.find("\n", idx)
        if line_end == -1:
            line_end = len(content)
        line = content[line_start:line_end].strip()
        hits.append({
            "file": str(path.relative_to(REPO_ROOT)),
            "line": line_no,
            "snippet": line[:120],
        })
    return hits


def main() -> int:
    ci_mode = "--ci" in sys.argv

    all_hits: list[dict] = []
    for d in SCAN_DIRS:
        root = REPO_ROOT / d
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix not in SCAN_EXTS:
                continue
            sp = str(p)
            if any(frag in sp for frag in EXCLUDE_FRAGMENTS):
                continue
            all_hits.extend(scan_file(p))

    print(f"→ scanning client components / hooks for unguarded localStorage.setItem...")
    print()

    if not all_hits:
        print(f"✅ detect_unsafe_localstorage_setitem: 0 hits — all setItem calls use safeSetItem or try/catch.")
        return 0

    print(f"❌ detect_unsafe_localstorage_setitem: {len(all_hits)} unguarded callsite(s):\n")
    for h in all_hits:
        print(f"  {h['file']}:{h['line']}")
        print(f"    → {h['snippet']}")
    print()
    print("💡 Replace with `safeSetItem(key, value)` from '@/lib/safeLocalStorage'.")
    print("   Helper handles QuotaExceededError + SSR + private mode without throwing.")

    if ci_mode:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
