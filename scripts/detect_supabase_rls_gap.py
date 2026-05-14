#!/usr/bin/env python3
"""z261p: detect potential RLS gaps — supabase mutations on user-scoped tables
that don't include explicit owner filter (defence-in-depth audit).

RLS in Supabase usually enforces user_id = auth.uid() at the row level, but
relying on it alone is fragile:
  - migration mistakes can drop a policy
  - service_role bypasses RLS entirely
  - a typo in `id` vs `user_id` filter on delete/update may pass linting

This lint flags any `.delete()` / `.update()` on a known user-scoped table
that does NOT also have `.eq("user_id", ...)` in the same statement.

opt-out: // rls-ok: <reason>
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {".next", "node_modules", ".git", ".claude"}

# Tables whose rows are scoped to a single user (user_id column)
USER_SCOPED_TABLES = {
    "training_logs",
    "techniques",
    "weight_logs",
    "belt_history",
    "technique_nodes",
    "technique_edges",
    "achievements",
    "user_milestones",
    "push_subscriptions",  # user_id-scoped
    "email_preferences",
    "onboarding_emails_log",
    "competition_goals",
    "ai_coach_logs",
}

# Match supabase.from("table").<chain> — capture chain on the next ~3 lines.
MUTATION_RE = re.compile(
    r'supabase\.from\(\s*["\']([a-z_]+)["\']\s*\)((?:[^;\n]|\n[^\n]){0,400})',
)

SAFE_MARKER = re.compile(r"//\s*rls-ok\b")


def is_mutation(chain: str) -> str | None:
    """Return mutation type if chain contains .delete()/.update(), else None."""
    if ".delete(" in chain:
        return "delete"
    if ".update(" in chain:
        return "update"
    if ".upsert(" in chain:
        return "upsert"
    return None


def check_file(fp: Path) -> list[tuple[int, str, str]]:
    try:
        content = fp.read_text(encoding="utf-8")
    except Exception:
        return []

    findings: list[tuple[int, str, str]] = []
    for m in MUTATION_RE.finditer(content):
        table = m.group(1)
        chain = m.group(2)
        if table not in USER_SCOPED_TABLES:
            continue
        mtype = is_mutation(chain)
        if not mtype:
            continue
        # Allow if owner filter is present anywhere in the chain
        if '.eq("user_id"' in chain or ".eq('user_id'" in chain:
            continue
        # upsert with onConflict: user_id is also OK
        if mtype == "upsert" and "user_id" in chain:
            continue
        # Check opt-out marker on same / prev line
        line_no = content.count("\n", 0, m.start()) + 1
        ctx = content.split("\n")[max(0, line_no - 3) : line_no + 1]
        if any(SAFE_MARKER.search(l) for l in ctx):
            continue
        # Build short signature
        sig = (
            f"{table}.{mtype}({chain[:60].strip()[:80]})"
        )
        findings.append((line_no, sig, mtype))
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
    for fp in targets:
        findings = check_file(fp)
        if findings:
            rel = fp.relative_to(ROOT)
            for line, sig, mtype in findings:
                print(f"  [WARN] {rel}:{line}  ({mtype}) {sig}")
                total += 1

    print(f"\n❌ Supabase mutations on user-scoped tables without owner filter: {total}")
    if args.ci and total > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
