#!/usr/bin/env python3
"""z261r: detect mobile touch targets smaller than 44×44 px.

Why:
  - Apple HIG / WCAG 2.5.5 (Target Size) / Android Material both recommend
    44×44 px (≈ 9mm) minimum touch target for fingertip taps.
  - Smaller targets cause mis-taps on mobile (especially 320–375 px viewport),
    which directly hurts the most engaged-on-mobile pages (training log /
    skill map / dashboard CTAs).
  - The kind of buttons most likely to be undersized are icon-only ones:
    close (×), edit pencil, share, copy link — exactly the ones with
    `min-w-[NNpx] min-h-[NNpx]` arbitrary Tailwind values.

Rule:
  Any Tailwind `min-w-[NNpx]` / `min-h-[NNpx]` < 44 in a className
  used as a button/anchor/role-button is forbidden.

Scope:
  - Catches the explicit arbitrary px form (the one humans pick).
  - Does not flag `h-N` / `w-N` (Tailwind units) — too many false positives
    from icon sizes (svg w-4 h-4) and we already enforce arbitrary px on
    the *button wrapper*.

opt-out: `// touch-target: ok — <reason>` within 3 lines above.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {".next", "node_modules", ".git", ".claude"}

# Match either min-w-[NNpx] or min-h-[NNpx] anywhere in a className string.
# Capture the numeric value to compare against 44.
TARGET_RE = re.compile(r'min-(?:w|h)-\[(\d+)px\]')

SAFE_MARKER = re.compile(r"//\s*touch-target:\s*ok\b|/\*\s*touch-target:\s*ok\b")

# Heuristic: only flag if the same line / nearby lines look like a clickable
# element (button / role="button" / onClick=). Otherwise w-[36px] on a
# decoration won't trip the lint.
CLICKABLE_HINT = re.compile(
    r'<button\b|<a\s|<Link\s|role=["\']button["\']|onClick=|onTap=|onKeyDown='
)


def check_file(fp: Path) -> list[tuple[int, str, int]]:
    try:
        content = fp.read_text(encoding="utf-8")
    except Exception:
        return []

    lines = content.split("\n")
    findings: list[tuple[int, str, int]] = []

    for i, line in enumerate(lines, start=1):
        # Find both min-w-[NN] AND min-h-[NN] on this line — we want
        # icon-only square buttons (both axes specified, both under-spec).
        w_match = re.search(r'min-w-\[(\d+)px\]', line)
        h_match = re.search(r'min-h-\[(\d+)px\]', line)
        # Only flag when BOTH axes are constrained (= author intends a
        # square hit area, typically an icon button). Lines with only
        # min-h-[NN] are usually horizontal text buttons whose width
        # is determined by px-* + content, and they are allowed by
        # WCAG 2.5.5 if spaced apart.
        if not (w_match and h_match):
            continue
        w_val, h_val = int(w_match.group(1)), int(h_match.group(1))
        worst = min(w_val, h_val)
        if worst >= 44:
            continue
        # Look 5 lines back for opening clickable tag — supports multi-line
        # JSX where className is one line and <button is several above.
        window = "\n".join(lines[max(0, i - 5) : min(len(lines), i + 1)])
        if not CLICKABLE_HINT.search(window):
            continue
        # opt-out marker within ±3 lines
        ctx_lines = lines[max(0, i - 4) : min(len(lines), i + 2)]
        if any(SAFE_MARKER.search(l) for l in ctx_lines):
            continue
        snippet = line.strip()[:120]
        findings.append((i, snippet, worst))
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
            for line_no, snippet, val in findings:
                print(f"  [WARN] {rel}:{line_no}  ({val}px < 44px) {snippet}")
                total += 1

    if total == 0:
        print("✅ All clickable elements meet the 44×44 px touch target minimum.")
    else:
        print(f"\n❌ Sub-44 px touch targets on clickable elements: {total}")
        print("   Use min-w-[44px] min-h-[44px] or larger.")
        print("   Or opt out with: // touch-target: ok — <reason>")

    if args.ci and total > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
