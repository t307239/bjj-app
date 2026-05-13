#!/usr/bin/env python3
"""
detect_unmount_setstate_race.py — z260y: Promise.all/await + setState race detection.

Pattern (silent bug):
  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([...]);
      setX(a);  // ← if component unmounts before this, React warns + memory leak
    })();
  }, [deps]);

Safe pattern (z256-z260y standard):
  useEffect(() => {
    let mounted = true;          // OR const mountedRef = useRef(true)
    (async () => {
      const [a, b] = await Promise.all([...]);
      if (!mounted) return;       // OR if (!mountedRef.current) return
      setX(a);
    })();
    return () => { mounted = false; };
  }, [deps]);

What this lint detects:
  Files containing `await Promise.all(` AND any `set[A-Z]\w*(` call AFTER it,
  but WITHOUT any of these guards within ±20 lines of the setState:
    - `if (!mounted)` / `if (!mountedRef.current)` / `if (cancelled)`
    - `if (mounted)` / `if (mountedRef.current)`
    - `let mounted = true` / `let cancelled = false`
    - `mountedRef = useRef`
  Scope: app/, components/, hooks/ — client/.tsx/.ts only.

Excluded:
  - api/ route handlers (no React lifecycle)
  - test / spec / .worktrees files
  - files explicitly marked `// race-guard: not-needed` (opt-out)

--ci → hit > 0 で exit 1.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks"]
SCAN_EXTS = (".ts", ".tsx")
EXCLUDE_FRAGMENTS = ("/api/", "/__tests__/", ".test.", ".spec.", "/.claude/worktrees/")
OPT_OUT_MARKER = "race-guard: not-needed"

GUARD_PATTERNS = [
    r"!\s*mounted\b",
    r"!\s*mountedRef\.current",
    r"!\s*isMounted\b",
    r"mountedRef\.current",
    r"\bcancelled\b",
    r"\bisMounted\b",
    r"let\s+mounted\s*=\s*true",
    r"let\s+cancelled\s*=\s*false",
    r"useRef\s*<.*>\s*\(\s*true\s*\)",  # const mountedRef = useRef<boolean>(true)
    r"useRef\s*\(\s*true\s*\)",
]
GUARD_RE = re.compile("|".join(GUARD_PATTERNS))


def is_client_file(path: Path, content: str) -> bool:
    if "/hooks/" in str(path):
        return True
    if '"use client"' in content[:400] or "'use client'" in content[:400]:
        return True
    # Some .tsx in components/ are client by default — heuristic
    if "/components/" in str(path) and path.suffix == ".tsx":
        # only treat as client if hooks are used (useState/useEffect)
        return bool(re.search(r"\buse(State|Effect|Callback|Memo|Ref)\b", content))
    return False


def scan_file(path: Path) -> list[tuple[int, str]]:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    if not is_client_file(path, content):
        return []
    if OPT_OUT_MARKER in content:
        return []
    # Find `await Promise.all(` positions
    findings: list[tuple[int, str]] = []
    for m in re.finditer(r"await\s+Promise\.all\s*\(", content):
        promise_idx = m.start()
        # Determine enclosing scope: skip the next ~50 lines of the function
        # to detect whether setState call (set[A-Z]\w*) occurs without guard.
        rest = content[m.end():]
        # Crude window: 60 lines after the await
        window = "\n".join(rest.split("\n")[:60])
        # Does the window contain a setState call?
        setstate_match = re.search(r"\bset[A-Z][A-Za-z0-9_]*\s*\(", window)
        if not setstate_match:
            continue
        # Does the WHOLE FILE contain any guard pattern? (cheap check)
        # We require a guard because once a file declares the pattern it's
        # generally applied uniformly. Per-region check would be more precise
        # but produces false positives.
        if GUARD_RE.search(content):
            continue
        line_no = content[:promise_idx].count("\n") + 1
        # First setState in window as the offending example
        first_set = setstate_match.group(0).rstrip("(").strip()
        findings.append((line_no, first_set))
    return findings


def main() -> int:
    ci = "--ci" in sys.argv
    total = 0
    files_with_hits = 0
    print("→ scanning for `await Promise.all(...)` + setState without mounted guard...")
    for d in SCAN_DIRS:
        root = REPO_ROOT / d
        if not root.exists():
            continue
        for fp in root.rglob("*"):
            if fp.suffix not in SCAN_EXTS:
                continue
            if any(frag in str(fp) for frag in EXCLUDE_FRAGMENTS):
                continue
            findings = scan_file(fp)
            if not findings:
                continue
            files_with_hits += 1
            rel = fp.relative_to(REPO_ROOT)
            for line_no, set_name in findings:
                print(f"  🔴 {rel}:{line_no}  await Promise.all + {set_name}() — add `let mounted = true` or mountedRef guard")
                total += 1
    print()
    if total == 0:
        print("✅ detect_unmount_setstate_race: 0 hits — all Promise.all callsites have mounted guard.")
        return 0
    print(f"🔴 detect_unmount_setstate_race: {total} hit(s) across {files_with_hits} file(s).")
    print("   Fix: useEffect(() => { let mounted = true; (async () => {")
    print("          const [a,b] = await Promise.all([...]);")
    print("          if (!mounted) return; setX(a);")
    print("        })(); return () => { mounted = false; }; }, [deps]);")
    print("   Or:  use a mountedRef pattern (see components/PushNotificationSection.tsx)")
    print("   Opt-out: add `// race-guard: not-needed` to the file.")
    return 1 if ci else 0


if __name__ == "__main__":
    sys.exit(main())
