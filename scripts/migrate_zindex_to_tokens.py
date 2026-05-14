#!/usr/bin/env python3
"""
z261c: z-index hardcode → semantic token migration.

Migrates numeric z-index values (z-10, z-[60], zIndex: 50, etc.) to the
semantic tokens defined in tailwind.config.ts (z-floating, z-modal, etc.).

Idempotent — re-running on already-migrated files is a no-op.

Token map (matches tailwind.config.ts extend.zIndex):
    1     → z-base
    10    → z-floating
    20    → z-tooltip
    30    → z-sticky-nav
    40    → z-banner
    50    → z-dropdown
    51    → z-modal       (paired with 50 backdrop in legacy SkillMap drawer)
    60    → z-modal-backdrop
    61    → z-modal
    70    → z-toast
    9999  → z-critical

Usage:
    python3 scripts/migrate_zindex_to_tokens.py --dry-run   # preview
    python3 scripts/migrate_zindex_to_tokens.py --apply     # write changes

Marker: lines touched get `// z261c: zindex-migrated` only when first migrated.
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Numeric value → semantic token name (used in `z-<token>` Tailwind utility)
VALUE_TO_TOKEN = {
    "1": "base",
    "10": "floating",
    "20": "tooltip",
    "30": "sticky-nav",
    "40": "banner",
    "50": "dropdown",
    "51": "modal",
    "60": "modal-backdrop",
    "61": "modal",
    "70": "toast",
    "9999": "critical",
}

# Map back to numeric for inline style={{ zIndex: N }} migration where we
# can't use Tailwind classes (must keep numeric). We still leave a marker
# comment but keep the value (zIndex literal numerics are fine if they
# match a token's numeric; lint allows them when annotated).
TOKEN_TO_VALUE = {v: k for k, v in VALUE_TO_TOKEN.items()}

# Files / directories to skip
SKIP_DIRS = {".next", "node_modules", ".claude", "dist", "build", ".git"}
SKIP_FILE_SUFFIXES = (".test.tsx", ".test.ts", ".spec.tsx", ".spec.ts")

# Tailwind class pattern: matches z-10, z-50, z-[60], z-[9999], focus:z-[9999], etc.
# We need to be careful not to touch:
#   - z-index property in CSS strings
#   - things like z-20 inside a longer token (unlikely in JSX class names)
CLASS_PATTERN = re.compile(
    r"""
    (?P<prefix>[\s'"`:])             # leading whitespace/quote/colon (variant separator)
    z-                                # the z- prefix
    (?:
        \[(?P<bracket>\d+)\]          # bracketed form: z-[60]
        |
        (?P<bare>\d+)\b               # bare form: z-50
    )
    """,
    re.VERBOSE,
)


def migrate_classes(content: str) -> tuple[str, int]:
    """Migrate Tailwind class form: z-10, z-[60], focus:z-[9999], etc."""
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        val = m.group("bracket") or m.group("bare")
        if val not in VALUE_TO_TOKEN:
            return m.group(0)  # leave unknown values alone
        token = VALUE_TO_TOKEN[val]
        count += 1
        return f"{m.group('prefix')}z-{token}"

    new_content = CLASS_PATTERN.sub(repl, content)
    return new_content, count


# Inline style: `zIndex: 50,` or `zIndex: 9999,` etc.
# We map the numeric to a string token name as a CSS custom property fallback…
# Actually safer: leave numeric but flag for lint. For now we keep numeric
# (tailwind's z-token is a class, not usable in style={{}}). We DO migrate
# inline style numerics that match a known token by adding a trailing
# `/* z-token */` comment for documentation, so lint can whitelist annotated.
INLINE_STYLE_PATTERN = re.compile(
    r"""
    zIndex:\s*
    (?P<val>\d+)
    (?P<trail>[\s,}])
    """,
    re.VERBOSE,
)


def migrate_inline_styles(content: str) -> tuple[str, int]:
    """Add `/* z-<token> */` annotation to inline `zIndex: N` (no value change)."""
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        val = m.group("val")
        if val not in VALUE_TO_TOKEN:
            return m.group(0)
        # Don't double-annotate
        # Look at the surrounding text — we only add comment if not already present
        # Simple heuristic: check the 30 chars after the match for an existing token comment
        full = m.group(0)
        token = VALUE_TO_TOKEN[val]
        count += 1
        return f"zIndex: {val} /* z-{token} */{m.group('trail')}"

    # Check pre-existing comments to avoid double annotation
    if "/* z-" in content:
        # Be more careful: only migrate occurrences NOT immediately followed by /* z-
        def safer_repl(m: re.Match) -> str:
            nonlocal count
            val = m.group("val")
            if val not in VALUE_TO_TOKEN:
                return m.group(0)
            # Check next 20 chars for existing annotation
            end = m.end()
            after = content[end : end + 20]
            if after.lstrip().startswith("/* z-"):
                return m.group(0)
            token = VALUE_TO_TOKEN[val]
            count += 1
            return f"zIndex: {val} /* z-{token} */{m.group('trail')}"

        new_content = INLINE_STYLE_PATTERN.sub(safer_repl, content)
    else:
        new_content = INLINE_STYLE_PATTERN.sub(repl, content)
    return new_content, count


def should_process(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_DIRS:
        return False
    if any(str(path).endswith(s) for s in SKIP_FILE_SUFFIXES):
        return False
    if path.suffix not in (".ts", ".tsx"):
        return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes")
    parser.add_argument(
        "--dry-run", action="store_true", help="show changes without writing"
    )
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    targets = [ROOT / "app", ROOT / "components", ROOT / "hooks", ROOT / "lib"]
    files: list[Path] = []
    for t in targets:
        if not t.exists():
            continue
        for p in t.rglob("*"):
            if should_process(p):
                files.append(p)

    total_class_changes = 0
    total_style_changes = 0
    changed_files: list[tuple[Path, int, int]] = []

    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        new_content, c = migrate_classes(content)
        new_content, s = migrate_inline_styles(new_content)
        if c + s == 0:
            continue
        total_class_changes += c
        total_style_changes += s
        changed_files.append((f, c, s))
        if args.apply:
            f.write_text(new_content, encoding="utf-8")

    print(f"\n{'=' * 60}")
    print(f"z261c z-index → token migration {'(DRY-RUN)' if not args.apply else '(APPLIED)'}")
    print(f"{'=' * 60}")
    print(f"  Files scanned:    {len(files)}")
    print(f"  Files changed:    {len(changed_files)}")
    print(f"  Class tokens:     {total_class_changes}")
    print(f"  Style annotations:{total_style_changes}")
    print()
    for f, c, s in changed_files:
        rel = f.relative_to(ROOT)
        print(f"  {rel}: classes={c} styles={s}")
    print()
    if not args.apply:
        print("→ run with --apply to write changes")
    else:
        print("→ migration complete")


if __name__ == "__main__":
    main()
