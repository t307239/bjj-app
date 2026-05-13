#!/usr/bin/env python3
"""
detect_router_push_session_end.py — z260y: enforce router.replace over router.push
in 3 session-end / destructive contexts to prevent history pollution + back-button trap.

Categories:
  A. error.tsx files anywhere in app/ — error boundary should use router.replace
     (back button after recovery shouldn't return to broken page).
  B. signOut() / auth.signOut() followed by router.push within 5 lines —
     session-end transition; user pressing back lands on private page they can't access.
  C. router.push to "/login?reason=session_expired" — z257b: same as B.

What we accept:
  - router.replace(...) in all the above contexts
  - window.location.href = ... (full reload, no history issue)
  - location.replace(...) (explicit replace API)

Scope: app/, components/, hooks/, lib/ — exclude api/, test/, worktrees.

--ci → hit > 0 で exit 1.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks", "lib"]
SCAN_EXTS = (".ts", ".tsx")
EXCLUDE_FRAGMENTS = ("/api/", "/__tests__/", ".test.", ".spec.", "/.claude/worktrees/")


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_no, category, snippet)."""
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    findings: list[tuple[int, str, str]] = []
    lines = content.split("\n")
    is_error_tsx = path.name == "error.tsx"

    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip comments / strings inside ts
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        # Category A: error.tsx with router.push
        if is_error_tsx and re.search(r"\brouter\.push\s*\(", line):
            findings.append((i + 1, "A: error.tsx", stripped[:120]))
            continue
        # Category C: router.push to /login?reason=session_expired
        if re.search(r"router\.push\s*\(\s*[\"'`][^\"'`]*session_expired", line):
            findings.append((i + 1, "C: session_expired URL", stripped[:120]))
            continue
        # Category B: signOut nearby followed by router.push
        # Look for signOut() call, then router.push within next 5 lines
        if re.search(r"signOut\s*\(\s*\)", line):
            window = lines[i + 1 : i + 6]
            for j, w in enumerate(window):
                if re.search(r"router\.push\s*\(", w):
                    findings.append((i + 1 + j + 1, "B: post-signOut", w.strip()[:120]))
                    break
    return findings


def main() -> int:
    ci = "--ci" in sys.argv
    total = 0
    files_with_hits = 0
    print("→ scanning for router.push in session-end / error-boundary contexts...")
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
            for line_no, cat, snippet in findings:
                print(f"  🔴 {rel}:{line_no}  [{cat}]  {snippet}")
                total += 1
    print()
    if total == 0:
        print("✅ detect_router_push_session_end: 0 hits — all session-end transitions use router.replace.")
        return 0
    print(f"🔴 detect_router_push_session_end: {total} hit(s) across {files_with_hits} file(s).")
    print("   Fix: replace router.push(<url>) with router.replace(<url>) in:")
    print("        A. error.tsx onClick handlers (history pollution after recovery)")
    print("        B. lines within 5 of signOut() (back button trap to private pages)")
    print("        C. /login?reason=session_expired redirects")
    return 1 if ci else 0


if __name__ == "__main__":
    sys.exit(main())
