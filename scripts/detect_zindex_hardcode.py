#!/usr/bin/env python3
"""
z261c: 17th bjj-app lint — z-index hardcode detector.

After the z261c migration centralized z-index values into semantic tokens in
`tailwind.config.ts` (`zIndex: { base, floating, tooltip, sticky-nav, banner,
dropdown, modal-backdrop, modal, toast, critical }`), this lint enforces that
no new numeric z-index escapes the design system.

Detects:
    1. Tailwind class form:  z-50, z-[60], focus:z-[9999]
    2. Inline style:         zIndex: 50, zIndex: 9999

Allows:
    - z-base, z-floating, z-tooltip, z-sticky-nav, z-banner, z-dropdown,
      z-modal-backdrop, z-modal, z-toast, z-critical (the tokens)
    - Inline `zIndex: N` annotated with `/* z-<token> */` (paired with a known
      token name) — required when class form isn't usable (style={{ }} numeric)
    - Lines containing `// z-hardcode: ok` opt-out comment for intentional
      legitimate exceptions

Usage:
    python3 scripts/detect_zindex_hardcode.py            # human report
    python3 scripts/detect_zindex_hardcode.py --ci       # exit 1 on violation
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ALLOWED_TOKENS = {
    "base",
    "floating",
    "tooltip",
    "sticky-nav",
    "banner",
    "dropdown",
    "modal-backdrop",
    "modal",
    "toast",
    "critical",
}

SKIP_DIRS = {".next", "node_modules", ".claude", "dist", "build", ".git"}
SKIP_FILE_SUFFIXES = (".test.tsx", ".test.ts", ".spec.tsx", ".spec.ts")
OPT_OUT_MARKER = "// z-hardcode: ok"

# z-N or z-[N] with optional Tailwind variant prefix like `focus:` `hover:` etc.
CLASS_PATTERN = re.compile(
    r"""
    (?<![A-Za-z0-9_-])              # word boundary, not part of bigger id
    (?:[a-z]+:)?                    # optional variant prefix (focus:, hover:, sm:, etc.)
    z-                              # z- prefix
    (?:
        \[(?P<bracket>\d+)\]        # bracketed: z-[60]
        |
        (?P<bare>\d+)\b             # bare: z-50
    )
    """,
    re.VERBOSE,
)

INLINE_STYLE_PATTERN = re.compile(
    r"""
    zIndex:\s*
    (?P<val>\d+)
    (?P<after>[^,}\n]*)
    """,
    re.VERBOSE,
)


def should_scan(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_DIRS:
        return False
    if any(str(path).endswith(s) for s in SKIP_FILE_SUFFIXES):
        return False
    if path.suffix not in (".ts", ".tsx"):
        return False
    # tailwind.config.ts is the source of truth — skip
    if path.name == "tailwind.config.ts":
        return False
    return True


def is_in_string_only_context(line: str, match_start: int) -> bool:
    """Best-effort: skip matches that are inside a CSS-string-only comment context.
    Currently we only skip lines that are entirely a comment-style summary line.
    """
    stripped = line.strip()
    # Pure documentation comment lines like `// 数値は既存 hardcode の semantic 順序を尊重 (旧: z-10/20/30/40 ...)`
    if stripped.startswith("//") or stripped.startswith("*"):
        return True
    return False


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_no, severity, message)."""
    issues: list[tuple[int, str, str]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return issues
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        if OPT_OUT_MARKER in line:
            continue
        for m in CLASS_PATTERN.finditer(line):
            if is_in_string_only_context(line, m.start()):
                continue
            val = m.group("bracket") or m.group("bare")
            issues.append(
                (
                    i,
                    "ERROR",
                    f"hardcoded class `z-{m.group(0).split('z-')[-1]}` "
                    f"(value={val}) — use a semantic token (z-floating, z-modal, "
                    f"z-toast, z-critical, etc.) or annotate with `{OPT_OUT_MARKER}`",
                )
            )
        for m in INLINE_STYLE_PATTERN.finditer(line):
            val = m.group("val")
            after = m.group("after") or ""
            # If the trailing content has /* z-<token> */ for a KNOWN token, allow it
            annot = re.search(r"/\*\s*z-([a-z-]+)\s*\*/", after)
            if annot and annot.group(1) in ALLOWED_TOKENS:
                continue
            if is_in_string_only_context(line, m.start()):
                continue
            issues.append(
                (
                    i,
                    "ERROR",
                    f"inline `zIndex: {val}` lacks `/* z-<token> */` annotation — "
                    f"add `/* z-modal */` etc. (matching tailwind.config.ts) or "
                    f"`{OPT_OUT_MARKER}`",
                )
            )
    return issues


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ci", action="store_true", help="exit 1 on any violation")
    args = parser.parse_args()

    targets = [ROOT / "app", ROOT / "components", ROOT / "hooks", ROOT / "lib"]
    files: list[Path] = []
    for t in targets:
        if not t.exists():
            continue
        for p in t.rglob("*"):
            if should_scan(p):
                files.append(p)

    all_issues: list[tuple[Path, int, str, str]] = []
    for f in files:
        for line_no, sev, msg in scan_file(f):
            all_issues.append((f, line_no, sev, msg))

    if not all_issues:
        print("✅ detect_zindex_hardcode: no numeric z-index hardcodes outside tokens.")
        print(f"   Scanned {len(files)} TS/TSX files.")
        return 0

    print(f"🔴 detect_zindex_hardcode: {len(all_issues)} violation(s)\n")
    for f, line_no, sev, msg in all_issues:
        rel = f.relative_to(ROOT)
        print(f"  {rel}:{line_no} — {msg}")
    print()
    print(f"💡 Fix: replace numeric value with a semantic token from")
    print(f"   tailwind.config.ts extend.zIndex (z-floating, z-modal, z-toast, ...)")
    print(f"   or add `{OPT_OUT_MARKER}` for legitimate exceptions.")

    if args.ci:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
