#!/usr/bin/env python3
"""z261r: detect over-fetch — supabase queries that use .select("*") instead of
explicit column lists.

Why:
  - .select("*") fetches every column including blobs, JSON, TEXT-heavy fields
    that are usually not needed in UI (e.g. profile bio + long markdown notes).
  - Hot-path queries on /dashboard / /records pay per-row network cost in
    seconds-of-latency on slow connections (mobile).
  - Schema migrations that add wide columns silently increase bandwidth
    without code review surface.
  - Explicit column lists also document the interface for future readers.

Rule:
  - `.select("*")` is forbidden in main repo.
  - Use explicit column lists, e.g. `.select("id, name, created_at")`.
  - Aggregations (`.select("id", { count: "exact", head: true })`) are OK
    because they do not transfer row data.

opt-out: `// select-star: ok — <reason>` on same / prev / next line.

Excluded: docstring code examples in /lib/perfMonitor.ts comments.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {".next", "node_modules", ".git", ".claude", "supabase"}

# Match: .select("*") or .select('*') possibly with whitespace.
# Negative-look: not inside a JSDoc/comment block — we filter by line context.
SELECT_STAR_RE = re.compile(r'\.select\(\s*["\']\*["\']\s*[\),]')

# Aggregation-only queries (count: "exact", head: true) do NOT transfer row data,
# so .select("*", { count: "exact", head: true }) is a Supabase idiom for counting
# and is exempt. Match if same line (or the followed-up call chain) has count config.
COUNT_AGG_RE = re.compile(r'\{\s*count\s*:\s*["\'](exact|planned|estimated)["\']\s*,\s*head\s*:\s*true\s*\}')

# opt-out marker
SAFE_MARKER = re.compile(r"//\s*select-star:\s*ok\b|/\*\s*select-star:\s*ok\b")


def is_in_comment(line: str) -> bool:
    """Best-effort: line is inside a /** ... */ doc block or starts with `* `."""
    stripped = line.lstrip()
    if stripped.startswith("*") or stripped.startswith("//") or stripped.startswith("/**") or stripped.startswith("/*"):
        return True
    return False


def check_file(fp: Path) -> list[tuple[int, str]]:
    try:
        content = fp.read_text(encoding="utf-8")
    except Exception:
        return []

    lines = content.split("\n")
    findings: list[tuple[int, str]] = []
    for i, line in enumerate(lines, start=1):
        if not SELECT_STAR_RE.search(line):
            continue
        if is_in_comment(line):
            continue
        # Aggregation-only ({ count: ..., head: true }) on same / next 2 lines: exempt.
        agg_ctx = "\n".join(lines[max(0, i - 1) : min(len(lines), i + 2)])
        if COUNT_AGG_RE.search(agg_ctx):
            continue
        # opt-out marker within ±5 lines (multi-line comment blocks allowed).
        ctx_lines = lines[max(0, i - 6) : min(len(lines), i + 2)]
        if any(SAFE_MARKER.search(l) for l in ctx_lines):
            continue
        findings.append((i, line.strip()[:120]))
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
            if ".test." in fp.name or ".spec." in fp.name:
                continue
            targets.append(fp)

    total = 0
    for fp in sorted(targets):
        findings = check_file(fp)
        if findings:
            rel = fp.relative_to(ROOT)
            for line_no, snippet in findings:
                print(f"  [WARN] {rel}:{line_no}  {snippet}")
                total += 1

    if total == 0:
        print("✅ No .select(\"*\") over-fetch found.")
    else:
        print(f"\n❌ Supabase over-fetch via .select(\"*\"): {total}")
        print('   Use explicit column list: .select("col1, col2, ...")')
        print('   Or opt out with: // select-star: ok — <reason>')

    if args.ci and total > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
