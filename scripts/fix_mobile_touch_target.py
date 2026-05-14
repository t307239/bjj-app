#!/usr/bin/env python3
"""z261r: bulk-fix mobile touch targets < 44px to 44px.

Reads detect_mobile_touch_target.py findings, and for each (file, line, value):
  - replaces `min-w-[NNpx]` with `min-w-[44px]` (NN < 44)
  - replaces `min-h-[NNpx]` with `min-h-[44px]` (NN < 44)

Idempotent: re-running has no effect because 44 ≥ 44.
Safe: only touches lines inside className strings already pre-filtered by
the detector heuristic (clickable element hint within ±5 lines).

Usage:
  python3 scripts/fix_mobile_touch_target.py --dry-run    # preview
  python3 scripts/fix_mobile_touch_target.py --apply      # write
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Reuse detector's logic by importing it (same dir).
sys.path.insert(0, str(ROOT / "scripts"))
from detect_mobile_touch_target import check_file, EXCLUDE_DIRS  # type: ignore

# Match individual size token min-w-[NNpx] or min-h-[NNpx] inside any line.
TOKEN_RE = re.compile(r'min-(w|h)-\[(\d+)px\]')


def replace_undersized(line: str) -> tuple[str, int]:
    """Return (new_line, n_replacements). Only replaces values < 44."""
    n = 0

    def _sub(m: re.Match[str]) -> str:
        nonlocal n
        axis, val = m.group(1), int(m.group(2))
        if val >= 44:
            return m.group(0)
        n += 1
        return f"min-{axis}-[44px]"

    new = TOKEN_RE.sub(_sub, line)
    return new, n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        args.dry_run = True

    targets: list[Path] = []
    for ext in ("*.tsx", "*.ts"):
        for fp in ROOT.rglob(ext):
            if any(part in EXCLUDE_DIRS for part in fp.parts):
                continue
            if ".test." in fp.name or ".spec." in fp.name:
                continue
            targets.append(fp)

    total_files = 0
    total_changes = 0

    for fp in sorted(targets):
        findings = check_file(fp)
        if not findings:
            continue
        bad_lines = {ln for (ln, _snippet, _val) in findings}
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        lines = content.split("\n")
        file_changes = 0
        for ln in bad_lines:
            idx = ln - 1
            if 0 <= idx < len(lines):
                new, n = replace_undersized(lines[idx])
                if n > 0:
                    lines[idx] = new
                    file_changes += n
        if file_changes:
            total_files += 1
            total_changes += file_changes
            rel = fp.relative_to(ROOT)
            if args.apply:
                fp.write_text("\n".join(lines), encoding="utf-8")
                print(f"  fixed {file_changes:>2} in {rel}")
            else:
                print(f"  [dry-run] would fix {file_changes:>2} in {rel}")

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"\n[{mode}] {total_changes} touch-target replacement(s) across {total_files} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
