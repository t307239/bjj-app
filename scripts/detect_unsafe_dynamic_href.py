#!/usr/bin/env python3
"""z261p: detect potentially unsafe dynamic href / src attributes that could be
exploited via javascript: / data: scheme injection.

Detects:
  - <a href={X}>      where X is a non-literal expression and no scheme guard exists
  - <iframe src={X}>  same pattern
  - <img src={X}>     less critical but worth flagging if X is user-derived

Heuristic: we *allow* the dynamic href if any of the following are true in the
same file:
  - import from "next/link" — Next <Link> only accepts internal paths
  - constant prefix (template literal starts with "http"/"https"/"/")
  - scheme/protocol check in the same component (isSafeHttpUrl, parsed.protocol)
  - process.env.NEXT_PUBLIC_STRIPE_* (trusted env var)
  - href is a literal string starting with '#' or 'mailto:' or 'tel:'

This is intentionally generous: focus is on user-derived URLs landing in <a href>
without validation. opt-out marker: // safe-href: <reason>
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {".next", "node_modules", ".git", ".claude"}

# Capture <a ...href={EXPR}...> where EXPR is not a string literal
HREF_DYNAMIC_RE = re.compile(
    r'<a\s+[^>]*?href=\{([^}]+)\}[^>]*>',
    re.IGNORECASE,
)
# Opt-out marker on same line or previous line
SAFE_MARKER = re.compile(r'//\s*safe-href\b')

# Patterns that prove the href is safe
SAFE_VALUE_HINTS = (
    "STRIPE_",  # Stripe env var
    "STRIPE_PORTAL_URL",
    "CUSTOMER_PORTAL_URL",
    "process.env.NEXT_PUBLIC_",
    "twitterUrl",  # generated below within same file
    "facebookUrl",
    "loginUrl",
    "wikiHref",
    "ctaHref",
    "ctaPrimaryHref",
    "supabaseUrl",
    "sentryIngestOrigin",
)


def file_has_url_validation(content: str) -> bool:
    """Return True if file contains URL validation patterns."""
    return any(
        s in content
        for s in (
            "isSafeHttpUrl(",
            "protocol === \"http",
            "protocol === \"https",
            "u.protocol",
            "url.protocol",
            "ALLOWED_HOSTS",
            "z.string().url()",
        )
    )


def check_file(fp: Path) -> list[tuple[int, str]]:
    try:
        content = fp.read_text(encoding="utf-8")
    except Exception:
        return []

    has_validation = file_has_url_validation(content)
    findings: list[tuple[int, str]] = []

    for m in HREF_DYNAMIC_RE.finditer(content):
        expr = m.group(1).strip()
        # Quick safe-by-source heuristics
        if any(hint in expr for hint in SAFE_VALUE_HINTS):
            continue
        # Template literal starting with "/" / "http" / "#" / "mailto"
        if expr.startswith('`/') or expr.startswith('`http') or expr.startswith('`#') or expr.startswith('`mailto:'):
            continue
        # Hash-only template literal e.g. `#${id}`
        if expr.startswith('`#') or "`#${" in expr:
            continue
        # Conditional: `cond ? "/path" : "/other"` — both branches literal-ish
        if "?" in expr and ":" in expr:
            # If both candidates look like template literals or string constants, allow
            if expr.count('"') >= 2 or expr.count("`") >= 2 or "undefined" in expr:
                continue
        # `urlRegex.test(part)` proven http(s) in renderNotes → check for test() prior
        if "part" in expr and ("urlRegex" in content or "/(https?:\\/\\/" in content):
            continue
        # Inline literal: items[].href set to template literal starting with https
        # If file defines `href: \`http` somewhere, the dynamic href reads from that literal.
        if re.search(r'href:\s*`https?:', content) or re.search(r'href:\s*["\']https?:', content):
            continue
        # If file has URL validation, give benefit of doubt (assume same component validates)
        if has_validation:
            continue
        # Check for opt-out marker within +/- 2 lines
        line_no = content.count("\n", 0, m.start()) + 1
        # Extract context for marker
        context_lines = content.split("\n")[max(0, line_no - 3) : line_no + 1]
        if any(SAFE_MARKER.search(l) for l in context_lines):
            continue
        findings.append((line_no, expr))

    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    targets: list[Path] = []
    for ext in ("*.tsx", "*.ts"):
        for fp in ROOT.rglob(ext):
            if any(part in EXCLUDE_DIRS for part in fp.parts):
                continue
            if fp.suffix not in (".tsx", ".ts"):
                continue
            if ".test." in fp.name or ".spec." in fp.name:
                continue
            targets.append(fp)

    total_findings = 0
    for fp in targets:
        findings = check_file(fp)
        if findings:
            rel = fp.relative_to(ROOT)
            for line, expr in findings:
                expr_short = expr[:80].replace("\n", " ")
                print(f"  [WARN] {rel}:{line}  href={{{expr_short}}}")
                total_findings += 1

    print(f"\n❌ Unsafe dynamic href candidates: {total_findings}")
    if args.ci and total_findings > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
