#!/usr/bin/env python3
"""z261n: Detect <table> without an accessible name (a11y).

Data tables should have an accessible name so screen readers can identify their
content. Options (any one accepted):
  - <caption> as first child
  - aria-label attribute
  - aria-labelledby pointing to an external heading id
  - role="presentation" (declares layout-only table — also acceptable)

Excludes:
  - JSX block comments
  - tables in template literals (e.g. HTML print preview windows)

CI: exits 1 if any violations.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = list(ROOT.glob("components/**/*.tsx")) + list(ROOT.glob("app/**/*.tsx"))


def strip_block_comments(text: str) -> str:
    out = []
    i = 0
    while i < len(text):
        if text[i : i + 2] == "/*":
            end = text.find("*/", i + 2)
            if end == -1:
                out.append(" " * (len(text) - i))
                break
            chunk = text[i : end + 2]
            out.append("".join(c if c == "\n" else " " for c in chunk))
            i = end + 2
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def extract_jsx_tag(text: str, start: int) -> str | None:
    i = start + 1
    db = 0
    while i < len(text):
        c = text[i]
        if c == "{":
            db += 1
        elif c == "}":
            db -= 1
        elif c == ">" and db == 0:
            return text[start : i + 1]
        i += 1
    return None


def is_in_template_literal(text: str, pos: int) -> bool:
    """Check if pos is inside a backtick-delimited template string."""
    return text[:pos].count("`") % 2 == 1


def main(ci_mode: bool = False) -> int:
    violations: list[tuple[Path, int, str]] = []
    for path in sorted(TARGETS):
        if ".test." in path.name or "__tests__" in str(path):
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception:
            continue
        text = strip_block_comments(raw)
        for m in re.finditer(r"<table\b", text):
            if is_in_template_literal(text, m.start()):
                continue
            tag = extract_jsx_tag(text, m.start())
            if not tag:
                continue
            if re.search(r"\baria-label\b", tag) or re.search(r"\baria-labelledby\b", tag):
                continue
            if re.search(r'\brole=[\"\']presentation[\"\']', tag):
                continue
            # Look at next ~300 chars for <caption>
            forward = text[m.start() : m.start() + 500]
            if re.search(r"<caption\b", forward):
                continue
            ln = text[: m.start()].count("\n") + 1
            violations.append((path, ln, tag[:120]))

    if violations:
        print(f"❌ A11y: {len(violations)} <table> elements lack accessible name")
        for path, ln, snippet in violations:
            print(f"   {path.relative_to(ROOT)}:{ln}: {snippet}")
        print()
        print("   Fix: add <caption>, aria-label, aria-labelledby, or role=\"presentation\".")
        if ci_mode:
            return 1
    else:
        print("✅ All <table> elements have accessible name (or role=presentation).")
    return 0


if __name__ == "__main__":
    ci = "--ci" in sys.argv
    sys.exit(main(ci))
