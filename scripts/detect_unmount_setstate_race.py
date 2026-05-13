#!/usr/bin/env python3
"""
detect_unmount_setstate_race.py — z260y / z261c (per-region precision).

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

What this lint detects (z261c upgrade):
  PER `useEffect(...)` REGION:
    - find `await Promise.all(` inside the region
    - find any `setXxx(` AFTER the Promise.all
    - check whether the region body (NOT the whole file) contains any guard:
        `if (!mounted)` / `mountedRef.current` / `cancelled`
        `let mounted = true` / `let cancelled = false`
        mountedRef from `useRef(true)`
  If any region lacks guard, flag it. This catches mixed files where one
  useEffect has guard but another doesn't — the previous file-level check
  would silently pass.

Scope:
  app/, components/, hooks/ — client/.tsx/.ts only (api/ excluded).

Exclusions:
  - api/ route handlers (no React lifecycle)
  - test / spec / .worktrees files
  - files explicitly marked `// race-guard: not-needed` (whole file)
  - regions explicitly marked `// race-guard: not-needed` inside region body

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
    r"useRef\s*<[^>]*>\s*\(\s*true\s*\)",  # const mountedRef = useRef<boolean>(true)
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
        return bool(re.search(r"\buse(State|Effect|Callback|Memo|Ref)\b", content))
    return False


def find_matching_brace(text: str, open_idx: int) -> int:
    """
    Given text[open_idx] == '{', return the index of the matching '}'.
    Returns -1 if unbalanced. Handles string/template literals + line comments
    + block comments to avoid mismatch in nested braces.
    """
    depth = 0
    i = open_idx
    n = len(text)
    while i < n:
        c = text[i]
        # Skip line comments
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            nl = text.find("\n", i)
            if nl == -1:
                return -1
            i = nl + 1
            continue
        # Skip block comments
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            if end == -1:
                return -1
            i = end + 2
            continue
        # Skip strings (single/double quote)
        if c in ("'", '"'):
            quote = c
            i += 1
            while i < n and text[i] != quote:
                if text[i] == "\\":
                    i += 2
                else:
                    i += 1
            i += 1
            continue
        # Skip template literals (track backtick + ${...} nesting)
        if c == "`":
            i += 1
            while i < n and text[i] != "`":
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "$" and i + 1 < n and text[i + 1] == "{":
                    sub = find_matching_brace(text, i + 1)
                    if sub == -1:
                        return -1
                    i = sub + 1
                    continue
                i += 1
            i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def extract_useeffect_regions(content: str) -> list[tuple[int, str]]:
    """
    Return list of (start_offset, region_body) for each useEffect(...) call.
    region_body is the source code BETWEEN the outer `useEffect(` ... `)` parens.
    """
    regions = []
    for m in re.finditer(r"\buseEffect\s*\(", content):
        paren_start = m.end() - 1  # position of '('
        depth = 0
        i = paren_start
        n = len(content)
        # Walk forward to find matching ')' for this useEffect call
        while i < n:
            c = content[i]
            if c in ("'", '"'):
                quote = c
                i += 1
                while i < n and content[i] != quote:
                    if content[i] == "\\":
                        i += 2
                    else:
                        i += 1
                i += 1
                continue
            if c == "`":
                i += 1
                while i < n and content[i] != "`":
                    if content[i] == "\\":
                        i += 2
                        continue
                    if content[i] == "$" and i + 1 < n and content[i + 1] == "{":
                        # nested ${ ... }
                        sub_end = find_matching_brace(content, i + 1)
                        if sub_end == -1:
                            break
                        i = sub_end + 1
                        continue
                    i += 1
                i += 1
                continue
            if c == "/" and i + 1 < n and content[i + 1] == "/":
                nl = content.find("\n", i)
                if nl == -1:
                    break
                i = nl + 1
                continue
            if c == "/" and i + 1 < n and content[i + 1] == "*":
                end = content.find("*/", i + 2)
                if end == -1:
                    break
                i = end + 2
                continue
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    body = content[paren_start + 1:i]
                    regions.append((m.start(), body))
                    break
            i += 1
    return regions


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    if not is_client_file(path, content):
        return []
    if OPT_OUT_MARKER in content[:400]:
        # File-level opt-out at top of file
        return []

    findings: list[tuple[int, str, str]] = []
    regions = extract_useeffect_regions(content)
    for region_start, body in regions:
        if OPT_OUT_MARKER in body:
            continue
        # Find `await Promise.all(` inside the region
        promise_match = re.search(r"await\s+Promise\.all\s*\(", body)
        if not promise_match:
            continue
        # Find any setState call AFTER the Promise.all
        after = body[promise_match.end():]
        setstate_match = re.search(r"\bset[A-Z][A-Za-z0-9_]*\s*\(", after)
        if not setstate_match:
            continue
        # Check whether the region body contains a guard
        if GUARD_RE.search(body):
            continue
        # Compute line number in the full file (1-based)
        offset_in_file = region_start + promise_match.start()
        line_no = content[:offset_in_file].count("\n") + 1
        set_name = setstate_match.group(0).rstrip("(").strip()
        findings.append((line_no, set_name, "useEffect"))

    return findings


def main() -> int:
    ci = "--ci" in sys.argv
    total = 0
    files_with_hits = 0
    print("→ scanning for `await Promise.all(...)` + setState without mounted guard (per-region)...")
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
            for line_no, set_name, region in findings:
                print(f"  🔴 {rel}:{line_no}  {region}: await Promise.all + {set_name}() — region missing mounted guard")
                total += 1
    print()
    if total == 0:
        print("✅ detect_unmount_setstate_race: 0 hits — all Promise.all regions have mounted guard.")
        return 0
    print(f"🔴 detect_unmount_setstate_race: {total} hit(s) across {files_with_hits} file(s).")
    print("   Fix: useEffect(() => { let mounted = true; (async () => {")
    print("          const [a,b] = await Promise.all([...]);")
    print("          if (!mounted) return; setX(a);")
    print("        })(); return () => { mounted = false; }; }, [deps]);")
    print("   Or:  use a mountedRef pattern (see components/PushNotificationSection.tsx)")
    print("   Opt-out: add `// race-guard: not-needed` inside the useEffect body or at top of file.")
    return 1 if ci else 0


if __name__ == "__main__":
    sys.exit(main())
